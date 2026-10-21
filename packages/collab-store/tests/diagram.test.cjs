const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const {
  validateBoard,
  connectorPath,
  layoutMindmap,
} = require("@collabspace/protocol");
const node = (id, parent) => ({
  id,
  type: "mind",
  geometry: { x: 0, y: 0, w: 180, h: 60 },
  text: "topic",
  fill: "#dbeafe",
  order: 1,
  ...(parent ? { parent } : {}),
});
test("mind maps lay out deterministically with parents to the left and siblings apart", () => {
  const a = randomUUID(),
    b = randomUUID(),
    c = randomUUID(),
    d = randomUUID();
  const nodes = [node(a), node(b, a), node(c, a), node(d, b)];
  validateBoard(Object.fromEntries(nodes.map(({ id, ...s }) => [id, s])));
  const result = layoutMindmap(nodes);
  assert.deepEqual(result, layoutMindmap([...nodes].reverse()));
  assert.ok(result[b].x > result[a].x);
  assert.ok(result[d].x > result[b].x);
  assert.notEqual(result[b].y, result[c].y);
  const mixed = layoutMindmap([
    ...nodes,
    {
      ...node(randomUUID()),
      type: "rect",
      geometry: { x: 20, y: 20, w: 800, h: 100 },
    },
  ]);
  assert.ok(mixed[a].x > 820);
});
test("connectors follow live geometry and invalid graph references are rejected without blocking deletion", () => {
  const a = randomUUID(),
    b = randomUUID(),
    edge = randomUUID();
  const one = node(a),
    two = node(b, a);
  const connector = {
    ...node(edge),
    type: "connector",
    binding: { from: a, to: b, style: "elbow" },
  };
  delete connector.id;
  const withoutId = ({ id, ...rest }) => rest;
  validateBoard({
    [a]: withoutId(one),
    [b]: withoutId(two),
    [edge]: connector,
  });
  validateBoard({ [a]: withoutId(one), [edge]: connector }); // concurrent deletion leaves a hidden dangling edge
  assert.throws(() =>
    validateBoard({
      [a]: { ...withoutId(one), parent: b },
      [b]: withoutId(two),
    }),
  );
  assert.throws(() =>
    validateBoard({
      [edge]: { ...connector, binding: { from: a, to: a, style: "elbow" } },
    }),
  );
  assert.throws(() =>
    validateBoard({
      [edge]: {
        ...connector,
        binding: { from: a, to: b, style: "javascript" },
      },
    }),
  );
  const from = { x: 0, y: 0, w: 100, h: 100 },
    to = { x: 300, y: 0, w: 100, h: 100 };
  assert.equal(connectorPath(from, to, "straight"), "M 100 50 L 300 50");
  assert.notEqual(
    connectorPath(from, to),
    connectorPath(from, { ...to, y: 200 }),
  );
  assert.equal(connectorPath(from, from), "");
  assert.ok(
    connectorPath(
      { ...from, type: "diamond" },
      { ...to, y: 300 },
      "straight",
    ).startsWith("M 75 75"),
  );
  const orphan = layoutMindmap([two]);
  assert.ok(orphan[b]);
});
const { parseMermaid, exportMermaid } = require("@collabspace/protocol");
test("bounded Mermaid flowchart and mindmap imports retain graph semantics through export", () => {
  const flow = parseMermaid(
    'flowchart LR\n A["开始"] --> B{"通过？"}\n B -->|是| C((交付))\n C --> A',
  );
  assert.equal(flow.filter((n) => n.type === "connector").length, 3);
  validateBoard(Object.fromEntries(flow.map(({ id, ...s }) => [id, s])));
  const restored = parseMermaid(exportMermaid(flow));
  assert.deepEqual(
    restored.filter((n) => n.type !== "connector").map((n) => n.text),
    ["开始", "通过？", "交付"],
  );
  const mind = parseMermaid(
    "mindmap\n root((项目))\n   需求\n     功能\n   验收",
  );
  assert.equal(mind.filter((n) => n.parent).length, 3);
  mind[1].text = '文字 [含] (括号) | &quot; "中文"';
  const again = parseMermaid(exportMermaid(mind, true));
  assert.deepEqual(
    again.map((n) => n.text),
    mind.map((n) => n.text),
  );
  for (const bad of [
    'flowchart LR\nclick A "javascript:alert(1)"',
    "flowchart LR\nA[<img>]",
    "%%{init: {}}%%\nflowchart LR",
    "mindmap\n根\n另一个根",
    "flowchart LR\nA --> A",
    "x".repeat(32001),
  ])
    assert.throws(() => parseMermaid(bad));
});
test(
  "diagram persistence uses the same real ACL/version boundary and rejects a cyclic graph without commit",
  { skip: !process.env.COLLAB_TEST_DATABASE_URL },
  async () => {
    const { Store, materialize } = require("../index.cjs"),
      Y = require("yjs");
    const s = new Store(process.env.COLLAB_TEST_DATABASE_URL),
      ctx = { org: process.env.TEST_ORG, user: process.env.TEST_OWNER },
      viewer = { org: ctx.org, user: process.env.TEST_MEMBER };
    const d = await s.create(ctx, process.env.TEST_PROJECT, {
      title: "Diagram durable " + randomUUID(),
      kind: "BOARD",
    });
    const y = new Y.Doc();
    let copy;
    try {
      const items = parseMermaid("mindmap\n root((交付))\n   开发\n   验收");
      for (const { id, ...data } of items)
        y.getMap("shapes").set(id, new Y.Map(Object.entries(data)));
      const input = () => ({
        updateId: randomUUID(),
        update: Buffer.from(Y.encodeStateAsUpdate(y)).toString("base64"),
      });
      await s.grant(ctx, d.id, { userId: viewer.user, role: "VIEWER" });
      await assert.rejects(s.update(viewer, d.id, input()), {
        code: "READ_ONLY",
      });
      await s.update(ctx, d.id, input());
      const before = await s.sync(ctx, d.id, "AA==");
      const version = randomUUID();
      await s.version(ctx, d.id, { id: version, name: "Diagram milestone" });
      copy = await s.restore(ctx, d.id, version, { id: randomUUID() });
      await assert.rejects(s.detail(viewer, copy.id), { code: "NOT_FOUND" });
      const fresh = materialize(
        Buffer.from((await s.sync(ctx, copy.id, "AA==")).update, "base64"),
      );
      assert.deepEqual(
        fresh.getMap("shapes").toJSON(),
        y.getMap("shapes").toJSON(),
      );
      assert.notDeepEqual(Y.encodeStateVector(fresh), Y.encodeStateVector(y));
      fresh.destroy();
      y.getMap("shapes").get(items[0].id).set("parent", items[1].id);
      const bad = await s.updateBatch(d.id, [{ ctx, input: input() }]);
      assert.equal(bad[0].ok, false);
      assert.equal(bad[0].error.code, "INVALID_BOARD");
      assert.equal((await s.sync(ctx, d.id, "AA==")).seq, before.seq);
    } finally {
      y.destroy();
      await s.close();
    }
  },
);
