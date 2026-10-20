const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { performance } = require("node:perf_hooks");
const { randomUUID } = require("node:crypto");
const os = require("node:os");
const WebSocket = require("../apps/collab/node_modules/ws");
const Y = require("../packages/collab-store/node_modules/yjs");
const { Store } = require("../packages/collab-store/index.cjs");
const { start } = require("../apps/collab/src/server.cjs");
const { once } = require("node:events");
const config = JSON.parse(
  readFileSync(".test-runs/collab-local/config.json", "utf8"),
);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const ctx = { org: config.TEST_ORG, user: config.TEST_OWNER };
const duration = Number(process.env.LOAD_SECONDS || 900),
  hot = Number(process.env.HOT_SECONDS || 60);
function stats(a) {
  a.sort((a, b) => a - b);
  const p = (n) => a[Math.min(a.length - 1, Math.floor(a.length * n))] ?? null;
  return { samples: a.length, p50: p(0.5), p95: p(0.95), p99: p(0.99) };
}
async function scenario(name, documents, seconds) {
  const store = new Store(config.DATABASE_URL),
    app = start({
      store: new Store(config.DATABASE_URL),
      port: 0,
      origins: ["http://collab-load.local"],
    });
  await once(app.server, "listening");
  const clients = [],
    acks = [],
    visible = [],
    sent = new Map();
  let errors = 0,
    payloadBytes = 0,
    updates = 0;
  const ids = [];
  try {
    for (let i = 0; i < documents; i++)
      ids.push(
        (
          await store.create(ctx, config.TEST_PROJECT, {
            title: `Load ${name} ${i}`,
          })
        ).id,
      );
    for (let i = 0; i < 20; i++) {
      const id = ids[i % documents],
        ticket = await store.ticket(ctx, id),
        doc = new Y.Doc(),
        ws = new WebSocket(
          `ws://127.0.0.1:${app.server.address().port}/collab`,
          { origin: "http://collab-load.local" },
        );
      const client = { ws, doc, id, index: i };
      clients.push(client);
      let ready;
      const loaded = new Promise((r) => (ready = r));
      ws.on("message", (raw) => {
        const m = JSON.parse(raw);
        if (m.type === "authenticated")
          ws.send(JSON.stringify({ v: 1, type: "sync", vector: "AA==" }));
        if (m.type === "synced" || m.type === "remote") {
          Y.applyUpdate(doc, Buffer.from(m.update, "base64"), "remote");
          if (m.type === "synced") ready();
          if (m.updateId && sent.has(m.updateId))
            visible.push(performance.now() - sent.get(m.updateId));
        }
        if (m.type === "ack") {
          const t = sent.get(m.updateId);
          if (t !== undefined) acks.push(performance.now() - t);
        }
        if (m.type === "error") errors++;
      });
      await once(ws, "open");
      ws.send(
        JSON.stringify({
          v: 1,
          type: "auth",
          docId: id,
          org: ctx.org,
          user: ctx.user,
          ticket: ticket.ticket,
        }),
      );
      await Promise.race([
        loaded,
        delay(15000).then(() => {
          throw new Error("Client did not sync");
        }),
      ]);
      doc.on("update", (u, origin) => {
        if (origin === "remote") return;
        const updateId = randomUUID();
        sent.set(updateId, performance.now());
        payloadBytes += u.length;
        updates++;
        ws.send(
          JSON.stringify({
            v: 1,
            type: "update",
            updateId,
            update: Buffer.from(u).toString("base64"),
          }),
        );
      });
    }
    const startAt = Date.now();
    while (Date.now() - startAt < seconds * 1000) {
      for (const c of clients) {
        const f = c.doc.getXmlFragment("default");
        const p = f.get(0);
        let t = p.toArray().find((n) => n instanceof Y.XmlText);
        if (!t) {
          t = new Y.XmlText();
          p.insert(0, [t]);
        }
        t.insert(t.length, `${c.index}.`);
      }
      await delay(500);
    }
    await delay(3000);
    const ack = stats(acks),
      remote = stats(visible);
    return {
      name,
      seconds,
      documents,
      clients: 20,
      targetEditsPerSecondPerClient: 2,
      updates,
      payloadBytes,
      ack,
      remote,
      errors,
      ackLoss: updates - acks.length,
      targetMet:
        errors === 0 &&
        updates === acks.length &&
        ack.p95 < 500 &&
        remote.p95 !== null &&
        remote.p95 < 300,
    };
  } finally {
    for (const c of clients) c.ws.terminate();
    await app.close();
    await store.close();
  }
}
(async () => {
  mkdirSync("evidence/collaboration", { recursive: true });
  const result = {
    date: new Date().toISOString(),
    node: process.version,
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()[0].model,
    logicalCpus: os.cpus().length,
    memoryGiB: Math.round(os.totalmem() / 1024 ** 3),
    network:
      "Windows loopback, no artificial RTT; simultaneous development workload",
    scenarios: [],
  };
  for (const [name, docs, seconds] of [
    ["multi-room", 10, duration],
    ["hot-room", 1, hot],
  ]) {
    console.log(`Starting ${name}: 20 clients, ${seconds}s`);
    result.scenarios.push(await scenario(name, docs, seconds));
    writeFileSync(
      "evidence/collaboration/load-results.json",
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result.scenarios.at(-1)));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
