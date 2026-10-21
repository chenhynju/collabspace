import * as Y from "yjs";
import { api } from "./api";
import { VERSION, type Member } from "@collabspace/protocol";
export type { Member } from "@collabspace/protocol";

export const to64 = (bytes: Uint8Array) => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 8192)
    out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(out);
};
export const from64 = (s: string) =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

type Pending = { updateId: string; update: string };
export class DocumentProvider {
  doc = new Y.Doc();
  ready = false;
  role = "VIEWER";
  status = "正在连接";
  members: Member[] = [];
  metadataRevision = 0;
  pending = new Map<string, Pending>();
  private db!: IDBDatabase;
  private ws?: WebSocket;
  private stopped = false;
  private blocked = false;
  private timer?: ReturnType<typeof setTimeout>;
  private retry = 1000;
  private queue = Promise.resolve();
  private listeners = new Set<() => void>();
  private synced = false;
  private inFlight?: string;
  private sentAt = 0;
  private pumpTimer?: ReturnType<typeof setTimeout>;
  private ackTimer?: ReturnType<typeof setTimeout>;
  constructor(
    public docId: string,
    private org: string,
    private user: string,
  ) {}
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    this.listeners.forEach((f) => f());
  }
  private setStatus(s: string) {
    this.status = s;
    this.emit();
  }
  private revokeImages() {
    window.dispatchEvent(new CustomEvent('collabspace:document-revoked',{detail:{org:this.org,docId:this.docId}}));
    if(!this.db)return;
    const tx=this.db.transaction('data','readwrite'),store=tx.objectStore('data');
    const r=store.openCursor();r.onsuccess=()=>{const cursor=r.result;if(!cursor)return;if(String(cursor.key).startsWith('image:'))cursor.delete();cursor.continue();};
  }
  get saved() {
    return (
      this.synced && !this.pending.size && this.status === "已保存到服务器"
    );
  }
  get writable() {
    return !this.blocked && ["OWNER", "EDITOR"].includes(this.role);
  }
  async init() {
    const name = `collabspace:v1:${location.origin}:${this.user}:${this.org}:${this.docId}`;
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("data");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const stored = (await this.read("state")) as Uint8Array | undefined;
    if (stored) {
      Y.applyUpdate(this.doc, stored, "remote");
      this.ready = true;
    }
    const pending = (await this.read("pending")) as Pending[] | undefined;
    for (const p of pending || []) this.pending.set(p.updateId, p);
    const role = (await this.read("role")) as string | undefined;
    if (role) this.role = role;
    if (this.stopped) {
      this.db.close();
      return;
    }
    window.addEventListener("collabspace:logout", this.logout);
    this.doc.on("update", this.onUpdate);
    window.addEventListener("online", this.online);
    window.addEventListener("offline", this.offline);
    this.connect();
  }
  private read(key: string) {
    return new Promise<unknown>((resolve, reject) => {
      const r = this.db.transaction("data").objectStore("data").get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  private persist() {
    return new Promise<void>((resolve, reject) => {
      const tx = this.db.transaction("data", "readwrite");
      const s = tx.objectStore("data");
      s.put(Y.encodeStateAsUpdate(this.doc), "state");
      s.put([...this.pending.values()], "pending");
      s.put(this.role, "role");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  private onUpdate = (bytes: Uint8Array, origin: unknown) => {
    if (this.stopped) return;
    const local = origin !== "remote";
    if (local) {
      const p = { updateId: crypto.randomUUID(), update: to64(bytes) };
      this.pending.set(p.updateId, p);
    }
    this.setStatus("正在保存到此设备");
    this.queue = this.queue
      .then(async () => {
        await this.persist();
        if (
          [...this.pending.values()].reduce((n, p) => n + p.update.length, 0) >
          5 * 1024 * 1024
        ) {
          this.blocked = true;
          this.setStatus("待同步内容过多，请导出草稿");
          return;
        }
        this.setStatus(
          this.ws?.readyState === 1 ? "正在同步" : "已保存到此设备 · 离线",
        );
        this.flush();
      })
      .catch(() => {
        this.blocked = true;
        this.setStatus("本地保存失败，请导出草稿");
      });
  };
  private logout = () => {
    void this.destroy();
  };
  private online = () => {
    clearTimeout(this.timer);
    if (!this.ws || this.ws.readyState > 1) this.connect();
  };
  private offline = () => {
    this.ws?.close();
    this.setStatus("已保存到此设备 · 离线");
  };
  private send(data: object) {
    if (this.ws?.readyState === 1)
      this.ws.send(JSON.stringify({ v: VERSION, ...data }));
  }
  private flush() {
    if (!this.synced || this.blocked) return;
    // One durable update in flight avoids flooding the server when hundreds of
    // offline keystrokes reconnect. Stable IDs are retained until their ACK.
    if (this.inFlight && this.pending.has(this.inFlight)) return;
    const p = this.pending.values().next().value;
    if (p) {
      const wait = this.sentAt + 60 - Date.now();
      if (wait > 0) {
        if (!this.pumpTimer)
          this.pumpTimer = setTimeout(() => {
            this.pumpTimer = undefined;
            this.flush();
          }, wait);
        return;
      }
      this.inFlight = p.updateId;
      this.sentAt = Date.now();
      this.send({ type: "update", ...p });
      clearTimeout(this.ackTimer);
      this.ackTimer = setTimeout(
        () => this.ws?.close(4000, "ACK timeout; retry stable update ID"),
        5000,
      );
    } else this.setStatus("已保存到服务器");
  }
  private async connect() {
    if (this.stopped || this.blocked) return;
    this.synced = false;
    try {
      const { data: t } = await api.post(
        `/documents/${this.docId}/session-ticket`,
      );
      if (this.stopped) return;
      this.role = t.role;
      await this.persist();
      const ws = new WebSocket(t.wsUrl);
      this.ws = ws;
      ws.onopen = () =>
        this.send({
          type: "auth",
          docSchema: 2,
          org: this.org,
          user: this.user,
          docId: this.docId,
          ticket: t.ticket,
        });
      ws.onmessage = (e) => {
        let m: any;
        try {
          m = JSON.parse(e.data);
        } catch {
          return;
        }
        if (m.type === "authenticated") {
          this.role = m.role;
          this.send({
            type: "sync",
            vector: to64(Y.encodeStateVector(this.doc)),
          });
        }
        if (m.type === "synced" || m.type === "remote") {
          Y.applyUpdate(this.doc, from64(m.update), "remote");
          this.role = m.role;
          if (m.type === "synced") {
            this.ready = true;
            this.synced = true;
            this.retry = 1000;
            this.queue = this.queue
              .then(() => this.persist())
              .then(() => this.flush())
              .catch(() => {
                this.blocked = true;
                this.setStatus("本地保存失败，请导出草稿");
              });
          }
        }
        if (m.type === "ack") {
          this.queue = this.queue
            .then(async () => {
              this.pending.delete(m.updateId);
              if (this.inFlight === m.updateId) {
                this.inFlight = undefined;
                clearTimeout(this.ackTimer);
              }
              await this.persist();
              this.setStatus(this.pending.size ? "正在同步" : "已保存到服务器");
              this.flush();
            })
            .catch(() => {
              this.blocked = true;
              this.setStatus("本地保存失败，请导出草稿");
            });
        }
        if (m.type === "presence") {
          this.members = m.members;
          this.emit();
        }
          if(m.type==='metadata-changed'){this.metadataRevision++;this.emit();}
        if (m.type === "error") {
          this.synced = false;
          this.setStatus(
            m.code === "CLIENT_UPGRADE_REQUIRED" ? "编辑器已升级，请刷新页面；本地草稿保留" : m.code === "READ_ONLY"
              ? "只读权限，草稿未上传"
              : `同步失败：${m.code}`,
          );
          if (
            [
              "READ_ONLY",
              "CLIENT_UPGRADE_REQUIRED",
              "NOT_FOUND",
              "DOCUMENT_ARCHIVED",
              "INVALID_UPDATE",
              "INVALID_DOCUMENT_IMAGE",
              "IMAGE_LIMIT",
              "DOCUMENT_TOO_LARGE",
            ].includes(m.code)
          ) {
            this.blocked = true;
            ws.close();
          } else ws.close(4000, "Retry");
        }
      };
      ws.onclose = (e) => {
        clearTimeout(this.ackTimer);
        this.synced = false;
        this.inFlight = undefined;
        this.members = [];
        if (this.stopped) return;
        if (e.code === 1009) {
          this.blocked = true;
          this.setStatus("单次编辑过大，请导出草稿后拆分内容");
          return;
        }
        if (e.code === 4003) {
          this.revokeImages();
          this.blocked = true;
          this.setStatus("权限已撤销，未同步草稿可导出");
          return;
        }
        if (!this.blocked) {
          this.setStatus("已保存到此设备 · 离线");
          this.schedule();
        }
      };
      ws.onerror = () => ws.close();
    } catch (e: any) {
      if (this.stopped) return;
      if ([401, 403, 404].includes(e.response?.status)) {
        this.revokeImages();
        this.blocked = true;
        this.setStatus("权限已撤销，未同步草稿可导出");
      } else {
        this.setStatus("服务器暂不可用 · 本地草稿保留");
        this.schedule();
      }
    }
  }
  private schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(
      () => this.connect(),
      this.retry + Math.random() * 300,
    );
    this.retry = Math.min(this.retry * 2, 30000);
  }
  selection(selection: Member["selection"]) {
    this.send({ type: "presence", selection });
  }
  cursor(cursor: Member["cursor"]) {
    this.send({ type: "presence", selection: null, cursor });
  }
  async destroy() {
    if (this.stopped) return;
    this.stopped = true;
    window.removeEventListener("collabspace:logout", this.logout);
    clearTimeout(this.timer);
    clearTimeout(this.pumpTimer);
    clearTimeout(this.ackTimer);
    window.removeEventListener("online", this.online);
    window.removeEventListener("offline", this.offline);
    this.ws?.close();
    this.doc.off("update", this.onUpdate);
    await this.queue;
    this.db?.close();
    this.doc.destroy();
    this.listeners.clear();
  }
}
export async function clearDocumentCaches(userId?: string) {
  if (!indexedDB.databases) return;
  const dbs = await indexedDB.databases();
  await Promise.all(
    dbs
      .filter((d) =>
        d.name?.startsWith(
          `collabspace:v1:${location.origin}:${userId ? `${userId}:` : ""}`,
        ),
      )
      .map(
        (d) =>
          new Promise<void>((resolve) => {
            const r = indexedDB.deleteDatabase(d.name!);
            r.onsuccess = () => resolve();
            r.onerror = () => resolve();
            r.onblocked = () => resolve();
          }),
      ),
  );
}
