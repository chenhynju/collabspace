const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { randomUUID } = require("node:crypto");
const { shapeCatalog, validateBoard } = require("@collabspace/protocol");
const { Store, materialize } = require("../index.cjs"),
  Y = require("yjs");
function drawing() {
  const d = new Y.Doc();
  for (const s of shapeCatalog)
    d.getMap("shapes").set(
      randomUUID(),
      new Y.Map(
        Object.entries({
          type: s.type,
          geometry: { x: 20, y: 30, w: 180, h: 120 },
          text: s.label,
          fill: "#dbeafe",
          order: 1,
        }),
      ),
    );
  return d;
}
test("catalog entries have distinct supported types and keep the bounded schema", () => {
  assert.equal(shapeCatalog.length, 8);
  assert.equal(new Set(shapeCatalog.map((s) => s.type)).size, 8);
  const d = drawing();
  validateBoard(d.getMap("shapes").toJSON());
  assert.throws(() =>
    validateBoard({
      [randomUUID()]: {
        type: "iframe",
        geometry: { x: 0, y: 0, w: 100, h: 100 },
        text: "",
        fill: "#ffffff",
        order: 1,
      },
    }),
  );
  d.destroy();
});
test(
  "all catalog shapes persist and restore through the real board permission boundary",
  { skip: !process.env.COLLAB_TEST_DATABASE_URL },
  async () => {
    const s = new Store(process.env.COLLAB_TEST_DATABASE_URL),
      ctx = { org: process.env.TEST_ORG, user: process.env.TEST_OWNER },
      peer = { org: ctx.org, user: process.env.TEST_MEMBER };
    const d = drawing();
    try {
      const b = await s.create(ctx, process.env.TEST_PROJECT, {
        title: "Palette " + randomUUID(),
        kind: "BOARD",
      });
      const input = {
        updateId: randomUUID(),
        update: Buffer.from(Y.encodeStateAsUpdate(d)).toString("base64"),
      };
      await s.grant(ctx, b.id, { userId: peer.user, role: "VIEWER" });
      await assert.rejects(s.update(peer, b.id, input), { code: "READ_ONLY" });
      await s.update(ctx, b.id, input);
      const id = randomUUID();
      await s.version(ctx, b.id, { id, name: "Catalog" });
      const copy = await s.restore(ctx, b.id, id, { id: randomUUID() });
      await assert.rejects(s.detail(peer, copy.id), { code: "NOT_FOUND" });
      const state = materialize(
        Buffer.from((await s.sync(ctx, copy.id, "AA==")).update, "base64"),
      );
      assert.deepEqual(
        state.getMap("shapes").toJSON(),
        d.getMap("shapes").toJSON(),
      );
      state.destroy();
    } finally {
      d.destroy();
      await s.close();
    }
  },
);
