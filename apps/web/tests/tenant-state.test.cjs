const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function fixture() {
  const pending = [];
  const values = new Map([['current_org_id', 'A']]);
  const localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  function load(file, dependencies) {
    const exports = {};
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInNewContext(compiled, { exports, localStorage, window: { dispatchEvent() {} }, Event: class Event {}, require: id => dependencies[id] ?? require(id) });
    return exports;
  }
  const im = load('src/store/im.ts', {});
  const auth = load('src/store/auth.ts', {
    './im': im,
    '@/lib/document-provider': { clearDocumentCaches: async () => {} },
    '@/lib/api': { api: { get: () => new Promise(resolve => pending.push(resolve)) } },
  });
  return { auth: auth.useAuthStore, im: im.useImStore, pending };
}

test('tenant switch immediately clears cached messages and permissions; logout also clears IM', async () => {
  const f = fixture();
  f.im.setState({ conversations: [{ id: 'private-A' }], currentConversationId: 'private-A', messages: [{ content: 'A only' }] });
  f.auth.setState({ perms: ['A:read'], roleKeys: ['OWNER'] });
  const switched = f.auth.getState().setCurrentOrg('B');
  assert.equal(f.auth.getState().currentOrgId, 'B');
  assert.equal(f.auth.getState().perms.length, 0);
  assert.equal(f.auth.getState().roleKeys.length, 0);
  assert.equal(f.im.getState().conversations.length, 0);
  assert.equal(f.im.getState().messages.length, 0);
  assert.equal(f.im.getState().currentConversationId, null);
  f.pending.shift()({ data: { perms: ['B:read'], roleKeys: ['MEMBER'] } });
  await switched;
  f.im.setState({ messages: [{ content: 'B only' }] });
  f.auth.getState().logout();
  assert.equal(f.im.getState().messages.length, 0);
  assert.equal(f.auth.getState().currentOrgId, null);
});

test('late response from B cannot overwrite A permissions after A-B-A switch', async () => {
  const f = fixture();
  const switchB = f.auth.getState().setCurrentOrg('B');
  const switchA = f.auth.getState().setCurrentOrg('A');
  f.pending[1]({ data: { perms: ['A:read'], roleKeys: ['MEMBER'] } });
  await switchA;
  f.pending[0]({ data: { perms: ['B:admin'], roleKeys: ['OWNER'] } });
  await switchB;
  assert.equal(f.auth.getState().currentOrgId, 'A');
  assert.equal(f.auth.getState().perms[0], 'A:read');
  assert.equal(f.auth.getState().roleKeys[0], 'MEMBER');
});

test('new login discards previous identity, organization and permissions before profile load',async()=>{
 const f=fixture();f.auth.setState({token:'old',user:{id:'old'},organizations:[{id:'A'}],perms:['*'],roleKeys:['OWNER']});f.im.setState({messages:[{content:'private'}]});f.auth.getState().setToken('new');assert.equal(f.auth.getState().currentOrgId,null);assert.equal(f.auth.getState().user,null);assert.equal(f.auth.getState().perms.length,0);assert.equal(f.im.getState().messages.length,0);
 const loaded=f.auth.getState().loadProfile();f.pending.shift()({data:{id:'new',email:'new@test.dev',name:'new',organizations:[{id:'B',status:'ACTIVE',membershipStatus:'ACTIVE'}]}});await new Promise(r=>setImmediate(r));assert.equal(f.auth.getState().currentOrgId,'B');f.pending.shift()({data:{perms:['B:read'],roleKeys:['OWNER']}});await loaded;assert.equal(f.auth.getState().roleKeys[0],'OWNER');
});
test('reload repairs a foreign cached organization and ignores a suspended membership',async()=>{
 const f=fixture();f.auth.setState({token:'user'});const loaded=f.auth.getState().loadProfile();f.pending.shift()({data:{id:'user',organizations:[{id:'A',status:'ACTIVE',membershipStatus:'SUSPENDED'},{id:'B',status:'ACTIVE',membershipStatus:'ACTIVE'}]}});await new Promise(r=>setImmediate(r));assert.equal(f.auth.getState().currentOrgId,'B');f.pending.shift()({data:{perms:['B:read'],roleKeys:['MEMBER']}});await loaded;assert.equal(f.auth.getState().perms[0],'B:read');
});
test('old-account profile and organization replies cannot overwrite a new login',async()=>{
 const f=fixture();f.auth.setState({token:'old'});const old=f.auth.getState().loadProfile();f.auth.getState().setToken('new');f.pending.shift()({data:{id:'old',organizations:[{id:'A',status:'ACTIVE',membershipStatus:'ACTIVE'}]}});await old;assert.equal(f.auth.getState().user,null);assert.equal(f.auth.getState().currentOrgId,null);
 f.auth.setState({token:'old',currentOrgId:'A'});const context=f.auth.getState().loadOrgContext();f.auth.setState({token:'new',currentOrgId:'A',perms:['new:read']});f.pending.shift()({data:{perms:['*'],roleKeys:['OWNER']}});await context;assert.equal(f.auth.getState().perms[0],'new:read');
});
