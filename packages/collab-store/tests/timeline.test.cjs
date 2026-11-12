const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {Pool}=require('pg');
const {Store,materialize}=require('../index.cjs');
const Y=require('yjs');

test('timeline: atomic automatic samples, retry, throttle, batch, immutable preview, pagination and private restore',
 {skip:!process.env.COLLAB_TEST_DATABASE_URL},async()=>{
 const s=new Store(process.env.COLLAB_TEST_DATABASE_URL),admin=new Pool({connectionString:process.env.DATABASE_ADMIN_URL});
 const ctx={org:process.env.TEST_ORG,user:process.env.TEST_OWNER},peer={org:ctx.org,user:process.env.TEST_MEMBER};
 let y;
 try{
  const d=await s.create(ctx,process.env.TEST_PROJECT,{title:'Timeline '+randomUUID(),kind:'MARKDOWN',source:'start'});
  y=materialize(Buffer.from((await s.sync(ctx,d.id,'AA==')).update,'base64'));
  const edit=text=>{const vector=Y.encodeStateVector(y);y.getText('markdown').insert(y.getText('markdown').length,text);return {updateId:randomUUID(),update:Buffer.from(Y.encodeStateAsUpdate(y,vector)).toString('base64')};};
  const a=edit(' A');await s.update(ctx,d.id,a);
  const first=(await s.versions(ctx,d.id))[0];assert.equal(first.source,'AUTO');
  const snapshot=await s.preview(ctx,d.id,first.id);
  await s.update(ctx,d.id,a);await s.update(ctx,d.id,edit(' B'));
  assert.equal((await s.versions(ctx,d.id)).length,1);
  assert.equal((await s.preview(ctx,d.id,first.id)).state,snapshot.state);
  await admin.query("UPDATE collab_version SET created_at=now()-interval '2 minutes' WHERE document_id=$1",[d.id]);
  const results=await s.updateBatch(d.id,[{ctx,input:edit(' C')},{ctx,input:edit(' D')}]);
  assert.ok(results.every(r=>r.ok));
  const entries=await s.versions(ctx,d.id);assert.equal(entries.length,2);assert.equal(entries[0].seq,results[1].seq);
  const older=await s.versions(ctx,d.id,entries[0].id);assert.deepEqual(older.map(v=>v.id),[first.id]);
  const named=randomUUID();await s.version(ctx,d.id,{id:named,name:'Final'});
  assert.equal((await s.preview(ctx,d.id,named)).source,'MANUAL');
  const copy=await s.restore(ctx,d.id,first.id,{id:randomUUID()});
  const restored=materialize(Buffer.from((await s.sync(ctx,copy.id,'AA==')).update,'base64'));
  assert.equal(restored.getText('markdown').toString(),'start A');restored.destroy();
  await assert.rejects(s.versions(peer,d.id),{code:'NOT_FOUND'});
  await s.grant(ctx,d.id,{userId:peer.user,role:'VIEWER'});
  assert.equal((await s.preview(peer,d.id,first.id)).state,snapshot.state);
  await assert.rejects(s.restore(peer,d.id,first.id,{id:randomUUID()}),{code:'READ_ONLY'});
  await assert.rejects(s.detail(peer,copy.id),{code:'NOT_FOUND'});
  await s.grant(ctx,d.id,{userId:peer.user,role:'REMOVE'});
  await assert.rejects(s.preview(peer,d.id,first.id),{code:'NOT_FOUND'});
  await admin.query(`INSERT INTO collab_version(id,organization_id,document_id,name,seq,state,created_by,created_at)
    SELECT gen_random_uuid(),organization_id,document_id,'Older test snapshot',seq,state,created_by,created_at
    FROM collab_version CROSS JOIN generate_series(1,103) WHERE id=$1`,[first.id]);
  const page1=await s.versions(ctx,d.id);assert.equal(page1.length,100);
  const page2=await s.versions(ctx,d.id,page1.at(-1).id);assert.equal(page2.length,6);
  assert.equal(new Set([...page1,...page2].map(v=>v.id)).size,106);
 }finally{y?.destroy();await s.close();await admin.end();}
});
