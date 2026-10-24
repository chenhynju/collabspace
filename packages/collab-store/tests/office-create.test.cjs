const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),{unzipSync}=require('fflate');
const {OfficeStore,validate}=require('../office.cjs'),{materialize}=require('../index.cjs');
test('blank Office templates are macro-free OOXML with one sheet/slide and no external resources',()=>{
 for(const ext of ['docx','xlsx','pptx']){const b=fs.readFileSync(path.join(__dirname,'../templates/blank.'+ext));assert.ok(validate(b,ext));const z=unzipSync(b);assert.ok(b.length<100000);assert.ok(!Object.keys(z).some(n=>/vbaProject/i.test(n)));if(ext==='xlsx')assert.match(Buffer.from(z['xl/workbook.xml']).toString(),/name="Sheet1"/);if(ext==='pptx')assert.equal(Object.keys(z).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).length,1);}
});
test('real nonprivileged PG: blank create, concurrent idempotency, independent names, scope, READ ceiling and unified editor metadata',{skip:!process.env.COLLAB_TEST_DATABASE_URL},async()=>{
 const ctx={org:process.env.TEST_ORG,user:process.env.TEST_OWNER},peer={org:ctx.org,user:process.env.TEST_MEMBER},project=process.env.TEST_PROJECT;
 const base=path.resolve('.test-runs');fs.mkdirSync(base,{recursive:true});const root=fs.mkdtempSync(path.join(base,'blank-office-'));assert.ok(root.startsWith(base+path.sep));
 const s=new OfficeStore(process.env.COLLAB_TEST_DATABASE_URL,{OFFICE_PUBLIC_URL:'http://localhost:3390',OFFICE_INTERNAL_URL:'http://localhost:3390',OFFICE_JWT_SECRET:'synthetic',OFFICE_CAPABILITY_SECRET:'synthetic',UPLOAD_ROOT:root});
 try{
  for(const extension of ['docx','xlsx','pptx']){
   const input={title:'Blank '+randomUUID(),extension,requestId:randomUUID()};const copies=await Promise.all(Array.from({length:4},()=>s.createBlank(ctx,project,input)));assert.equal(new Set(copies.map(d=>d.id)).size,1);
   const d=copies[0];assert.equal((await s.bytes(ctx,d.id)).extension,extension);assert.equal((await s.heartbeat(ctx,d.id)).projectId,project);
   await assert.rejects(s.createBlank(ctx,project,{...input,title:'changed'}),{code:'OFFICE_CREATE_CONFLICT'});
   await assert.rejects(s.detail(peer,d.id),{code:'NOT_FOUND'});await s.grant(ctx,d.id,{userId:peer.user,role:'VIEWER'});assert.equal((await s.detail(peer,d.id)).role,'VIEWER');await assert.rejects(s.force(peer,d.id),{code:'READ_ONLY'});
   const rows=await s.list(ctx,project);assert.ok(rows.find(r=>r.id===d.id&&r.kind==='OFFICE'&&r.last_editor));
   assert.equal((await s.tx(ctx,c=>c.query('SELECT count(*)::int AS n FROM collab_office WHERE organization_id=$1 AND file_id=$2',[ctx.org,d.fileId]))).rows[0].n,1);
   await assert.rejects(s.createBlank({org:process.env.TEST_OTHER_ORG,user:ctx.user},project,{...input,requestId:randomUUID()}));
  }
  const board=await s.create(ctx,project,{title:'Imported Mermaid',kind:'BOARD',source:'flowchart TB\n A-->B'});const synced=await s.sync(ctx,board.id,'AA==');const state=materialize(Buffer.from(synced.update,'base64'));assert.match(state.getText('mermaid').toString(),/A-->B/);state.destroy();
  const restricted=randomUUID(),group=randomUUID();await s.tx(ctx,async c=>{
   const workspace=(await c.query('SELECT workspace_id FROM prj_project WHERE organization_id=$1 AND id=$2',[ctx.org,project])).rows[0].workspace_id;
   await c.query("INSERT INTO prj_project(id,organization_id,workspace_id,owner_id,name,status,visibility,updated_at) VALUES($1,$2,$3,$4,'Blank READ ceiling','ACTIVE','RESTRICTED',now())",[restricted,ctx.org,workspace,ctx.user]);
   await c.query("INSERT INTO org_collaboration_group(id,organization_id,name,kind) VALUES($1,$2,'Blank readers','TEAM')",[group,ctx.org]);const member=(await c.query('SELECT id FROM org_membership WHERE organization_id=$1 AND user_id=$2',[ctx.org,peer.user])).rows[0].id;
   await c.query("INSERT INTO org_group_member(id,organization_id,group_id,membership_id,role) VALUES($1,$2,$3,$4,'MEMBER')",[randomUUID(),ctx.org,group,member]);await c.query("INSERT INTO org_resource_grant(id,organization_id,group_id,project_id,access) VALUES($1,$2,$3,$4,'READ')",[randomUUID(),ctx.org,group,restricted]);
  });await assert.rejects(s.createBlank(peer,restricted,{title:'Denied',extension:'docx',requestId:randomUUID()}),{code:'READ_ONLY'});
  await assert.rejects(s.createBlank(ctx,project,{title:'../escape',extension:'docx',requestId:randomUUID()}),{code:'OFFICE_CREATE_INVALID'});
 }finally{await s.close();assert.ok(root.startsWith(base+path.sep));fs.rmSync(root,{recursive:true,force:true});}
});
