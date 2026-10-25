// Requires the disposable scripts/local-up.cjs environment. Never uses a project .env.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module'),{randomUUID}=require('node:crypto');
const config=JSON.parse(fs.readFileSync('.test-runs/voice-persona/config.json','utf8'));
if(new URL(config.DATABASE_URL).hostname!=='127.0.0.1'||!config.DATABASE_URL.includes(':15439/'))throw Error('Only isolated voice-persona database allowed');
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
  release=null;const cancelId=randomUUID();await voice.create(org,user,{...b,requestId:cancelId},wav(),'cancel');
  for(let i=0;i<50&&typeof release!=='function';i++)await new Promise(r=>setTimeout(r,20));
  assert.equal(typeof release,'function');await voice.cancel(org,user,cancelId);release();assert.equal((await wait(cancelId)).status,'CANCELLED');
  provider.run=async()=>{calls++;throw Error('provider timed out');};
  const failId=randomUUID();await voice.create(org,user,{...b,requestId:failId},wav(),'failure');assert.equal((await wait(failId)).status,'UNKNOWN');const failedCalls=calls;await voice.create(org,user,{...b,requestId:failId},wav(),'retry');assert.equal(calls,failedCalls);
  provider.run=async()=>({audio:wav()});const recovered=randomUUID();await voice.create(org,user,{...scope,requestId:recovered,kind:'TTS',locale:'en-US',text:'Synthetic recovery'},undefined,'recovery');assert.equal((await wait(recovered)).status,'SUCCEEDED');assert.ok((await voice.load(org,user,recovered)).result_audio);
  const history=await voice.history(org,user,scope);assert.ok(history.some(j=>j.id===recovered&&j.hasAudio));
  const {Client}=require('../packages/collab-store/node_modules/pg');const admin=new Client({connectionString:config.DATABASE_ADMIN_URL});await admin.connect();
  try{
   const member=config.TEST_MEMBER;let finish;provider.run=async()=>{await new Promise(resolve=>finish=resolve);return {text:'MUST NOT LEAK AFTER REVOCATION'};};
   const revokedId=randomUUID();await voice.create(org,member,{...b,requestId:revokedId},wav(),'revoked');
   for(let i=0;i<50&&!finish;i++)await new Promise(r=>setTimeout(r,20));assert.equal(typeof finish,'function');
   await admin.query("UPDATE org_membership SET status='SUSPENDED' WHERE organization_id=$1 AND user_id=$2",[org,member]);finish();
   await new Promise(r=>setTimeout(r,300));await assert.rejects(voice.get(org,member,revokedId),e=>e.getStatus()===404);
   const row=(await admin.query('SELECT result_text,result_audio,status FROM voice_job WHERE id=$1',[revokedId])).rows[0];assert.equal(row.result_text,null);assert.equal(row.result_audio,null);assert.equal(row.status,'UNKNOWN');
  }finally{await admin.query("UPDATE org_membership SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2",[org,config.TEST_MEMBER]);await admin.end();}
  const logs=await db.withOrgUser(org,user,tx=>tx.operLog.findMany({where:{action:'voice:create',resourceId:id}}));assert.ok(logs.length);assert.ok(!JSON.stringify(logs).includes('Synthetic transcript'));
  console.log('PASSED isolated PG: durable STT/TTS fixture, idempotency/conflict, org+actor RLS, forbidden scope, cancellation, UNKNOWN no retry, recovery/history, mid-flight membership revocation, redacted audit');
 }finally{await db.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
