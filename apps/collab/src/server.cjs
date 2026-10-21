const http = require("node:http");
const { WebSocketServer, WebSocket } = require("ws");
const { Store, StoreError } = require("@collabspace/store");
const { z } = require("zod");
const { auth, frame, MAX_FRAME_BYTES } = require("@collabspace/protocol");
function start({
  store = new Store(),
  port = Number(process.env.COLLAB_PORT || 3002),
  origins = (process.env.WEB_URL || "http://localhost:3000").split(","),
} = {}) {
  const rooms = new Map();
  let draining = false;
  const metrics = { updates: 0, rejected: 0, connections: 0 };
  const pendingCommits = new Map();
  let metadataClient,metadataRetry;
  const listenMetadata=async()=>{
    if(draining)return;
    try{
      metadataClient=await store.listenMetadata(async hint=>{
        if(typeof hint.org!=='string'||typeof hint.docId!=='string')return;
        const recipients=rooms.get(`${hint.org}:${hint.docId}`);
        if(!recipients)return;
        await Promise.all([...recipients].map(s=>store.metadataDelivery(s.ctx,s.docId,()=>send(s,{type:'metadata-changed'})).catch(e=>{if([401,403,404].includes(e.status))s.close(4003,'Access revoked');})));
      });
      const lost=()=>{if(!metadataClient)return;const c=metadataClient;metadataClient=undefined;c.release(true);if(!draining)metadataRetry=setTimeout(listenMetadata,1000);};
      metadataClient.on('error',lost);
      metadataClient.on('end',lost);
    }catch{if(!draining)metadataRetry=setTimeout(listenMetadata,2000);}
  };
  const metadataReady=store.listenMetadata?listenMetadata():Promise.resolve();
  function commitUpdate(ctx, id, input) {
    return new Promise((resolve, reject) => {
      const key = `${ctx.org}:${id}`;
      let pending = pendingCommits.get(key);
      if (!pending) {
        pending = [];
        pendingCommits.set(key, pending);
        setTimeout(async () => {
          pendingCommits.delete(key);
          try {
            const results = await store.updateBatch(id, pending);
            results.forEach((r, i) =>
              r.ok ? pending[i].resolve(r) : pending[i].reject(r.error),
            );
          } catch (e) {
            pending.forEach((p) => p.reject(e));
          }
        }, 10);
      }
      pending.push({ ctx, input, resolve, reject });
    });
  }
  const server = http.createServer(async (req, res) => {
    if (req.url === "/health/live") {
      res.writeHead(200);
      return res.end("ok");
    }
    if (req.url === "/health/ready") {
      try {
        await store.assertRuntime();
        res.writeHead(draining ? 503 : 200);
        res.end(draining ? "draining" : "ready");
      } catch {
        res.writeHead(503);
        res.end("database unavailable");
      }
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const wss = new WebSocketServer({
    server,
    maxPayload: MAX_FRAME_BYTES,
    perMessageDeflate: false,
    verifyClient: ({ origin, req }) =>
      !draining &&
      req.url === "/collab" &&
      origins.includes(origin) &&
      wss.clients.size < 200,
  });
  function send(s, msg) {
    if (s.readyState !== WebSocket.OPEN) return;
    if (s.bufferedAmount > 1024 * 1024) {
      s.close(1013, "Slow consumer; resync required");
      return;
    }
    s.send(JSON.stringify({ v: 1, ...msg }));
  }
  function room(s) {
    return rooms.get(`${s.ctx.org}:${s.docId}`) || new Set();
  }
  async function presence(s) {
    // Never trust client user names/ids. All delivery rechecks current ACL.
    let audience;
    try {
      audience = new Map(
        (await store.audience(s.ctx, s.docId)).map((r) => [r.user_id, r]),
      );
    } catch (e) {
      if ([401, 403, 404].includes(e.status)) s.close(4003, "Access revoked");
      else send(s, { type: "error", code: "DATABASE_UNAVAILABLE" });
      return;
    }
    const members = [];
    for (const p of room(s)) {
      const authorized = audience.get(p.ctx.user);
      if (authorized) {
        members.push({
          sessionId: p.sessionId,
          userId: p.ctx.user,
          name: authorized.name,
          selection: p.selection || null,
          cursor: p.cursor || null,
        });
      } else p.close(4003, "Access revoked");
    }
    for (const p of room(s)) {
      if (p.readyState === WebSocket.OPEN)
        send(p, { type: "presence", members });
    }
  }
  wss.on("connection", (s) => {
    metrics.connections++;
    s.alive = true;
    s.chain = Promise.resolve();
    s.started = Date.now();
    s.frameCount = 0;
    s.bytesCount = 0;
    s.presenceAt = 0;
    s.queued = 0;
    const deadline = setTimeout(() => {
      if (!s.ctx) s.close(4001, "Authentication required");
    }, 5000);
    s.on("pong", () => {
      s.alive = true;
    });
    s.on("message", (raw) => {
      if (++s.queued > 80) {
        s.close(1013, "Queue capacity; retry later");
        return;
      }
      if (Date.now() - s.started > 1000) {
        s.started = Date.now();
        s.frameCount = 0;
        s.bytesCount = 0;
      }
      s.bytesCount += raw.length;
      if (++s.frameCount > 40 || s.bytesCount > 1024 * 1024) {
        s.close(4008, "Rate limit");
        return;
      }
      s.chain = s.chain
        .then(async () => {
          let data;
          try {
            data = JSON.parse(raw.toString());
          } catch {
            throw new StoreError(400, "INVALID_FRAME");
          }
          if (!s.ctx) {
            const a = auth.parse(data);
            const ctx = { org: a.org, user: a.user };
            const info = await store.consume(ctx, a.docId, a.ticket);
            // Old ProseMirror schemas normalize unknown image nodes away. Do
            // not let an old document client sync or submit destructive cleanup.
            if((info.kind==="DOCUMENT" && ![2,3].includes(a.docSchema)) || (info.kind==='MARKDOWN' && a.docSchema!==3))
              throw new StoreError(409,"CLIENT_UPGRADE_REQUIRED");
            const key = `${ctx.org}:${a.docId}`;
            let r = rooms.get(key);
            if (!r) {
              r = new Set();
              rooms.set(key, r);
            }
            if (r.size >= 20) throw new StoreError(429, "ROOM_FULL");
            s.ctx = ctx;
            s.docId = a.docId;
            s.name = info.name;
            s.sessionId = require("node:crypto").randomUUID();
            r.add(s);
            clearTimeout(deadline);
            send(s, {
              type: "authenticated",
              role: info.role,
              user: { id: ctx.user, name: info.name },
            });
            await presence(s);
            return;
          }
          const m = frame.parse(data);
          if (m.type === "sync") {
            const result = await store.sync(s.ctx, s.docId, m.vector);
            send(s, { type: "synced", ...result });
            return;
          }
          if (m.type === "presence") {
            if (Date.now() - s.presenceAt < 100) return;
            s.presenceAt = Date.now();
            s.selection = m.selection;
            s.cursor = m.cursor || null;
            await presence(s);
            return;
          }
          const ack = await commitUpdate(s.ctx, s.docId, m);
          metrics.updates++;
          send(s, { type: "ack", seq: ack.seq, updateId: ack.updateId });
          if (ack.duplicate) return;
          const readers = new Map(ack.readers.map((r) => [r.user_id, r.role]));
          for (const peer of room(s)) {
            if (peer === s) continue;
            const role = readers.get(peer.ctx.user);
            if (!role) {
              peer.close(4003, "Access revoked");
              continue;
            }
            send(peer, {
              type: "remote",
              update: m.update,
              seq: ack.seq,
              updateId: m.updateId,
              role,
            });
          }
        })
        .catch((e) => {
          metrics.rejected++;
          const code =
            e instanceof StoreError
              ? e.code
              : e instanceof z.ZodError
                ? "INVALID_FRAME"
                : "DATABASE_UNAVAILABLE";
          send(s, { type: "error", code });
          if(code==="CLIENT_UPGRADE_REQUIRED") s.close(4009,"Refresh page to update document editor");
          if ([401, 403, 404].includes(e.status))
            s.close(4003, "Access revoked");
        })
        .finally(() => {
          s.queued--;
        });
    });
    s.on("close", () => {
      clearTimeout(deadline);
      if (s.ctx) {
        const key = `${s.ctx.org}:${s.docId}`,
          r = rooms.get(key);
        r?.delete(s);
        if (!r?.size) rooms.delete(key);
        else presence(s).catch(() => {});
      }
    });
    s.on("error", () => {});
  });
  const timer = setInterval(() => {
    for (const s of wss.clients) {
      if (!s.alive) {
        s.terminate();
        continue;
      }
      s.alive = false;
      s.ping();
    }
    for (const r of rooms.values()) {
      const s = r.values().next().value;
      if (s) presence(s).catch(() => {});
    }
  }, 10000);
  timer.unref();
  server.listen(port, process.env.COLLAB_HOST || "127.0.0.1", () =>
    console.log(
      `CollabSpace WS listening on 127.0.0.1:${server.address().port}`,
    ),
  );
  return {
    server,
    wss,
    metrics,
    metadataReady,
    async close() {
      draining = true;
      clearTimeout(metadataRetry);
      if(metadataClient){const c=metadataClient;metadataClient=undefined;await c.query('UNLISTEN collab_metadata').catch(()=>{});c.release();}
      clearInterval(timer);
      await Promise.all([...wss.clients].map((s) => s.chain));
      for (const s of wss.clients) s.close(1001, "Server restarting");
      await new Promise((r) => wss.close(r));
      await new Promise((r) => server.close(r));
      await store.close();
    },
  };
}
if (require.main === module) {
  async function main() {
    const store = new Store();
    try {
      await store.assertRuntime();
    } catch (e) {
      await store.close();
      throw e;
    }
    const app = start({ store });
    for (const signal of ["SIGINT", "SIGTERM"])
      process.on(signal, () => {
        app.close().then(() => process.exit(0));
        setTimeout(() => process.exit(1), 10000).unref();
      });
  }
  main().catch(() => {
    console.error(
      "Collaboration startup refused: database runtime safety check failed",
    );
    process.exitCode = 1;
  });
}
module.exports = { start };
