const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {zipSync,strToU8}=require('fflate'),{OfficeStore,sign,verify,validate}=require('../office.cjs');
const fixture=(extra={})=>Buffer.from(zipSync({'[Content_Types].xml':strToU8('<Types/>'),'word/document.xml':strToU8('<document/>'),...extra}));
test('Office signatures, unsafe package and SSRF boundaries',async()=>{
 assert.equal(verify(sign({exp:Date.now()/1000+30},'synthetic'),'synthetic').exp>0,true);
 assert.throws(()=>verify(sign({exp:1},'synthetic'),'synthetic'),{code:'OFFICE_SIGNATURE'});
 assert.throws(()=>verify(sign({},'synthetic'),'wrong'),{code:'OFFICE_SIGNATURE'});
 validate(fixture(),'docx');assert.throws(()=>validate(fixture(),'xlsx'),{code:'OFFICE_FORMAT'});
 assert.throws(()=>validate(fixture({'word/vbaProject.bin':strToU8('bad')}),'docx'),{code:'OFFICE_INVALID_ARCHIVE'});
 assert.throws(()=>validate(fixture({'word/_rels/document.xml.rels':strToU8('<Relationship TargetMode="External" Target="http://169.254.169.254/"/>')}),'docx'),{code:'OFFICE_EXTERNAL_RESOURCE'});
 const store=new OfficeStore('postgres://unused:unused@localhost/unused',{OFFICE_INTERNAL_URL:'http://localhost:3390',OFFICE_PUBLIC_URL:'https://office.example.test'});
 try{for(const url of ['http://169.254.169.254/cache/files/x','http://localhost:3390/command','http://localhost:3390@evil.test/cache/files/x'])await assert.rejects(store.candidate(url,'docx'),{code:'OFFICE_SAVE_URL'})}finally{await store.close()}
});
test('Office close/reopen epochs, failed commit retry, mid-download revocation and direct RLS',{skip:!process.env.COLLAB_TEST_DATABASE_URL},async()=>{
 const ctx={org:process.env.TEST_ORG,user:process.env.TEST_OWNER},peer={org:ctx.org,user:process.env.TEST_MEMBER};
 const s=new OfficeStore(process.env.COLLAB_TEST_DATABASE_URL,{OFFICE_PUBLIC_URL:'http://localhost:3390',OFFICE_INTERNAL_URL:'http://localhost:3390',OFFICE_JWT_SECRET:'synthetic-engine',OFFICE_CAPABILITY_SECRET:'synthetic-cap',OFFICE_CALLBACK_BASE:'http://localhost:53121/api/v1'}),bytes=fixture();let id;
 const cap=x=>new URL(x.config.editorConfig.callbackUrl).searchParams.get('cap');
 const cb=(config,payload)=>s.callback(cap(config),sign(payload,'synthetic-engine'),payload);
 const event=(config,status,extra={})=>({key:config.config.document.key,status,...extra});
 try{
  await s.tx(ctx,async c=>{const d=await s.insert(c,ctx,process.env.TEST_PROJECT,'Office lifecycle.docx',undefined,'OFFICE');id=d.id;const gen=randomUUID();await c.query("INSERT INTO collab_office(organization_id,document_id,file_id,extension,generation,phase) VALUES($1,$2,$3,'docx',$4,'CLOSED')",[ctx.org,id,randomUUID(),gen]);await c.query('INSERT INTO collab_office_version VALUES($1,$2,$3,1,$4,$5,$6,now())',[ctx.org,id,randomUUID(),gen,'original',bytes])});
  await s.grant(ctx,id,{userId:peer.user,role:'EDITOR'});const a=await s.config(ctx,id),b=await s.config(peer,id);s.candidate=async()=>bytes;
  assert.notEqual(a.sessionId,b.sessionId);
  await cb(a,event(a,1,{users:[a.sessionId],actions:[{type:1,userid:a.sessionId}]}));
  await cb(a,event(a,1,{users:[],actions:[{type:0,userid:a.sessionId}]}));
  assert.equal((await s.heartbeat(ctx,id)).phase,'CLOSING');await assert.rejects(s.config(ctx,id),{code:'OFFICE_CLOSING'});
  await cb(b,event(b,1,{users:[b.sessionId],actions:[{type:1,userid:b.sessionId}]}));
  const oldFinal=event(a,2,{url:'http://localhost:3390/cache/files/old-final'});
  assert.deepEqual(await cb(a,oldFinal),{error:1});assert.equal((await s.heartbeat(ctx,id)).revision,1);assert.equal((await s.heartbeat(ctx,id)).phase,'FROZEN');
  const generation=(await s.heartbeat(ctx,id)).generation;await s.restart(ctx,id,generation);const c=await s.config(ctx,id),d=await s.config(peer,id);
  assert.notEqual(c.config.document.key,a.config.document.key);assert.deepEqual(await cb(a,oldFinal),{error:1});assert.equal((await s.heartbeat(ctx,id)).phase,'OPEN');
  await cb(c,event(c,1,{users:[c.sessionId,d.sessionId],actions:[{type:1,userid:c.sessionId}]}));
  const gen=(await s.heartbeat(ctx,id)).generation;await s.tx(ctx,q=>q.query('UPDATE collab_office SET issued=1 WHERE organization_id=$1 AND document_id=$2',[ctx.org,id]));
  const checkpoint=event(c,6,{url:'http://localhost:3390/cache/files/checkpoint',userdata:gen+':1'}),audit=s.audit;
  s.audit=async()=>{throw Error('injected Office commit failure')};await assert.rejects(cb(c,checkpoint),/injected Office commit failure/);assert.equal((await s.heartbeat(ctx,id)).revision,1);
  s.audit=audit;assert.deepEqual(await cb(c,checkpoint),{error:0});assert.equal((await s.heartbeat(ctx,id)).revision,2);
  let entered,release;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);s.candidate=async()=>{entered();await gate;return bytes};
  await s.tx(ctx,q=>q.query('UPDATE collab_office SET issued=2 WHERE organization_id=$1 AND document_id=$2',[ctx.org,id]));
  const pending=cb(c,event(c,6,{url:'http://localhost:3390/cache/files/race',userdata:gen+':2'}));await started;await s.grant(ctx,id,{userId:peer.user,role:'REMOVE'});release();assert.deepEqual(await pending,{error:1});assert.equal((await s.heartbeat(ctx,id)).revision,2);assert.equal((await s.heartbeat(ctx,id)).phase,'FROZEN');
  if(process.env.TEST_OTHER_ORG){const foreign=await s.tx({org:process.env.TEST_OTHER_ORG,user:process.env.TEST_OTHER_USER},q=>q.query('SELECT id FROM collab_office_version WHERE document_id=$1',[id]));assert.equal(foreign.rowCount,0)}
 }finally{await s.close()}
});
test('Office real nonprivileged PG: shared key, tenant/role, saved receipt and revoked-session quarantine',{skip:!process.env.COLLAB_TEST_DATABASE_URL},async()=>{
 const ctx={org:process.env.TEST_ORG,user:process.env.TEST_OWNER},peer={org:ctx.org,user:process.env.TEST_MEMBER};
 const store=new OfficeStore(process.env.COLLAB_TEST_DATABASE_URL,{OFFICE_PUBLIC_URL:'http://localhost:3390',OFFICE_INTERNAL_URL:'http://localhost:3390',OFFICE_JWT_SECRET:'synthetic-engine-secret',OFFICE_CAPABILITY_SECRET:'synthetic-app-secret',OFFICE_CALLBACK_BASE:'http://localhost:53121/api/v1'});
 const bytes=fixture(),fileId=randomUUID();let id,generation;
 try{
  await store.assertOfficeRuntime();
  store.options.UPLOAD_ROOT=require('node:path').resolve('.test-runs/office-store-tests/uploads');
  await store.tx(ctx,async c=>{await store.parent(c,ctx,process.env.TEST_PROJECT);const d=await store.insert(c,ctx,process.env.TEST_PROJECT,'Office test.docx',undefined,'OFFICE');id=d.id;generation=randomUUID();await c.query("INSERT INTO collab_office(organization_id,document_id,file_id,extension,generation,phase) VALUES($1,$2,$3,'docx',$4,'CLOSED')",[ctx.org,id,fileId,generation]);await c.query('INSERT INTO collab_office_version VALUES($1,$2,$3,1,$4,$5,$6,now())',[ctx.org,id,randomUUID(),generation,'original',bytes])});
  await assert.rejects(store.ticket(ctx,id),{code:'OFFICE_ENGINE_REQUIRED'});
  await assert.rejects(store.version(ctx,id,{id:randomUUID(),name:'wrong engine'}),{code:'OFFICE_ENGINE_REQUIRED'});
  await assert.rejects(store.restore(ctx,id,randomUUID(),{id:randomUUID()}),{code:'OFFICE_ENGINE_REQUIRED'});
  await store.grant(ctx,id,{userId:peer.user,role:'EDITOR'});
  const a=await store.config(ctx,id),b=await store.config(peer,id);assert.equal(a.config.document.key,b.config.document.key);
  const cap=new URL(a.config.editorConfig.callbackUrl).searchParams.get('cap'),readCap=new URL(b.config.document.url).searchParams.get('cap');
  const state=await store.heartbeat(ctx,id);generation=state.generation;
  await assert.rejects(store.heartbeat({org:randomUUID(),user:ctx.user},id),{code:'NOT_FOUND'});
  store.candidate=async()=>bytes;
  store.command=async()=>({error:0});await store.force(ctx,id);await assert.rejects(store.force(ctx,id),{code:'OFFICE_SAVE_PENDING'});
  await store.tx(ctx,c=>c.query('UPDATE collab_office SET issued=0 WHERE organization_id=$1 AND document_id=$2',[ctx.org,id]));store.command=async()=>({error:4});await store.force(ctx,id);assert.equal((await store.tx(ctx,c=>store.head(c,ctx,id))).issued,0);
  await store.tx(ctx,c=>c.query('UPDATE collab_office SET issued=2 WHERE organization_id=$1 AND document_id=$2',[ctx.org,id]));
  const payload={key:a.config.document.key,status:6,url:'http://localhost:3390/cache/files/synthetic',userdata:generation+':2'};
  const callback=body=>store.callback(cap,sign(body,'synthetic-engine-secret'),body);
  assert.deepEqual(await callback(payload),{error:0});assert.deepEqual(await callback(payload),{error:0});assert.equal((await store.heartbeat(ctx,id)).revision,2);
  assert.deepEqual(await callback({...payload,userdata:generation+':1'}),{error:1});assert.equal((await store.heartbeat(ctx,id)).phase,'FROZEN');
  assert.deepEqual((await store.fileCurrent(ctx,fileId)).bytes,bytes);
  assert.equal(await store.shareOffice(ctx,fileId),true);await assert.rejects(store.shareOffice(peer,fileId),{code:'OWNER_REQUIRED'});
  const latest=(await store.heartbeat(ctx,id)).versions.find(v=>v.revision===2),restoreId=randomUUID();
  const copy=await store.restoreOffice(ctx,id,latest.id,restoreId);assert.equal((await store.restoreOffice(ctx,id,latest.id,restoreId)).id,copy.id);
  await assert.rejects(store.detail(peer,copy.id),{code:'NOT_FOUND'});assert.deepEqual((await store.bytes(ctx,copy.id)).bytes,bytes);
  const copyHead=await store.tx(ctx,c=>store.head(c,ctx,copy.id));await assert.rejects(store.shareOffice(peer,copyHead.file_id),{code:'NOT_FOUND'});
  await assert.rejects(store.restoreOffice(peer,id,latest.id,restoreId),{code:'OFFICE_RESTORE_CONFLICT'});
  await store.restart(ctx,id,generation);const fresh=await store.config(ctx,id);assert.notEqual(fresh.config.document.key,a.config.document.key);
  await store.config(peer,id);await store.grant(ctx,id,{userId:peer.user,role:'REMOVE'});
  await assert.rejects(store.fileCurrent(peer,fileId),{code:'NOT_FOUND'});assert.deepEqual(await store.visibleFiles(peer,[{id:fileId}]),[]);
  await assert.rejects(store.engineFile(readCap),{code:'NOT_FOUND'});
  const freshCap=new URL(fresh.config.editorConfig.callbackUrl).searchParams.get('cap'),final={key:fresh.config.document.key,status:2,url:'http://localhost:3390/cache/files/revoked'};
  assert.deepEqual(await store.callback(freshCap,sign(final,'synthetic-engine-secret'),final),{error:1});
  assert.equal((await store.heartbeat(ctx,id)).revision,2);assert.equal((await store.heartbeat(ctx,id)).phase,'FROZEN');
  const all=await store.heartbeat(ctx,id);assert.equal(all.versions.filter(v=>!v.revision).length,2);
 }finally{await store.close()}
});
test('Office effective access cannot exceed restricted project READ grant',{skip:!process.env.COLLAB_TEST_DATABASE_URL},async()=>{
 const ctx={org:process.env.TEST_ORG,user:process.env.TEST_OWNER},peer={org:ctx.org,user:process.env.TEST_MEMBER},project=randomUUID(),group=randomUUID();
 const s=new OfficeStore(process.env.COLLAB_TEST_DATABASE_URL,{OFFICE_PUBLIC_URL:'http://localhost:3390',OFFICE_INTERNAL_URL:'http://localhost:3390',OFFICE_JWT_SECRET:'synthetic',OFFICE_CAPABILITY_SECRET:'synthetic-cap',OFFICE_CALLBACK_BASE:'http://localhost/api/v1'});let id;
 try{
  await s.tx(ctx,async c=>{const workspace=(await c.query('SELECT workspace_id FROM prj_project WHERE organization_id=$1 AND id=$2',[ctx.org,process.env.TEST_PROJECT])).rows[0].workspace_id;await c.query("INSERT INTO prj_project(id,organization_id,workspace_id,owner_id,name,status,visibility,updated_at) VALUES($1,$2,$3,$4,'Office read ceiling','ACTIVE','RESTRICTED',now())",[project,ctx.org,workspace,ctx.user]);
   await c.query("INSERT INTO org_collaboration_group(id,organization_id,name,kind) VALUES($1,$2,'Office readers','TEAM')",[group,ctx.org]);const m=(await c.query('SELECT id FROM org_membership WHERE organization_id=$1 AND user_id=$2',[ctx.org,peer.user])).rows[0].id;
   await c.query("INSERT INTO org_group_member(id,organization_id,group_id,membership_id,role) VALUES($1,$2,$3,$4,'MEMBER')",[randomUUID(),ctx.org,group,m]);await c.query("INSERT INTO org_resource_grant(id,organization_id,group_id,project_id,access) VALUES($1,$2,$3,$4,'READ')",[randomUUID(),ctx.org,group,project]);
   const d=await s.insert(c,ctx,project,'Read ceiling.docx',undefined,'OFFICE');id=d.id;const gen=randomUUID();await c.query("INSERT INTO collab_office(organization_id,document_id,file_id,extension,generation,phase) VALUES($1,$2,$3,'docx',$4,'CLOSED')",[ctx.org,id,randomUUID(),gen]);await c.query('INSERT INTO collab_office_version VALUES($1,$2,$3,1,$4,$5,$6,now())',[ctx.org,id,randomUUID(),gen,'original',fixture()]);
  });await s.grant(ctx,id,{userId:peer.user,role:'EDITOR'});const config=await s.config(peer,id);assert.equal(config.role,'VIEWER');assert.equal(config.config.document.permissions.edit,false);
  await assert.rejects(s.force(peer,id),{code:'READ_ONLY'});await assert.rejects(s.create(peer,project,{title:'Not allowed',kind:'MARKDOWN'}),{code:'READ_ONLY'});
  await s.tx(ctx,c=>c.query("UPDATE org_resource_grant SET access='WRITE' WHERE organization_id=$1 AND group_id=$2 AND project_id=$3",[ctx.org,group,project]));assert.equal((await s.detail(peer,id)).role,'EDITOR');
 }finally{await s.close()}
});
