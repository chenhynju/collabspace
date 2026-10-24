const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),Y=require('yjs'),{Store,materialize}=require('../index.cjs');
test('formula content: durable save, viewer rejection, immutable version and private restored copy',{skip:!process.env.COLLAB_TEST_DATABASE_URL},async()=>{
 const s=new Store(process.env.COLLAB_TEST_DATABASE_URL),ctx={org:process.env.TEST_ORG,user:process.env.TEST_OWNER},viewer={org:ctx.org,user:process.env.TEST_MEMBER};
 try{
 const d=await s.create(ctx,process.env.TEST_PROJECT,{title:'Formula '+randomUUID()});await s.grant(ctx,d.id,{userId:viewer.user,role:'VIEWER'});
 const content=new Y.Doc(),node=new Y.XmlElement('documentFormula');node.setAttribute('latex','\\int_0^1 x^2 dx');content.getXmlFragment('default').insert(0,[node]);
 const packet={updateId:randomUUID(),update:Buffer.from(Y.encodeStateAsUpdate(content)).toString('base64')};await assert.rejects(s.update(viewer,d.id,packet),{code:'READ_ONLY'});await s.update(ctx,d.id,packet);
 const version=randomUUID();await s.version(ctx,d.id,{id:version,name:'Formula source'});const copy=await s.restore(ctx,d.id,version,{id:randomUUID()});
 const state=materialize(Buffer.from((await s.sync(ctx,copy.id,'AA==')).update,'base64'));assert.equal(state.getXmlFragment('default').toArray().find(n=>n.nodeName==='documentFormula').getAttribute('latex'),'\\int_0^1 x^2 dx');
 await assert.rejects(s.sync(viewer,copy.id,'AA=='),{code:'NOT_FOUND'});content.destroy();state.destroy();
 }finally{await s.close();}
});
