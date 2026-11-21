const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { randomUUID } = require("node:crypto");
const vm = require("node:vm");
const ts = require("typescript");

const exports_ = {};
vm.runInNewContext(ts.transpileModule(
  readFileSync(join(__dirname, "../src/lib/board-agent-plan.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText, { exports: exports_, require, crypto: { randomUUID } });
const { compileBoardPlan } = exports_;
const shape = { type: "rect", geometry: { x: 0, y: 0, w: 100, h: 100 },
  text: "Original", fill: "#ffffff", order: 1 };

test("whiteboard Agent adds shapes, connects and updates text with auto layout", () => {
  const id = randomUUID();
  const result = compileBoardPlan("```json\n" + JSON.stringify({ ops: [
    { op: "add", ref: "n1", type: "rect", text: "开始" },
    { op: "add", ref: "n2", type: "diamond", text: "通过？" },
    { op: "connect", from: "n1", to: "n2" },
    { op: "update", ref: "s1", text: "已更新" },
  ] }) + "\n```", { [id]: shape }, [id]);
  assert.equal(result.changes.size, 4);
  assert.equal(result.changes.get(id).text, "已更新");
  const added = [...result.changes].filter(([, value]) => value.type !== "connector");
  assert.equal(added.length, 3);
  assert.equal(added[1][1].geometry.x, 340);
  const wire = [...result.changes].find(([, value]) => value.type === "connector");
  assert.ok(wire);
  assert.equal(wire[1].binding.from, added[0][0]);
  assert.equal(wire[1].binding.to, added[1][0]);
  for (const invalid of [
    { op: "add", ref: "s1", type: "rect", text: "bad" },
    { op: "add", ref: "n9", type: "connector", text: "bad" },
    { op: "update", ref: "s9", text: "bad" },
    { op: "delete", ref: "s1" },
  ]) {
    assert.throws(() => compileBoardPlan(JSON.stringify({ ops: [invalid] }), { [id]: shape }, [id]));
  }
});

test("whiteboard Agent compiles a bounded note, move and connection with stable targets", () => {
  const id = randomUUID();
  const result = compileBoardPlan(JSON.stringify({ ops: [
    { op: "note", ref: "n1", text: "Follow up", x: 100, y: 100 },
    { op: "move", ref: "s1", x: 20, y: 40 },
    { op: "connect", from: "s1", to: "n1" },
  ] }), { [id]: shape }, [id]);
  assert.equal(result.changes.size, 3);
  assert.equal(result.changes.get(id).geometry.x, 20);
  const [note, move, wire] = [...result.changes];
  assert.equal(move[0], id);
  assert.equal(wire[1].binding.from, id);
  assert.equal(wire[1].binding.to, note[0]);
  assert.equal(shape.geometry.x, 0);
  for (const invalid of [
    { op: "move", ref: "s2", x: 0, y: 20 },
    { op: "connect", from: "s1", to: "s1" },
    { op: "delete", ref: "s1" },
    { op: "note", ref: "s1", text: "bad", x: 0, y: 0 },
  ]) {
    assert.throws(() => compileBoardPlan(JSON.stringify({ ops: [invalid] }), { [id]: shape }, [id]));
  }
});
