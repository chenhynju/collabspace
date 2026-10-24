const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {ConfigService}=require('@nestjs/config');
const {mailEnvelope,MailWebhookService}=require('../dist/modules/mail/mail-webhook.service');
const {MailWebhookController}=require('../dist/modules/mail/mail-webhook.controller');
const event=(app='collabspace',module='invitation')=>({type:'email.delivered',created_at:'2026-10-24T00:00:00Z',data:{email_id:'synthetic-email',to:['private@example.test'],tags:{app,module}}});
test('routing metadata accepts array/object tags and removes private fields',()=>{
 const e=event(),v=mailEnvelope('evt_1',e);assert.equal(v.module,'invitation');assert.ok(!JSON.stringify(v).includes('private@'));
 e.data.tags=[{name:'app',value:'portfolio'},{name:'module',value:'contact'}];assert.equal(mailEnvelope('evt_2',e).app,'portfolio');
 e.data.tags={app:'https://evil.test',module:'../escape'};assert.equal(mailEnvelope('evt_3',e).app,'unclassified');
 assert.equal(mailEnvelope('evt_4',{type:'contact.created'}),null);
 assert.throws(()=>mailEnvelope('evt_5',{...event(),created_at:'invalid'}),/INVALID_MAIL_EVENT/);
});
test('controller requires real signature, rejects tamper/stale, and propagates persistence failure',async()=>{
 const key=crypto.randomBytes(32),secret='whsec_'+key.toString('base64'),config=new ConfigService({RESEND_WEBHOOK_SECRET:secret});
 let calls=0;const controller=new MailWebhookController(config,{receive:async()=>{calls++;return {received:true};}});
 const body=JSON.stringify(event()),id='msg_test';
 const request=(text=body,time=String(Math.floor(Date.now()/1000)))=>{const sig=crypto.createHmac('sha256',key).update(`${id}.${time}.${body}`).digest('base64');const headers={'svix-id':id,'svix-timestamp':time,'svix-signature':'v1,'+sig};return {rawBody:Buffer.from(text),header:n=>headers[n]};};
 assert.deepEqual(await controller.receive(request()),{received:true});
 await assert.rejects(controller.receive(request(body+' ')),/INVALID_MAIL_SIGNATURE/);
 await assert.rejects(controller.receive(request(body,'1')),/INVALID_MAIL_SIGNATURE/);assert.equal(calls,1);
 const broken=new MailWebhookController(config,{receive:async()=>{throw Error('db unavailable');}});await assert.rejects(broken.receive(request()),/db unavailable/);
 await assert.rejects(new MailWebhookController(new ConfigService({}),{}).receive(request()),/NOT_CONFIGURED/);
});
test('same project routes business modules to separate fixed destinations; insecure routes rejected',async()=>{
 const rows=[];const db={$queryRaw:async(strings,...values)=>{rows.push(values);return [{payload_hash:values[1]}];}};
 const config=new ConfigService({MAIL_ROUTE_TEST_SECRET:'a'.repeat(32),MAIL_WEBHOOK_ROUTES:JSON.stringify({
  'collabspace.invitation':{url:'https://invite.example.test/hook',secretEnv:'MAIL_ROUTE_TEST_SECRET'},
  'collabspace.verification':{url:'https://auth.example.test/hook',secretEnv:'MAIL_ROUTE_TEST_SECRET'}
 })});
 const service=new MailWebhookService(db,config);
 await service.receive('e1',event('collabspace','invitation'));await service.receive('e2',event('collabspace','verification'));
 assert.equal(rows[0][3],'collabspace.invitation');assert.equal(rows[1][3],'collabspace.verification');assert.equal(rows[0][4],'PENDING');
 const bad=new MailWebhookService(db,new ConfigService({MAIL_WEBHOOK_ROUTES:JSON.stringify({'collabspace.invitation':{url:'http://unsafe.example.test',secretEnv:'MAIL_ROUTE_TEST_SECRET'}}),MAIL_ROUTE_TEST_SECRET:'a'.repeat(32)}));
 await assert.rejects(bad.receive('e3',event()),/INVALID_MAIL_ROUTE/);assert.equal(rows.length,2);
});
test('real nonprivileged PostgreSQL: duplicate/conflict, local module separation, unrouted and atomic failure',{skip:!process.env.MAIL_TEST_DATABASE_URL},async()=>{
 const {PrismaService}=require('../dist/prisma/prisma.service');const db=new PrismaService({datasources:{db:{url:process.env.MAIL_TEST_DATABASE_URL}}});
 const prefix='test_'+crypto.randomUUID();const service=new MailWebhookService(db,new ConfigService({}));
 try{
  await Promise.all(Array.from({length:8},()=>service.receive(prefix,event())));
  let rows=await db.$queryRaw`SELECT * FROM mail_webhook_event WHERE event_id=${prefix}`;assert.equal(rows.length,1);assert.equal(rows[0].status,'RECORDED');
  await assert.rejects(service.receive(prefix,event('collabspace','verification')),/CONFLICT/);
  await service.receive(prefix+'_other',event('portfolio','contact'));
  rows=await db.$queryRaw`SELECT status FROM mail_webhook_event WHERE event_id=${prefix+'_other'}`;assert.equal(rows[0].status,'UNROUTED');
  const config=new ConfigService({RESEND_WEBHOOK_SECRET:'enabled',MAIL_ROUTE_TEST_SECRET:'a'.repeat(32),MAIL_WEBHOOK_ROUTES:JSON.stringify({'portfolio.contact':{url:'https://destination.example.test/hooks',secretEnv:'MAIL_ROUTE_TEST_SECRET'}})});
  const router=new MailWebhookService(db,config);await router.receive(prefix+'_route',event('portfolio','contact'));
  const original=global.fetch;let received;
  global.fetch=async(url,init)=>{received={url,init};return {ok:false,body:null};};
  try{await router.dispatch();rows=await db.$queryRaw`SELECT status,attempts FROM mail_webhook_event WHERE event_id=${prefix+'_route'}`;assert.equal(rows[0].status,'PENDING');assert.equal(rows[0].attempts,1);
   const {init}=received;assert.equal(init.redirect,'error');const h=init.headers;assert.equal(h['x-mail-signature'],crypto.createHmac('sha256','a'.repeat(32)).update(`${h['x-mail-timestamp']}.${h['x-mail-event-id']}.${init.body}`).digest('hex'));
   await db.$executeRaw`UPDATE mail_webhook_event SET next_attempt_at=now() WHERE event_id=${prefix+'_route'}`;
   global.fetch=async()=>({ok:true,body:null});await router.dispatch();rows=await db.$queryRaw`SELECT status FROM mail_webhook_event WHERE event_id=${prefix+'_route'}`;assert.equal(rows[0].status,'FORWARDED');
  }finally{global.fetch=original;}
 }finally{await db.$disconnect();}
});
