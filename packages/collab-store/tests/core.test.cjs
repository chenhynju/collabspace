const { test } = require("node:test");
const assert = require("node:assert/strict");
const Y = require("yjs");
const { decoded, copyContent, materialize } = require("../index.cjs");
test("concurrent, repeated and reordered Yjs updates converge semantically", () => {
  const seed = new Y.Doc();
  seed.getText("text").insert(0, "remote team");
  const initial = Y.encodeStateAsUpdate(seed);
  const a = new Y.Doc(),
    b = new Y.Doc();
  Y.applyUpdate(a, initial);
  Y.applyUpdate(b, initial);
  const updates = [];
  a.on("update", (u) => updates.push(u));
  b.on("update", (u) => updates.push(u));
  a.getText("text").insert(0, "A: ");
  b.getText("text").insert(0, "B: ");
  const x = new Y.Doc(),
    y = new Y.Doc();
  Y.applyUpdate(x, initial);
  Y.applyUpdate(y, initial);
  for (const u of updates) Y.applyUpdate(x, u);
  for (const u of [...updates].reverse()) {
    Y.applyUpdate(y, u);
    Y.applyUpdate(y, u);
  }
  assert.equal(x.getText("text").toString(), y.getText("text").toString());
  assert.match(x.getText("text").toString(), /A:/);
  assert.match(x.getText("text").toString(), /B:/);
});
test("restoring rich text creates independent CRDT identities and content", () => {
  const old = new Y.Doc();
  const p = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  p.insert(0, [t]);
  t.insert(0, "Accepted requirements");
  old.getXmlFragment("default").insert(0, [p]);
  const fresh = materialize(copyContent(Y.encodeStateAsUpdate(old)));
  assert.equal(
    fresh.getXmlFragment("default").toString(),
    old.getXmlFragment("default").toString(),
  );
  assert.notDeepEqual(Y.encodeStateVector(fresh), Y.encodeStateVector(old));
  fresh.getXmlFragment("default").delete(0, 1);
  assert.match(
    old.getXmlFragment("default").toString(),
    /Accepted requirements/,
  );
});
test("reject oversized and malformed update envelopes before decode", () => {
  assert.throws(() => decoded("!!!!"), { code: "INVALID_UPDATE" });
  assert.throws(() => decoded(Buffer.alloc(300000).toString("base64")), {
    code: "INVALID_UPDATE",
  });
  assert.deepEqual([...decoded("AA==")], [0]);
});
test("local undo preserves remote edits and relative anchors survive insertion", () => {
  const a = new Y.Doc();
  const text = a.getText("text");
  text.insert(0, "Hello");
  const b = new Y.Doc();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  const origin = {};
  const undo = new Y.UndoManager(text, { trackedOrigins: new Set([origin]) });
  a.transact(() => text.insert(5, " local"), origin);
  const anchor = Y.createRelativePositionFromTypeIndex(text, 1);
  b.getText("text").insert(0, "remote ");
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b), "remote");
  undo.undo();
  assert.equal(text.toString(), "remote Hello");
  assert.equal(
    Y.createAbsolutePositionFromRelativePosition(anchor, a).index,
    8,
  );
});
