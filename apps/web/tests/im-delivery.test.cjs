const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function store() {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/store/im.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(compiled, { exports, require });
  return exports.useImStore;
}
for (const order of ['POST before realtime', 'realtime before POST']) {
  test(`one durable message is rendered once: ${order}`, () => {
    const im = store();
    const message = { id: 'server-1', senderId: 'alice', type: 'TEXT', content: 'hello', createdAt: '2026-10-20T00:00:00Z' };
    const rest = { ...message }, realtime = { ...message, senderName: 'Alice' };
    const deliveries = order.startsWith('POST') ? [rest, realtime] : [realtime, rest];
    for (const m of [...deliveries, realtime]) im.getState().appendMessage(m);
    assert.equal(im.getState().messages.length, 1);
    assert.equal(im.getState().messages[0].id, message.id);
    // A new ID with the same text is a second legitimate message.
    im.getState().appendMessage({ ...message, id: 'server-2' });
    assert.equal(im.getState().messages.length, 2);
    im.getState().setMessages([]);
    im.getState().appendMessage(message);
    assert.equal(im.getState().messages.length, 1);
  });
}
