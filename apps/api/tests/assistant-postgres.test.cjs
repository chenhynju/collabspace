const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('crypto');
test('real nonprivileged PostgreSQL: mail intent commit, replay, payload binding, tenant RLS and foreign project refusal',{skip:!process.env.ASSISTANT_TEST_CONFIG},async()=>{
 const config=require(require('path').resolve(process.env.ASSISTANT_TEST_CONFIG));
 const url=new URL(config.DATABASE_URL);assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.ok(['5559','5560'].includes(url.port));
 const {PrismaService}=require('../dist/prisma/prisma.service'),{ResourcePolicyService}=require('../dist/modules/groups/resource-policy.service'),{AuditService}=require('../dist/modules/audit/audit.service'),{ProjectMailService}=require('../dist/modules/assistant/project-mail.service');
 const db=new PrismaService({datasources:{db:{url:config.DATABASE_URL}}}),policy=new ResourcePolicyService(db),audit=new AuditService(db);let calls=0;
 const provider={isLive:true,sendProjectEmail:async()=>{calls++;return {provider:'resend',id:'synthetic-'+randomUUID()};}};
 const mail=new ProjectMailService(db,policy,provider,audit),org={organizationId:config.TEST_ORG,perms:['*'],roleKeys:['OWNER']},u={id:config.TEST_OWNER};
 const b={projectId:config.TEST_PROJECT,requestId:randomUUID(),confirmed:true,to:'synthetic@example.test',subject:'Synthetic delivery',text:'Only synthetic fixture content.'};
 try{
  const sent=await mail.send(org,u,b,'assistant-pg-test');assert.equal(sent.status,'ACCEPTED');assert.equal(calls,1);
  const duplicate=await mail.send(org,u,b,'assistant-pg-test');assert.equal(duplicate.id,sent.id);assert.equal(calls,1);
  await assert.rejects(mail.send(org,u,{...b,text:'Different content'},'assistant-pg-test'),e=>e.getStatus()===409);assert.equal(calls,1);
  assert.ok((await mail.list(org,u,b.projectId)).some(r=>r.id===b.requestId));
  const foreign=await db.withOrg(config.TEST_OTHER_ORG,tx=>tx.$queryRaw`SELECT id FROM assistant_mail_attempt WHERE id=${b.requestId}::uuid`);assert.equal(foreign.length,0);
  await assert.rejects(mail.send({...org,organizationId:config.TEST_OTHER_ORG},{id:config.TEST_OTHER_USER},{...b,requestId:randomUUID()},'foreign'),e=>e.getStatus()===404);assert.equal(calls,1);
  const noContext=await db.$queryRaw`SELECT id FROM assistant_mail_attempt WHERE id=${b.requestId}::uuid`;assert.equal(noContext.length,0);
 }finally{await db.$disconnect();}
});
