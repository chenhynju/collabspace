// Requires the disposable scripts/local-up.cjs environment. Never uses a project .env.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module'),{randomUUID}=require('node:crypto');
const config=JSON.parse(fs.readFileSync(process.env.VOICE_LOCAL_CONFIG||'.test-runs/voice-persona/config.json','utf8'));
const database=new URL(config.DATABASE_URL),adminDatabase=new URL(config.DATABASE_ADMIN_URL);
if(database.hostname!=='127.0.0.1'||!['15439','15449'].includes(database.port)||database.pathname!=='/collabspace'||adminDatabase.hostname!==database.hostname||adminDatabase.port!==database.port||adminDatabase.pathname!==database.pathname)throw Error('Only matching isolated voice-persona databases allowed');
process.env.DATABASE_URL=config.DATABASE_URL;
const req=createRequire(path.resolve('apps/api/package.json'));
const {PrismaService}=req('./dist/prisma/prisma.service'),{ResourcePolicyService}=req('./dist/modules/groups/resource-policy.service'),{AuditService}=req('./dist/modules/audit/audit.service'),{VoiceService}=req('./dist/modules/voice/voice.service');
const {wav}=req('./tests/voice.test.cjs');
async function main(){
 {const {Client}=require('../packages/collab-store/node_modules/pg');const c=new Client({connectionString:config.DATABASE_ADMIN_URL});await c.connect();try{await c.query('BEGIN');await c.query(fs.readFileSync('packages/collab-store/voice.sql','utf8'));await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}}
 const db=new PrismaService(),policy=new ResourcePolicyService(db),audit=new AuditService(db);await db.$connect();
 const org=config.TEST_ORG,user=config.TEST_OWNER,scope={projectId:config.TEST_PROJECT};let calls=0,release;
 const provider={ready:true,run:async(kind,input,locale,signal)=>{calls++;if(release===null)await new Promise(resolve=>release=resolve);if(signal.aborted)throw Error('cancelled');return kind==='STT'?{text:'Synthetic transcript 你好'}:{audio:wav()};}};
 const voice=new VoiceService(db,policy,audit,provider);
 const wait=async(id)=>{for(let i=0;i<50;i++){const r=await voice.get(org,user,id);if(r.status!=='QUEUED'&&r.status!=='RUNNING')return r;await new Promise(r=>setTimeout(r,40));}throw Error('timeout');};
 try{
  const id=randomUUID(),b={...scope,requestId:id,kind:'STT',locale:'zh-CN'};
  await voice.create(org,user,b,wav(),'synthetic-trace');assert.equal((await wait(id)).text,'Synthetic transcript 你好');
  const before=calls;await voice.create(org,user,b,wav(),'replay');assert.equal(calls,before);
  await assert.rejects(voice.create(org,user,{...b,locale:'en-US'},wav(),'changed'),e=>e.getStatus()===409);
  await assert.rejects(voice.get(config.TEST_OTHER_ORG,user,id),e=>e.getStatus()===404);
  await assert.rejects(voice.get(org,config.TEST_MEMBER,id),e=>e.getStatus()===404);
  await assert.rejects(voice.create(org,user,{...b,requestId:randomUUID(),projectId:'foreign'},wav(),'forged'),e=>e.getStatus()===404);
  const hidden=await db.withOrgUser(config.TEST_OTHER_ORG,user,tx=>tx.$queryRawUnsafe('SELECT id FROM voice_job WHERE id=$1::uuid',id));assert.equal(hidden.length,0);
  const otherActor=await db.withOrgUser(org,config.TEST_MEMBER,tx=>tx.$queryRawUnsafe('SELECT id FROM voice_job WHERE id=$1::uuid',id));assert.equal(otherActor.length,0);
  release=null;const cancelId=randomUUID();await voice.create(org,user,{...b,requestId:cancelId},wav(),'cancel');
  for(let i=0;i<50&&typeof release!=='function';i++)await new Promise(r=>setTimeout(r,20));
  assert.equal(typeof release,'function');await voice.cancel(org,user,cancelId);release();assert.equal((await wait(cancelId)).status,'CANCELLED');
  const cancelled=await voice.load(org,user,cancelId);assert.equal(cancelled.input_audio,null);assert.equal(cancelled.result_audio,null);assert.equal(cancelled.result_text,null);
  provider.run=async()=>{calls++;throw Error('provider timed out');};
  const failId=randomUUID();await voice.create(org,user,{...b,requestId:failId},wav(),'failure');assert.equal((await wait(failId)).status,'UNKNOWN');const failedCalls=calls;await voice.create(org,user,{...b,requestId:failId},wav(),'retry');assert.equal(calls,failedCalls);
  provider.run=async()=>({audio:wav()});const recovered=randomUUID();await voice.create(org,user,{...scope,requestId:recovered,kind:'TTS',locale:'en-US',text:'Synthetic recovery'},undefined,'recovery');assert.equal((await wait(recovered)).status,'SUCCEEDED');assert.ok((await voice.load(org,user,recovered)).result_audio);
  const history=await voice.history(org,user,scope);assert.ok(history.some(j=>j.id===recovered&&j.hasAudio));
  const {Client}=require('../packages/collab-store/node_modules/pg');const admin=new Client({connectionString:config.DATABASE_ADMIN_URL});await admin.connect();
  try{
   const budgetIds=Array.from({length:20},()=>randomUUID());
   try{
    for(const budgetId of budgetIds)await admin.query("INSERT INTO voice_job(id,organization_id,actor_id,project_id,kind,locale,input_hash,status,trace_id) VALUES($1,$2,$3,$4,'TTS','en-US','synthetic-budget','SUCCEEDED','synthetic-budget')",[budgetId,org,config.TEST_MEMBER,scope.projectId]);
    const budgetCalls=calls;await assert.rejects(voice.create(org,config.TEST_MEMBER,{...b,requestId:randomUUID()},wav(),'budget'),e=>e.getStatus()===429);assert.equal(calls,budgetCalls);
   }finally{await admin.query('DELETE FROM voice_job WHERE id=ANY($1::uuid[])',[budgetIds]);}
   // A held provider call must block a second distinct request before it can be billed.
   let unblock;provider.run=async()=>{calls++;await new Promise(resolve=>unblock=resolve);return {text:'Synthetic concurrency'};};
   const held=randomUUID();await voice.create(org,user,{...b,requestId:held},wav(),'held');
   for(let i=0;i<50&&!unblock;i++)await new Promise(r=>setTimeout(r,20));assert.equal(typeof unblock,'function');
   const heldCalls=calls;await assert.rejects(voice.create(org,user,{...b,requestId:randomUUID()},wav(),'concurrent'),e=>e.getStatus()===429);assert.equal(calls,heldCalls);unblock();assert.equal((await wait(held)).status,'SUCCEEDED');
   // A durable queued row survives a new service instance; polling claims it once.
   const dispatch=voice.dispatch;voice.dispatch=async()=>{};const queued=randomUUID();
   try{await voice.create(org,user,{...b,requestId:queued},wav(),'queued');}finally{voice.dispatch=dispatch;}
   assert.equal((await voice.load(org,user,queued)).status,'QUEUED');
   provider.run=async()=>{calls++;return {text:'Synthetic restart recovery'};};const resumed=new VoiceService(db,policy,audit,provider),another=new VoiceService(db,policy,audit,provider),prior=calls;
   await Promise.all([resumed.get(org,user,queued),another.get(org,user,queued)]);
   for(let i=0;i<50&&(await resumed.load(org,user,queued)).status!=='SUCCEEDED';i++)await new Promise(r=>setTimeout(r,20));
   assert.equal((await resumed.load(org,user,queued)).result_text,'Synthetic restart recovery');assert.equal(calls,prior+1);
   // Stale RUNNING becomes UNKNOWN without replay; expired jobs disappear from APIs.
   await admin.query("UPDATE voice_job SET status='RUNNING',updated_at=now()-interval '3 minutes' WHERE id=$1",[queued]);
   const beforeStale=calls;assert.equal((await resumed.get(org,user,queued)).status,'UNKNOWN');assert.equal(calls,beforeStale);
   await admin.query("UPDATE voice_job SET expires_at=now()-interval '1 second' WHERE id=$1",[queued]);
   await assert.rejects(resumed.load(org,user,queued),e=>e.getStatus()===404);assert.ok(!(await resumed.history(org,user,scope)).some(j=>j.id===queued));
   const cleanup=randomUUID();await voice.create(org,user,{...b,requestId:cleanup},wav(),'expiry-cleanup');await wait(cleanup);
   assert.equal((await admin.query('SELECT id FROM voice_job WHERE id=$1',[queued])).rowCount,0);
   const member=config.TEST_MEMBER;let finish;provider.run=async()=>{await new Promise(resolve=>finish=resolve);return {text:'MUST NOT LEAK AFTER REVOCATION'};};
   const revokedId=randomUUID();await voice.create(org,member,{...b,requestId:revokedId},wav(),'revoked');
   for(let i=0;i<50&&!finish;i++)await new Promise(r=>setTimeout(r,20));assert.equal(typeof finish,'function');
   await admin.query("UPDATE org_membership SET status='SUSPENDED' WHERE organization_id=$1 AND user_id=$2",[org,member]);finish();
   await new Promise(r=>setTimeout(r,300));await assert.rejects(voice.get(org,member,revokedId),e=>e.getStatus()===404);
   const row=(await admin.query('SELECT result_text,result_audio,status FROM voice_job WHERE id=$1',[revokedId])).rows[0];assert.equal(row.result_text,null);assert.equal(row.result_audio,null);assert.equal(row.status,'UNKNOWN');
  }finally{await admin.query("UPDATE org_membership SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2",[org,config.TEST_MEMBER]);await admin.end();}
  const logs=await db.withOrgUser(org,user,tx=>tx.operLog.findMany({where:{action:'voice:create',resourceId:id}}));assert.ok(logs.length);assert.ok(!JSON.stringify(logs).includes('Synthetic transcript'));
  console.log('PASSED isolated PG: durable STT/TTS fixture, idempotency/conflict, org+actor RLS, forbidden scope, cancellation data removal, concurrency rejection, fresh-instance queued recovery/one claim, stale RUNNING to UNKNOWN, expiry denial/cleanup, UNKNOWN no retry, recovery/history, mid-flight membership revocation, redacted audit');
 }finally{await db.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
