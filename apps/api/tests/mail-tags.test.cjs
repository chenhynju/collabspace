const {test}=require('node:test'),assert=require('node:assert/strict');
const {ConfigService}=require('@nestjs/config');
const {MailService}=require('../dist/modules/mail/mail.service');
test('all CollabSpace mail entrypoints automatically carry stable project/business tags',async()=>{
 const s=new MailService(new ConfigService({EMAIL_PROVIDER:'console'})),calls=[];
 s.resend={emails:{send:async(...args)=>{calls.push(args);return {data:{id:'synthetic-receipt'},error:null};}}};
 await s.sendVerificationEmail('test@example.test','https://example.test/verify');
 await s.sendPasswordResetEmail('test@example.test','https://example.test/reset');
 await s.sendInvitationEmail('test@example.test','https://example.test/invite','Synthetic org','synthetic-invite');
 assert.deepEqual(calls.map(c=>c[0].tags),['verification','password_reset','invitation'].map(module=>[{name:'app',value:'collabspace'},{name:'module',value:module}]));
 assert.equal(calls[2][1].idempotencyKey,'collabspace-invitation-synthetic-invite');
 s.resend.emails.send=async()=>({data:null,error:null});await assert.rejects(s.sendVerificationEmail('test@example.test','https://example.test'),/missing receipt/);
});
