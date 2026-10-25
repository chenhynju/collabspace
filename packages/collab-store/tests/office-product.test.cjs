const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const path=require('node:path'),fs=require('node:fs'),http=require('node:http');
const {OfficeStore,verify}=require('../office.cjs');
const {convertPdf}=require('../office-pdf.cjs');
test('PDF supplier contract rejects JSON errors and never follows a redirect',async()=>{
 const original=global.fetch;let options;
 try{
  global.fetch=async(url,o)=>{assert.equal(new URL(url).pathname,'/converter/from-file');options=o;const params=JSON.parse(o.body.get('token'));assert.equal(params.operation,'converter');assert.equal(params.outputtype,'pdf');assert.equal(params.url,undefined);return new Response('{"error":-7}');};
  await assert.rejects(convertPdf({bytes:Buffer.from('fixture'),extension:'docx',title:'Synthetic.docx',versionId:'v',org:'o',id:'d',internalUrl:'http://localhost:3390',signToken:JSON.stringify}),{code:'OFFICE_EXPORT_INVALID'});assert.equal(options.redirect,'error');
 }finally{global.fetch=original}
});
test('real nonprivileged PostgreSQL: three formats rename/copy/export, replay, isolation and revocation',{skip:!process.env.OFFICE_PRODUCT_CONFIG},async()=>{
 const config=JSON.parse(fs.readFileSync(path.resolve(process.env.OFFICE_PRODUCT_CONFIG),'utf8')),url=new URL(config.COLLAB_TEST_DATABASE_URL||config.DATABASE_URL);
 assert.ok(['localhost','127.0.0.1'].includes(url.hostname));assert.equal(url.port,'5571');
 const root=fs.mkdtempSync(path.resolve('.test-runs')+path.sep+'office-product-'),ctx={org:config.TEST_ORG,user:config.TEST_OWNER},peer={org:ctx.org,user:config.TEST_MEMBER};
 let count=0,delay;
 const server=http.createServer(async(req,res)=>{
  try{assert.equal(req.url,'/converter/from-file');const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const form=await new Request('http://localhost/converter/from-file',{method:'POST',headers:req.headers,body:Buffer.concat(chunks)}).formData();
   const params=verify(form.get('token'),'synthetic');assert.equal(params.operation,'converter');assert.equal(params.url,undefined);assert.ok(['docx','xlsx','pptx'].includes(params.filetype));assert.ok(form.get('file').size>100);
   count++;if(delay)await delay();res.setHeader('Content-Type','application/pdf');res.end('%PDF-1.4\nSynthetic supplier stub only\n%%EOF');
  }catch{res.statusCode=500;res.end('stub failed');}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const internal='http://127.0.0.1:'+server.address().port;
 const store=new OfficeStore(url.href,{OFFICE_PUBLIC_URL:internal,OFFICE_INTERNAL_URL:internal,OFFICE_JWT_SECRET:'synthetic',OFFICE_CAPABILITY_SECRET:'synthetic',UPLOAD_ROOT:root});
 try{
  await store.assertOfficeRuntime();
  for(const extension of ['docx','xlsx','pptx']){
   const d=await store.createBlank(ctx,config.TEST_PROJECT,{title:'Product '+randomUUID(),extension,requestId:randomUUID()}),before=await store.heartbeat(ctx,d.id);
   await store.grant(ctx,d.id,{userId:peer.user,role:'VIEWER'});
   await assert.rejects(store.renameOffice(peer,d.id,{title:'Denied',expectedTitle:before.title}),{code:'READ_ONLY'});
   const rename={title:'Renamed '+randomUUID(),expectedTitle:before.title};const named=await store.renameOffice(ctx,d.id,rename);
   assert.ok(named.title.endsWith('.'+extension));assert.equal((await store.heartbeat(ctx,d.id)).revision,1);
   assert.equal((await store.tx(ctx,c=>c.query('SELECT name FROM prj_file WHERE organization_id=$1 AND id=$2',[ctx.org,d.fileId]))).rows[0].name,named.title);
   await assert.rejects(store.renameOffice(ctx,d.id,rename),{code:'OFFICE_NAME_CONFLICT'});
   await assert.rejects(store.rename(ctx,d.id,{title:'Bypass',revision:1}),{code:'OFFICE_METADATA_REQUIRED'});
   const versionId=before.versions.find(v=>v.revision===1).id,input={title:'Copy '+randomUUID(),versionId,requestId:randomUUID()};
   const copies=await Promise.all([store.copyOffice(ctx,d.id,input),store.copyOffice(ctx,d.id,input),store.copyOffice(ctx,d.id,input)]);assert.equal(new Set(copies.map(c=>c.id)).size,1);
   await assert.rejects(store.copyOffice(ctx,d.id,{...input,title:'Changed intent'}),{code:'OFFICE_RESTORE_CONFLICT'});
   assert.deepEqual((await store.bytes(ctx,copies[0].id)).bytes,(await store.bytes(ctx,d.id)).bytes);
   await assert.rejects(store.detail(peer,copies[0].id),{code:'NOT_FOUND'});
   await assert.rejects(store.copyOffice(peer,d.id,{...input,requestId:randomUUID()}),{code:'READ_ONLY'});
   const result=await store.exportPdf(peer,d.id,versionId);assert.equal(result.revision,1);assert.equal(result.bytes.subarray(0,5).toString(),'%PDF-');
   await assert.rejects(store.exportPdf(ctx,d.id,'-'.repeat(36)),{code:'OFFICE_EXPORT_VERSION'});
   await assert.rejects(store.exportPdf({org:config.TEST_OTHER_ORG,user:config.TEST_OTHER_USER},d.id,versionId),{code:'NOT_FOUND'});
   let entered,release;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);delay=async()=>{entered();await gate};
   const pending=store.exportPdf(peer,d.id,versionId);await started;
   await assert.rejects(store.exportPdf(peer,d.id,versionId),{code:'OFFICE_EXPORT_BUSY'});
   await store.grant(ctx,d.id,{userId:peer.user,role:'REMOVE'});release();await assert.rejects(pending,{code:'NOT_FOUND'});delay=null;assert.equal(store.exportJobs.size,0);
   assert.equal((await store.heartbeat(ctx,d.id)).revision,1);
  }
  assert.equal(count,6);
  assert.throws(()=>store.officeTitle('../escape','docx'),{code:'OFFICE_NAME_INVALID'});
  assert.throws(()=>store.officeTitle('change.xlsx','docx'),{code:'OFFICE_NAME_EXTENSION'});
 }finally{await store.close();await new Promise(r=>server.close(r));assert.ok(root.startsWith(path.resolve('.test-runs')+path.sep));fs.rmSync(root,{recursive:true,force:true});}
});
