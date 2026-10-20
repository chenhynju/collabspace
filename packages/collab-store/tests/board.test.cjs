const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const Y = require("yjs");
const { materialize, copyContent, Store } = require("../index.cjs");
const { validateBoard, frame } = require("@collabspace/protocol");
const shape = () =>
  new Y.Map(
    Object.entries({
      type: "note",
      geometry: { x: 20, y: 30, w: 180, h: 120 },
      text: "Plan",
      fill: "#fef3c7",
      order: 1,
    }),
  );
test("whiteboard concurrent properties converge; delete beats offline edits; undo excludes remote operations; copies have fresh lineage", () => {
  const a = new Y.Doc(),
    id = randomUUID();
  a.getMap("shapes").set(id, shape());
  const b = materialize(Y.encodeStateAsUpdate(a));
  const local = {};
  const undo = new Y.UndoManager(a.getMap("shapes"), {
    trackedOrigins: new Set([local]),
  });
  a.transact(
    () =>
      a
        .getMap("shapes")
        .get(id)
        .set("geometry", { x: 100, y: 90, w: 200, h: 150 }),
    local,
  );
  b.getMap("shapes").get(id).set("text", "Remote text");
  const ua = Y.encodeStateAsUpdate(a),
    ub = Y.encodeStateAsUpdate(b);
  Y.applyUpdate(a, ub, "remote");
  Y.applyUpdate(b, ua, "remote");
  assert.deepEqual(a.getMap("shapes").toJSON(), b.getMap("shapes").toJSON());
  assert.equal(a.getMap("shapes").get(id).get("text"), "Remote text");
  undo.undo();
  assert.equal(a.getMap("shapes").get(id).get("text"), "Remote text");
  assert.equal(a.getMap("shapes").get(id).get("geometry").x, 20);
  const fresh = materialize(copyContent(Y.encodeStateAsUpdate(b), "BOARD"));
  assert.deepEqual(
    fresh.getMap("shapes").toJSON(),
    b.getMap("shapes").toJSON(),
  );
  assert.notDeepEqual(Y.encodeStateVector(fresh), Y.encodeStateVector(b));
  a.getMap("shapes").delete(id);
  b.getMap("shapes").get(id).set("text", "Offline edit");
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  assert.equal(a.getMap("shapes").has(id), false);
  assert.equal(b.getMap("shapes").has(id), false);
  assert.equal(fresh.getMap("shapes").size, 1);
  undo.destroy();
  for (const d of [a, b, fresh]) d.destroy();
});
test("whiteboard payload and presence reject unbounded values", () => {
  const id = randomUUID();
  const valid = {
    type: "rect",
    geometry: { x: 0, y: 0, w: 180, h: 120 },
    text: "safe",
    fill: "#ffffff",
    order: 1,
  };
  validateBoard({ [id]: valid });
  assert.throws(() =>
    validateBoard({
      [id]: { ...valid, geometry: { ...valid.geometry, x: Infinity } },
    }),
  );
  assert.throws(() =>
    validateBoard({ [id]: { ...valid, text: "x".repeat(2001) } }),
  );
  assert.throws(() =>
    validateBoard(
      Object.fromEntries(
        Array.from({ length: 501 }, () => [randomUUID(), valid]),
      ),
    ),
  );
  assert.throws(() =>
    frame.parse({
      v: 1,
      type: "presence",
      selection: null,
      cursor: { x: 10001, y: 0 },
    }),
  );
  assert.equal(
    frame.parse({
      v: 1,
      type: "presence",
      selection: null,
      cursor: { x: 10, y: 20 },
    }).cursor.y,
    20,
  );
});
test(
  "whiteboard real RLS storage preserves kind, rejects viewers and invalid shapes, and restores a private copy",
  { skip: !process.env.COLLAB_TEST_DATABASE_URL },
  async () => {
    const s = new Store(process.env.COLLAB_TEST_DATABASE_URL),
      ctx = { org: process.env.TEST_ORG, user: process.env.TEST_OWNER },
      peer = { org: ctx.org, user: process.env.TEST_MEMBER };
    const d = await s.create(ctx, process.env.TEST_PROJECT, {
      title: "Board acceptance " + randomUUID(),
      kind: "BOARD",
    });
    try {
      assert.equal(d.kind, "BOARD");
      const y = new Y.Doc();
      const id = randomUUID();
      y.getMap("shapes").set(id, shape());
      const input = {
        updateId: randomUUID(),
        update: Buffer.from(Y.encodeStateAsUpdate(y)).toString("base64"),
      };
      await s.grant(ctx, d.id, { userId: peer.user, role: "VIEWER" });
      await assert.rejects(s.update(peer, d.id, input), { code: "READ_ONLY" });
      await s.update(ctx, d.id, input);
      const before = await s.sync(ctx, d.id, "AA==");
      const bad = new Y.Doc();
      bad.getMap("shapes").set(randomUUID(), { invalid: true });
      const rejected = await s.updateBatch(d.id, [
        {
          ctx,
          input: {
            updateId: randomUUID(),
            update: Buffer.from(Y.encodeStateAsUpdate(bad)).toString("base64"),
          },
        },
      ]);
      assert.equal(rejected[0].ok, false);
      assert.equal(rejected[0].error.code, "INVALID_BOARD");
      const after = await s.sync(ctx, d.id, "AA==");
      assert.equal(after.seq, before.seq);
      const versionId = randomUUID();
      await s.version(ctx, d.id, { id: versionId, name: "Board milestone" });
      const copy = await s.restore(ctx, d.id, versionId, { id: randomUUID() });
      assert.equal(copy.kind, "BOARD");
      await assert.rejects(s.detail(peer, copy.id), { code: "NOT_FOUND" });
      const copied = materialize(
        Buffer.from((await s.sync(ctx, copy.id, "AA==")).update, "base64"),
      );
      assert.equal(copied.getMap("shapes").size, 1);
      copied.destroy();
      bad.destroy();
      y.destroy();
    } finally {
      await s.close();
    }
  },
);
