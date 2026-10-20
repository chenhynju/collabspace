const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { randomUUID } = require("node:crypto");
const WebSocket = require("ws");
const { Store } = require("@collabspace/store");
const Y = require("../../../packages/collab-store/node_modules/yjs");
const { start } = require("../src/server.cjs");
const { spawn } = require("node:child_process");
const { resolve } = require("node:path");
function inbox(ws) {
  const messages = [];
  const waiters = [];
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    const i = waiters.findIndex((w) => w.type === m.type);
    if (i >= 0) {
      const [w] = waiters.splice(i, 1);
      clearTimeout(w.timer);
      w.resolve(m);
    } else messages.push(m);
  });
  return (type) =>
    new Promise((resolve, reject) => {
      const i = messages.findIndex((m) => m.type === type);
      if (i >= 0) return resolve(messages.splice(i, 1)[0]);
      const w = {
        type,
        resolve,
        timer: setTimeout(() => {
          const i = waiters.indexOf(w);
          if (i >= 0) waiters.splice(i, 1);
          reject(new Error("Timeout waiting for " + type));
        }, 15000),
      };
      waiters.push(w);
    });
}
test(
  "WebSocket: commit ACK, restart recovery, viewer attack, revoked connection",
  { skip: !process.env.COLLAB_TEST_DATABASE_URL },
  async () => {
    const url = process.env.COLLAB_TEST_DATABASE_URL,
      store = new Store(url),
      ctx = { org: process.env.TEST_ORG, user: process.env.TEST_OWNER },
      viewer = { org: ctx.org, user: process.env.TEST_MEMBER };
    const d = await store.create(ctx, process.env.TEST_PROJECT, {
      title: "WS acceptance",
    });
    await store.grant(ctx, d.id, { userId: viewer.user, role: "VIEWER" });
    let app = start({
      store: new Store(url),
      port: 0,
      origins: ["http://localhost:3010"],
    });
    await once(app.server, "listening");
    const clients = [];
    async function connect(who) {
      const t = await store.ticket(who, d.id);
      const ws = new WebSocket(
          `ws://127.0.0.1:${app.server.address().port}/collab`,
          { origin: "http://localhost:3010" },
        ),
        next = inbox(ws);
      clients.push(ws);
      await once(ws, "open");
      ws.send(
        JSON.stringify({
          v: 1,
          type: "auth",
          org: who.org,
          user: who.user,
          docId: d.id,
          ticket: t.ticket,
        }),
      );
      await next("authenticated");
      return { ws, next };
    }
    try {
      const a = await connect(ctx),
        b = await connect(viewer);
      const doc = new Y.Doc();
      doc.getText("proof").insert(0, "ACK survives restart");
      const update = Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"),
        updateId = randomUUID();
      a.ws.send(JSON.stringify({ v: 1, type: "update", updateId, update }));
      const ack = await a.next("ack");
      assert.equal(ack.updateId, updateId);
      const remote = await b.next("remote");
      const r = new Y.Doc();
      Y.applyUpdate(r, Buffer.from(remote.update, "base64"));
      assert.equal(r.getText("proof").toString(), "ACK survives restart");
      b.ws.send(
        JSON.stringify({
          v: 1,
          type: "update",
          updateId: randomUUID(),
          update,
        }),
      );
      assert.equal((await b.next("error")).code, "READ_ONLY");
      a.ws.close();
      b.ws.close();
      await app.close();
      app = start({
        store: new Store(url),
        port: 0,
        origins: ["http://localhost:3010"],
      });
      await once(app.server, "listening");
      const c = await connect(ctx);
      c.ws.send(JSON.stringify({ v: 1, type: "sync", vector: "AA==" }));
      const sync = await c.next("synced");
      const restored = new Y.Doc();
      Y.applyUpdate(restored, Buffer.from(sync.update, "base64"));
      assert.equal(
        restored.getText("proof").toString(),
        "ACK survives restart",
      );
      const revoked = await connect(viewer);
      await store.grant(ctx, d.id, { userId: viewer.user, role: "REMOVE" });
      const closed = once(revoked.ws, "close");
      revoked.ws.send(JSON.stringify({ v: 1, type: "sync", vector: "AA==" }));
      assert.equal((await closed)[0], 4003);
      const orig = app.metrics.updates;
      assert.ok(orig >= 0);
    } finally {
      for (const c of clients) c.terminate();
      await app.close();
      await store.close();
    }
  },
);
test(
  "hard-killed process retains ACKed update; deferred DB commit failure sends no ACK",
  { skip: !process.env.COLLAB_TEST_DATABASE_URL, timeout: 60000 },
  async () => {
    const url = process.env.COLLAB_TEST_DATABASE_URL,
      store = new Store(url),
      ctx = { org: process.env.TEST_ORG, user: process.env.TEST_OWNER };
    const d = await store.create(ctx, process.env.TEST_PROJECT, {
      title: "Crash and commit failure",
    });
    let child;
    const clients = [];
    async function boot() {
      return new Promise((resolvePort, reject) => {
        let output = "";
        child = spawn(
          process.execPath,
          [resolve(__dirname, "../src/server.cjs")],
          {
            env: {
              ...process.env,
              DATABASE_URL: url,
              COLLAB_PORT: "0",
              WEB_URL: "http://localhost:3010",
            },
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        const timer = setTimeout(
          () => reject(new Error("Child startup timeout")),
          15000,
        );
        child.stdout.on("data", (b) => {
          output += b;
          const m = output.match(/listening on 127\.0\.0\.1:(\d+)/);
          if (m) {
            clearTimeout(timer);
            resolvePort(Number(m[1]));
          }
        });
        child.on("error", reject);
      });
    }
    async function connect(port) {
      const ticket = await store.ticket(ctx, d.id),
        ws = new WebSocket(`ws://127.0.0.1:${port}/collab`, {
          origin: "http://localhost:3010",
        }),
        next = inbox(ws);
      clients.push(ws);
      await once(ws, "open");
      ws.send(
        JSON.stringify({
          v: 1,
          type: "auth",
          org: ctx.org,
          user: ctx.user,
          docId: d.id,
          ticket: ticket.ticket,
        }),
      );
      await next("authenticated");
      return { ws, next };
    }
    const { Pool } = require("../../../packages/collab-store/node_modules/pg");
    const admin = new Pool({
      connectionString: process.env.DATABASE_ADMIN_URL,
    });
    const suffix = randomUUID().replace(/-/g, ""),
      fn = `collab_failure_${suffix}`;
    try {
      let port = await boot(),
        a = await connect(port);
      const doc = new Y.Doc();
      doc.getText("proof").insert(0, "Durably acknowledged before SIGKILL");
      const update = {
        v: 1,
        type: "update",
        updateId: randomUUID(),
        update: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"),
      };
      a.ws.send(JSON.stringify(update));
      await a.next("ack");
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
      port = await boot();
      a = await connect(port);
      a.ws.send(JSON.stringify({ v: 1, type: "sync", vector: "AA==" }));
      const sync = await a.next("synced"),
        recovered = new Y.Doc();
      Y.applyUpdate(recovered, Buffer.from(sync.update, "base64"));
      assert.match(recovered.getText("proof").toString(), /SIGKILL/);
      // The trigger is scoped to this synthetic doc and executes at COMMIT, after
      // both INSERT and UPDATE statements. It proves ACK waits for actual commit.
      await admin.query(
        `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic commit failure'; END $$`,
      );
      await admin.query(
        `CREATE CONSTRAINT TRIGGER ${fn} AFTER INSERT ON collab_update DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.document_id='${d.id}') EXECUTE FUNCTION ${fn}()`,
      );
      let updateBytes;
      doc.on("update", (b) => (updateBytes = b));
      doc.getText("proof").insert(0, "MUST ROLLBACK ");
      const failedId = randomUUID();
      let unexpectedAck = false;
      a.ws.on("message", (b) => {
        const m = JSON.parse(b);
        if (m.type === "ack" && m.updateId === failedId) unexpectedAck = true;
      });
      a.ws.send(
        JSON.stringify({
          v: 1,
          type: "update",
          updateId: failedId,
          update: Buffer.from(updateBytes).toString("base64"),
        }),
      );
      assert.equal((await a.next("error")).code, "DATABASE_UNAVAILABLE");
      assert.equal(unexpectedAck, false);
      const persisted = await store.sync(ctx, d.id, "AA=="),
        check = new Y.Doc();
      Y.applyUpdate(check, Buffer.from(persisted.update, "base64"));
      assert.doesNotMatch(check.getText("proof").toString(), /MUST ROLLBACK/);
    } finally {
      for (const c of clients) c.terminate();
      if (child && child.exitCode === null) {
        const exited = once(child, "exit");
        child.kill("SIGKILL");
        await exited;
      }
      await admin.query(`DROP TRIGGER IF EXISTS ${fn} ON collab_update`);
      await admin.query(`DROP FUNCTION IF EXISTS ${fn}()`);
      await admin.end();
      await store.close();
    }
  },
);
