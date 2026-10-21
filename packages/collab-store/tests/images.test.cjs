const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),Y=require('yjs'),{Store,materialize}=require('../index.cjs');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
test('parallel uploads serialize document image count quota',{skip:!process.env.COLLAB_TEST_DATABASE_URL},async()=>{
 const s=new Store(process.env.COLLAB_TEST_DATABASE_URL),ctx={org:process.env.TEST_ORG,user:process.env.TEST_OWNER};
 try{
  const d=await s.create(ctx,process.env.TEST_PROJECT,{title:'Quota '+randomUUID()});
  const results=await Promise.allSettled(Array.from({length:21},()=>s.addImage(ctx,d.id,png)));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,20);
  assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.code==='IMAGE_QUOTA_EXCEEDED').length,1);
 }finally{await s.close();}
});
test('document images: real ACL, tenant RLS, forged reference rejection, immutable version and private recovery',{skip:!process.env.COLLAB_TEST_DATABASE_URL},async()=>{
 const s=new Store(process.env.COLLAB_TEST_DATABASE_URL),ctx={org:process.env.TEST_ORG,user:process.env.TEST_OWNER},peer={org:ctx.org,user:process.env.TEST_MEMBER},alien={org:process.env.TEST_OTHER_ORG,user:process.env.TEST_OTHER_USER};
 try{
  await s.assertRuntime();
  const d=await s.create(ctx,process.env.TEST_PROJECT,{title:'Image '+randomUUID()}),other=await s.create(ctx,process.env.TEST_PROJECT,{title:'Other image '+randomUUID()});
  await s.grant(ctx,d.id,{userId:peer.user,role:'VIEWER'});
  await assert.rejects(s.addImage(peer,d.id,png),{code:'READ_ONLY'});
  await assert.rejects(s.addImage(ctx,d.id,Buffer.from('<svg/>')),{code:'IMAGE_TYPE_NOT_ALLOWED'});
  await assert.rejects(s.addImage(ctx,d.id,Buffer.alloc(5242881)),{code:'IMAGE_TOO_LARGE'});
  const asset=await s.addImage(ctx,d.id,png);assert.equal(asset.mime,'image/png');
  assert.deepEqual((await s.image(peer,d.id,asset.id)).bytes,png);
  await assert.rejects(s.image(alien,d.id,asset.id),{code:'NOT_FOUND'});
  await assert.rejects(s.image(ctx,other.id,asset.id),{code:'NOT_FOUND'});
  await s.tx(alien,async c=>assert.equal((await c.query('SELECT id FROM collab_image WHERE organization_id=$1',[ctx.org])).rowCount,0));
  const content=new Y.Doc(),node=new Y.XmlElement('documentImage');
  for(const [key,value]of Object.entries({assetId:asset.id,alt:'sample',caption:'Shared figure',width:75}))node.setAttribute(key,value);
  content.getXmlFragment('default').insert(0,[node]);
  const update=()=>({updateId:randomUUID(),update:Buffer.from(Y.encodeStateAsUpdate(content)).toString('base64')});
  await assert.rejects(s.update(ctx,other.id,update()),{code:'INVALID_DOCUMENT_IMAGE'});
  await s.update(ctx,d.id,update());
  const version=randomUUID();await s.version(ctx,d.id,{id:version,name:'With image'});
  const copy=await s.restore(ctx,d.id,version,{id:randomUUID()});
  assert.deepEqual((await s.image(ctx,copy.id,asset.id)).bytes,png);
  await assert.rejects(s.image(peer,copy.id,asset.id),{code:'NOT_FOUND'});
  await s.grant(ctx,copy.id,{userId:peer.user,role:'VIEWER'});
  await s.grant(ctx,d.id,{userId:peer.user,role:'REMOVE'});
  await assert.rejects(s.image(peer,d.id,asset.id),{code:'NOT_FOUND'});
  assert.deepEqual((await s.image(peer,copy.id,asset.id)).bytes,png);
  const restored=materialize(Buffer.from((await s.sync(ctx,copy.id,'AA==')).update,'base64'));
  assert.equal(restored.getXmlFragment('default').toArray().find(n=>n.nodeName==='documentImage').getAttribute('caption'),'Shared figure');
  await s.tx(ctx,c=>c.query('DELETE FROM collab_image WHERE organization_id=$1 AND document_id=$2',[ctx.org,d.id]));
  await assert.rejects(s.restore(ctx,d.id,version,{id:randomUUID()}),{code:'IMAGE_MISSING'});
  assert.deepEqual((await s.image(peer,copy.id,asset.id)).bytes,png);
  content.destroy();restored.destroy();
 }finally{await s.close();}
});
