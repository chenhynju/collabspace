const {test}=require('node:test'),assert=require('node:assert/strict');
const {ProjectMailService}=require('../dist/modules/assistant/project-mail.service');
const {MailService}=require('../dist/modules/mail/mail.service');
const {ConfigService}=require('@nestjs/config');
const {randomUUID}=require('crypto');
const org={organizationId:'org-a',perms:['invite:send'],roleKeys:[]},user={id:'actor'};
const body=()=>({projectId:'project',requestId:randomUUID(),confirmed:true,to:'synthetic@example.test',subject:'Delivery',text:'Synthetic project delivery only.'});
function fixture(){
 const rows=new Map(),calls=[],logs=[];let denied=false,fail=false;
 const tx={
  $queryRaw:async(strings,...values)=>{
   const sql=strings.join('?');
   if(sql.includes('SELECT *')){const r=rows.get(values[2]);return r?[r]:[];}
   if(sql.includes('count(*)'))return [{n:rows.size}];
   return [...rows.values()];
  },
  $executeRaw:async(strings,...v)=>{
   const sql=strings.join('?');
   if(sql.includes('INSERT INTO'))rows.set(v[0],{id:v[0],organization_id:v[1],actor_id:v[2],project_id:v[3],payload_hash:v[4],status:'SENDING',created_at:new Date(),updated_at:new Date()});
   if(sql.includes("status='ACCEPTED'")){const r=rows.get(v[3]);r.status='ACCEPTED';r.provider_id=v[0];}
   if(sql.includes("status='UNKNOWN'")){const r=rows.get(v[2]);if(r.status!=='ACCEPTED')r.status='UNKNOWN';}
   return 1;
  },
 };
 const prisma={withOrg:async(id,fn)=>{assert.equal(id,'org-a');return fn(tx);}};
 const policy={assert:async(tx,o,u,p,action)=>{assert.equal(o,'org-a');assert.equal(u,'actor');if(denied)throw Error('access denied');}};
 const mail={isLive:true,sendProjectEmail:async(...args)=>{calls.push(args);if(fail)throw Error('timeout');return {provider:'resend',id:'synthetic-receipt'};}};
 const service=new ProjectMailService(prisma,policy,mail,{record:async(tx,entry)=>logs.push(entry)});
 return {service,rows,calls,logs,mail,deny:()=>denied=true,setFail:v=>fail=v};
}
test('confirmation, permission and live configuration required before any external call',async()=>{
 const f=fixture(),b=body();
 await assert.rejects(f.service.send(org,user,{...b,confirmed:false},'trace'),e=>e.getStatus()===400);
 await assert.rejects(f.service.send({...org,perms:[]},user,b,'trace'),e=>e.getStatus()===403);
 f.mail.isLive=false;await assert.rejects(f.service.send(org,user,b,'trace'),e=>e.getStatus()===503);
 f.mail.isLive=true;f.deny();await assert.rejects(f.service.send(org,user,b,'trace'),/access denied/);
 assert.equal(f.calls.length,0);
});
test('durable intent, duplicate replay and content binding prevent duplicate mail',async()=>{
 const f=fixture(),b=body();const first=await f.service.send(org,user,b,'trace');assert.equal(first.status,'ACCEPTED');assert.equal(f.rows.get(b.requestId).status,'ACCEPTED');
 await f.service.send(org,user,b,'trace');assert.equal(f.calls.length,1);
 await assert.rejects(f.service.send(org,user,{...b,text:'Changed content'},'trace'),e=>e.getStatus()===409);
 assert.equal(f.calls.length,1);assert.ok(!JSON.stringify(f.logs).includes(b.text));assert.ok(!JSON.stringify([...f.rows.values()]).includes(b.to));
});
test('unknown send result retains idempotency key, blocks immediate retry and expires safely',async()=>{
 const f=fixture(),b=body();f.setFail(true);
 await assert.rejects(f.service.send(org,user,b,'trace'),e=>e.getStatus()===502);assert.equal(f.rows.get(b.requestId).status,'UNKNOWN');
 await assert.rejects(f.service.send(org,user,b,'trace'),e=>e.getStatus()===409);assert.equal(f.calls.length,1);
 f.rows.get(b.requestId).updated_at=new Date(Date.now()-61000);f.setFail(false);await f.service.send(org,user,b,'trace');assert.equal(f.calls[0][3],f.calls[1][3]);
 f.rows.get(b.requestId).status='UNKNOWN';f.rows.get(b.requestId).created_at=new Date(Date.now()-24*3600000);
 await assert.rejects(f.service.send(org,user,b,'trace'),e=>e.getStatus()===409);
});
test('project emails escape HTML and use existing routing tags and provider idempotency',async()=>{
 const mail=new MailService(new ConfigService({EMAIL_PROVIDER:'console'}));let captured;
 mail.resend={emails:{send:async(...args)=>{captured=args;return {data:{id:'synthetic-id'}};}}};
 await mail.sendProjectEmail('test@example.test','subject','<img src=x onerror=alert(1)>','same-key');
 assert.ok(captured[0].html.includes('&lt;img'));assert.ok(!captured[0].html.includes('<img'));
 assert.deepEqual(captured[0].tags,[{name:'app',value:'collabspace'},{name:'module',value:'project_mail'}]);assert.equal(captured[1].idempotencyKey,'same-key');
});
