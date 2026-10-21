const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const Y=require('yjs'),{Store,materialize,copyContent}=require('../index.cjs');
test('Markdown native source: same-position CRDT convergence and independent history lineage',()=>{
 const a=new Y.Doc();a.getText('markdown').insert(0,'# 原生源码\n');const b=materialize(Y.encodeStateAsUpdate(a));
 a.getText('markdown').insert(2,'甲');b.getText('markdown').insert(2,'乙');const ua=Y.encodeStateAsUpdate(a),ub=Y.encodeStateAsUpdate(b);Y.applyUpdate(a,ub);Y.applyUpdate(b,ua);
 assert.equal(a.getText('markdown').toString(),b.getText('markdown').toString());assert.match(a.getText('markdown').toString(),/甲/);assert.match(a.getText('markdown').toString(),/乙/);
 const c=materialize(copyContent(Y.encodeStateAsUpdate(a),'MARKDOWN'));assert.equal(c.getText('markdown').toString(),a.getText('markdown').toString());assert.notDeepEqual(Y.encodeStateVector(c),Y.encodeStateVector(a));for(const d of[a,b,c])d.destroy();
});
test('real PG Markdown initial import, editor/viewer ACL, strict roots, bounds and private version restore',{skip:!process.env.COLLAB_TEST_DATABASE_URL},async()=>{
 const s=new Store(process.env.COLLAB_TEST_DATABASE_URL),ctx={org:process.env.TEST_ORG,user:process.env.TEST_OWNER},peer={org:ctx.org,user:process.env.TEST_MEMBER};
 const source='# UTF-8原文\n\n|列|值|\n|-|-|\n|甲|乙|\n\n```mermaid\nflowchart LR\n A --> B\n```\n';
 const send=doc=>({updateId:randomUUID(),update:Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64')});
 try{
  const file=await s.create(ctx,process.env.TEST_PROJECT,{title:'source.md',kind:'MARKDOWN',source});assert.equal(file.kind,'MARKDOWN');
  const doc=materialize(Buffer.from((await s.sync(ctx,file.id,'AA==')).update,'base64'));assert.equal(doc.getText('markdown').toString(),source);
  await s.grant(ctx,file.id,{userId:peer.user,role:'VIEWER'});doc.getText('markdown').insert(0,'Editor\n');await assert.rejects(s.update(peer,file.id,send(doc)),{code:'READ_ONLY'});await s.update(ctx,file.id,send(doc));
  const version=randomUUID();await s.version(ctx,file.id,{id:version,name:'Native Markdown'});const copy=await s.restore(ctx,file.id,version,{id:randomUUID()});assert.equal(copy.kind,'MARKDOWN');
  const saved=materialize(Buffer.from((await s.sync(ctx,copy.id,'AA==')).update,'base64'));assert.equal(saved.getText('markdown').toString(),doc.getText('markdown').toString());saved.destroy();await assert.rejects(s.detail(peer,copy.id),{code:'NOT_FOUND'});
  for(const change of[d=>d.getText('mermaid').insert(0,'rogue'),d=>d.getText('markdown').insertEmbed(0,{script:'bad'}),d=>d.getText('markdown').insert(0,'x'.repeat(64000))]){
   const bad=materialize(Y.encodeStateAsUpdate(doc));change(bad);await assert.rejects(s.update(ctx,file.id,send(bad)),{code:'INVALID_MARKDOWN'});bad.destroy();
  }
  doc.destroy();await assert.rejects(s.create(ctx,process.env.TEST_PROJECT,{title:'binary.md',kind:'MARKDOWN',source:'nul\0bytes'}),{code:'INVALID_MARKDOWN'});
 }finally{await s.close();}
});
