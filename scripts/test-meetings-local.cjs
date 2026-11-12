// Isolated real PostgreSQL/service test. Never reads project .env or vendor keys.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..'),api=path.join(root,'apps/api');
require(path.join(api,'node_modules/ts-node')).register({project:path.join(api,'tsconfig.json'),transpileOnly:true});
const {MeetingsService}=require(path.join(api,'src/modules/meetings/meetings.service'));
const {ResourcePolicyService}=require(path.join(api,'src/modules/groups/resource-policy.service'));
const {Client}=require('../packages/collab-store/node_modules/pg');
const {createRequire}=require('node:module'),req=createRequire(path.join(api,'package.json'));
let pg;
async function main(){
 const {default:EmbeddedPostgres}=await import(require('node:url').pathToFileURL(req.resolve('embedded-postgres')).href);
 const dir=path.join(root,'.test-runs/rtc-r1-sql');fs.mkdirSync(dir,{recursive:true});
 const port=15551;
 pg=new EmbeddedPostgres({databaseDir:path.join(dir,'pgdata'),user:'rtc_test',password:'isolated-synthetic-only',port,persistent:true,postgresFlags:['-h','127.0.0.1','-c','listen_addresses=127.0.0.1'],onLog:()=>{},onError:()=>{}});
 if(!fs.existsSync(path.join(dir,'pgdata/PG_VERSION')))await pg.initialise();await pg.start();
 const admin=new Client({host:'127.0.0.1',port,user:'rtc_test',password:'isolated-synthetic-only',database:'postgres'});await admin.connect();
 const schema='rtc_'+randomUUID().replaceAll('-','');
 try{
  await admin.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  await admin.query(`CREATE TABLE org_organization(id text PRIMARY KEY,status text);CREATE TABLE sys_user(id text PRIMARY KEY,status text);
   CREATE TABLE org_membership(id text PRIMARY KEY,organization_id text,user_id text,status text);
   CREATE TABLE prj_project(id text,organization_id text,owner_id text,visibility text,status text,PRIMARY KEY(id,organization_id));
   CREATE TABLE org_membership_role(membership_id text,role_id text);CREATE TABLE sys_role(id text,role_key text,status text);
   CREATE TABLE org_resource_grant(project_id text,organization_id text,group_id text,access text);
   CREATE TABLE org_collaboration_group(id text,organization_id text,archived_at timestamptz);
   CREATE TABLE org_group_member(group_id text,membership_id text);
   CREATE TABLE audit_test(action text,before_data jsonb,after_data jsonb);
   INSERT INTO org_organization VALUES('a','ACTIVE'),('b','ACTIVE');INSERT INTO sys_user VALUES('host','NORMAL'),('member','NORMAL'),('outsider','NORMAL');
   INSERT INTO org_membership VALUES('mh','a','host','ACTIVE'),('mm','a','member','ACTIVE'),('mo','b','outsider','ACTIVE');
   INSERT INTO prj_project VALUES('project-a','a','host','ORGANIZATION','ACTIVE'),('project-b','b','outsider','ORGANIZATION','ACTIVE');`);
  // A real non-owner/non-superuser role with FORCE RLS enforced.
  const role='rtc_app_'+randomUUID().replaceAll('-','');await admin.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
  try{
   await admin.query(fs.readFileSync(path.join(root,'packages/collab-store/meetings.sql'),'utf8'));
   await admin.query('CREATE TABLE im_conversation(id text,organization_id text,PRIMARY KEY(id,organization_id))');
   await admin.query(fs.readFileSync(path.join(root,'packages/collab-store/voice.sql'),'utf8'));
   const routeColumn=await admin.query("SELECT data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name='voice_job' AND column_name='speech_route'",[schema]);assert.equal(routeColumn.rows[0].data_type,'text');
   // Reapplying the additive migration preserves the schema and is safe for local retries.
   await admin.query(fs.readFileSync(path.join(root,'packages/collab-store/voice.sql'),'utf8'));

   await admin.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role};GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA ${schema} TO ${role}`);
   const query=(strings,values)=>({text:strings.map((s,i)=>s+(i<values.length?'$'+(i+1):'')).join(''),values});
   // Separate clients so real row/advisory locks can exercise concurrent creates.
   let activeTransactions=0;const hints=[];
   const prisma={withOrgUser:async(org,user,fn)=>{const c=new Client({host:'127.0.0.1',port,user:'rtc_test',password:'isolated-synthetic-only',database:'postgres'});await c.connect();activeTransactions++;try{await c.query('BEGIN');await c.query(`SET LOCAL ROLE ${role};SET LOCAL search_path TO ${schema}`);await c.query("SELECT set_config('app.current_org_id',$1,true),set_config('app.current_user_id',$2,true)",[org,user]);const tx={$queryRaw:async(s,...v)=>(await c.query(query(s,v))).rows,$executeRaw:async(s,...v)=>(await c.query(query(s,v))).rowCount};const r=await fn(tx);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();activeTransactions--;}}};
   const audit={record:async(tx,e)=>tx.$executeRaw`INSERT INTO audit_test VALUES(${e.action},${JSON.stringify(e.before)}::jsonb,${JSON.stringify(e.after)}::jsonb)`};
   let vendorFails=false;let deletes=0;const media={status:()=>({enabled:true}),ticket:async()=>({token:'fixture-not-media-proof',url:'wss://synthetic.invalid'}),end:async(org,meeting,users)=>{assert.ok(users.includes('member'));deletes++;if(vendorFails)throw Error('synthetic uncertain vendor response');}};
   const service=new MeetingsService(prisma,new ResourcePolicyService(prisma),audit,media,{emitToProject:(org,project,event,payload)=>{assert.equal(activeTransactions,0);hints.push({org,project,event,payload});}}),id=randomUUID(),body={requestId:id,projectId:'project-a',title:'合成评审'};
   const results=await Promise.all([service.create('a','host',body,'t1'),service.create('a','host',body,'t2')]);assert.equal(results[0].id,results[1].id);
   assert.equal((await service.list('a','member','project-a')).length,1);
   await assert.rejects(service.create('a','host',{...body,title:'changed'},'t3'),e=>e.getStatus()===409);
   await assert.rejects(service.join('b','outsider',id),e=>e.getStatus()===404);
   await assert.rejects(service.end('a','member',id,'t4'),e=>e.getStatus()===403);
   const ticket=await service.join('a','member',id);assert.equal(ticket.token,'fixture-not-media-proof');assert.deepEqual((await service.list('a','host','project-a'))[0].issued_user_ids,['member']);
   const msg={requestId:randomUUID(),text:'<script>literal text</script>'};
   const first=await service.sendMessage('a','member',id,msg,'chat1');assert.equal(first.body,msg.text);assert.equal(hints.length,1);assert.deepEqual(hints[0],{org:'a',project:'project-a',event:'meeting:changed',payload:{organizationId:'a',projectId:'project-a',meetingId:id}});
   assert.equal((await service.sendMessage('a','member',id,msg,'chat2')).id,first.id);
   await assert.rejects(service.sendMessage('a','member',id,{...msg,text:'changed'},'chat3'),e=>e.getStatus()===409);
   assert.equal((await service.messages('a','member',id)).length,1);
   assert.equal((await service.messages('a','member',id,first.id)).length,0);
   await assert.rejects(service.messages('b','outsider',id),e=>e.getStatus()===404);
   vendorFails=true;await assert.rejects(service.end('a','host',id,'t5'));assert.equal((await service.list('a','host','project-a'))[0].status,'ENDING');
   await assert.rejects(service.join('a','member',id),e=>e.getStatus()===409);
   vendorFails=false;assert.equal((await service.end('a','host',id,'t6')).status,'ENDED');await service.end('a','host',id,'t7');assert.equal(deletes,2);
   assert.equal((await service.messages('a','member',id)).length,1);
   await assert.rejects(service.sendMessage('a','member',id,{requestId:randomUUID(),text:'after end'},'chat4'),e=>e.getStatus()===409);
   await prisma.withOrgUser('b','outsider',async tx=>{assert.equal((await tx.$queryRaw`SELECT * FROM rtc_meeting`).length,0);assert.equal((await tx.$queryRaw`SELECT * FROM rtc_message`).length,0);await assert.rejects(tx.$executeRaw`INSERT INTO rtc_meeting(id,organization_id,project_id,host_id,title) VALUES(${randomUUID()}::uuid,'a','project-a','host','wrong tenant')`);});
   await admin.query("UPDATE org_membership SET status='SUSPENDED' WHERE user_id='member'");await assert.rejects(service.list('a','member','project-a'),e=>e.getStatus()===404);
   await admin.query("UPDATE org_membership SET status='ACTIVE' WHERE user_id='member';UPDATE prj_project SET visibility='PRIVATE' WHERE id='project-a'");await assert.rejects(service.list('a','member','project-a'),e=>e.getStatus()===404);
   const auditRows=(await admin.query('SELECT action FROM audit_test ORDER BY action')).rows;assert.deepEqual(auditRows.map(x=>x.action),['meeting:create','meeting:ended','meeting:ending','meeting:message']);
   console.log('PASS: concurrent idempotency, conflict, project/tenant/member isolation, host-only end, ENDING recovery, denied join, repeated end, actual non-owner FORCE RLS, speech-route additive migration, atomic audit, post-commit metadata-only socket hint, persisted chat idempotency/history/cursor, ended chat read-only. Vendor is a fixture; no media acceptance.');
  }finally{await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.query(`DROP ROLE ${role}`);}
 }finally{await admin.end();}
}
async function stopTestDatabase(){
 if(!pg)return;
 if(process.platform!=='win32')return pg.stop();
 // embedded-postgres uses taskkill on Windows; prefer PostgreSQL's graceful stop.
 const data=path.resolve(root,'.test-runs/rtc-r1-sql/pgdata');
 if(!data.startsWith(path.resolve(root,'.test-runs')+path.sep))throw Error('Unexpected test database path');
 const embeddedRequire=createRequire(req.resolve('embedded-postgres'));
 const bins=await import(require('node:url').pathToFileURL(embeddedRequire.resolve('@embedded-postgres/windows-x64')).href);
 const result=require('node:child_process').spawnSync(bins.pg_ctl,['-D',data,'-m','fast','-w','-t','20','stop'],{windowsHide:true,encoding:'utf8',timeout:25000});
 if(result.status!==0)throw Error('Isolated PostgreSQL shutdown failed: '+result.stderr);
 pg.process=undefined; // Avoid the library exit hook taskkill after graceful shutdown.
 console.log('PASS: isolated PostgreSQL gracefully stopped.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>stopTestDatabase().catch(e=>{console.error(e);process.exitCode=1;}));
