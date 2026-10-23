const {test}=require('node:test'),assert=require('node:assert/strict'),{randomBytes}=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const cfg=process.env.INVITATION_TEST_CONFIG?JSON.parse(fs.readFileSync(process.env.INVITATION_TEST_CONFIG)):null;
test('real HTTP + nonprivileged PG: personal invitations, decisions, RLS, encrypted outbox and invited registration',{skip:!cfg,timeout:180000},async()=>{
 const {Client}=createRequire(path.resolve('packages/collab-store/package.json'))('pg'),admin=new Client({connectionString:cfg.DATABASE_ADMIN_URL}),runtime=new Client({connectionString:cfg.DATABASE_URL});await admin.connect();await runtime.connect();const base=cfg.NEXT_PUBLIC_API_URL||'http://localhost:3001/api/v1',users=[],password='Invite-'+randomBytes(18).toString('base64url')+'!';const stamp=Date.now();
 async function req(route,token,org,data){const r=await fetch(base+route,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(org?{'x-organization-id':org}:{})},body:data===undefined?undefined:JSON.stringify(data)});let b;try{b=await r.json()}catch{}return{status:r.status,b};}
 const ok=r=>{assert.ok(r.status>=200&&r.status<300,JSON.stringify(r));return r.b;};
 async function signup(label,extra={}){const email=label+'-'+stamp+'-'+randomBytes(3).toString('hex')+'@example.invalid';ok(await req('/auth/register',null,null,{email,password,name:'邀请验收 '+label,...extra}));await admin.query('UPDATE sys_user SET email_verified_at=now() WHERE email=$1',[email]);const token=ok(await req('/auth/login',null,null,{email,password})).accessToken;const me=ok(await req('/users/me',token));const u={email,password,token,id:me.id,org:me.organizations[0].id};users.push(u);return u;}
 try{
 const sender=await signup('invite-sender'),receiver=await signup('invite-receiver'),outsider=await signup('invite-outsider');
 const role=ok(await req('/roles',sender.token,sender.org)).find(r=>r.key==='MEMBER');assert.ok(role);
 const invite=ok(await req('/invitations',sender.token,sender.org,{email:receiver.email,roleId:role.id}));assert.equal(invite.delivery,'IN_APP');assert.equal(invite.inviteUrl,undefined);
 assert.equal((await req('/projects',receiver.token,sender.org)).status,403);
 const inbox=ok(await req('/notifications',receiver.token));const notification=inbox.find(n=>n.invitation_id===invite.id);assert.ok(notification);assert.equal(ok(await req('/notifications/unread-count',receiver.token)).count,1);
 assert.equal((await req('/invitations/'+invite.id+'/details',outsider.token)).status,404);assert.equal((await req('/notifications/'+notification.id+'/read',outsider.token,null,{})).status,404);
 await runtime.query('BEGIN');await runtime.query("SELECT set_config('app.current_user_id',$1,true)",[outsider.id]);assert.equal((await runtime.query('SELECT * FROM personal_notification WHERE id=$1',[notification.id])).rows.length,0);await assert.rejects(runtime.query("UPDATE personal_notification SET title='forged'"),/permission denied/);await runtime.query('ROLLBACK');
 assert.equal((await req('/invitations',sender.token,sender.org,{email:receiver.email,roleId:role.id})).status,409);
 const originalSeats=(await admin.query('SELECT seats_included FROM bill_entitlement WHERE organization_id=$1',[sender.org])).rows[0].seats_included;
 try{
  await admin.query('UPDATE bill_entitlement SET seats_included=0 WHERE organization_id=$1',[sender.org]);assert.equal((await req('/invitations/'+invite.id+'/accept',receiver.token,null,{})).status,409);
 }finally{await admin.query('UPDATE bill_entitlement SET seats_included=$2 WHERE organization_id=$1',[sender.org,originalSeats]);}
 try{
  await admin.query("UPDATE org_membership SET status='SUSPENDED' WHERE organization_id=$1 AND user_id=$2",[sender.org,sender.id]);assert.equal((await req('/invitations/'+invite.id+'/accept',receiver.token,null,{})).status,403);
 }finally{await admin.query("UPDATE org_membership SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2",[sender.org,sender.id]);}
 try{
  await admin.query("UPDATE sys_role SET status='DISABLED' WHERE id=$1",[role.id]);assert.equal((await req('/invitations/'+invite.id+'/accept',receiver.token,null,{})).status,400);
 }finally{await admin.query("UPDATE sys_role SET status='NORMAL' WHERE id=$1",[role.id]);}
 try{
  await admin.query("UPDATE org_invitation SET expires_at=timezone('UTC',now())-interval '1 minute' WHERE id=$1",[invite.id]);assert.equal((await req('/invitations/'+invite.id+'/accept',receiver.token,null,{})).status,410);
 }finally{await admin.query("UPDATE org_invitation SET expires_at=timezone('UTC',now())+interval '7 days' WHERE id=$1",[invite.id]);}
 try{
  await admin.query("UPDATE sys_user SET status='DISABLED' WHERE id=$1",[sender.id]);assert.equal((await req('/invitations/'+invite.id+'/accept',receiver.token,null,{})).status,403);
 }finally{await admin.query("UPDATE sys_user SET status='NORMAL' WHERE id=$1",[sender.id]);}
 const otherRole=ok(await req('/roles',outsider.token,outsider.org)).find(r=>r.key==='MEMBER');assert.equal((await req('/invitations',sender.token,sender.org,{email:outsider.email,roleId:otherRole.id})).status,400);
 const results=await Promise.all([req('/invitations/'+invite.id+'/accept',receiver.token,null,{}),req('/invitations/'+invite.id+'/decline',receiver.token,null,{})]);assert.equal(results.filter(r=>r.status===201).length,1);const accepted=results[0].status===201;const action=accepted?'accept':'decline';ok(await req('/invitations/'+invite.id+'/'+action,receiver.token,null,{}));
 const resultInbox=ok(await req('/notifications',sender.token));assert.equal(resultInbox.filter(n=>n.invitation_id===invite.id&&n.event===(accepted?'ACCEPTED':'DECLINED')).length,1);assert.equal((await admin.query('SELECT * FROM org_membership WHERE organization_id=$1 AND user_id=$2',[sender.org,receiver.id])).rows.length,accepted?1:0);
 ok(await req('/notifications/'+notification.id+'/read',receiver.token,null,{}));assert.equal(ok(await req('/notifications/unread-count',receiver.token)).count,0);
 const decline=ok(await req('/invitations',sender.token,sender.org,{email:outsider.email,roleId:role.id}));ok(await req('/invitations/'+decline.id+'/decline',outsider.token,null,{}));assert.equal((await req('/projects',outsider.token,sender.org)).status,403);assert.ok(ok(await req('/notifications',sender.token)).some(n=>n.invitation_id===decline.id&&n.event==='DECLINED'));
 const freshEmail='invite-new-'+stamp+'@example.invalid',fresh=ok(await req('/invitations',sender.token,sender.org,{email:freshEmail,roleId:role.id}));assert.equal(fresh.simulation,true);const token=new URL(fresh.inviteUrl).searchParams.get('token');assert.equal(ok(await req('/invitations/preview?token='+token)).organization.id,sender.org);
 assert.equal((await req('/auth/register',null,null,{email:'wrong-'+stamp+'@example.invalid',name:'错误',password,inviteToken:token})).status,400);
 ok(await req('/auth/register',null,null,{email:freshEmail,name:'受邀新人',password,organizationName:'伪造组织不可采纳',inviteToken:token}));const fu=(await admin.query('SELECT id FROM sys_user WHERE email=$1',[freshEmail])).rows[0];assert.ok(fu);assert.equal((await admin.query('SELECT * FROM org_membership WHERE organization_id=$1 AND user_id=$2',[sender.org,fu.id])).rows.length,0);await admin.query('UPDATE sys_user SET email_verified_at=now() WHERE id=$1',[fu.id]);const ft=ok(await req('/auth/login',null,null,{email:freshEmail,password})).accessToken;const fm=ok(await req('/users/me',ft));assert.equal(fm.organizations.length,1);assert.notEqual(fm.organizations[0].id,sender.org);assert.equal(fm.organizations[0].name,'受邀新人 的个人空间');
 // Even with optional ordinary verification, skipping the invite token cannot forge email ownership.
 const unverifiedEmail='invite-unverified-'+stamp+'@example.invalid',unverifiedInvite=ok(await req('/invitations',sender.token,sender.org,{email:unverifiedEmail,roleId:role.id}));
 ok(await req('/auth/register',null,null,{email:unverifiedEmail,name:'未验证账号',password}));const unverified=(await admin.query('SELECT id,email_verified_at FROM sys_user WHERE email=$1',[unverifiedEmail])).rows[0];assert.equal(unverified.email_verified_at,null);
 const unverifiedLogin=await req('/auth/login',null,null,{email:unverifiedEmail,password});if(unverifiedLogin.status===201)assert.equal((await req('/invitations/'+unverifiedInvite.id+'/accept',unverifiedLogin.b.accessToken,null,{})).status,403);else assert.equal(unverifiedLogin.status,403);
 ok(await req('/invitations/accept',ft,null,{token}));assert.equal(ok(await req('/users/me',ft)).organizations.length,2);
 const delivery=(await admin.query('SELECT * FROM invitation_delivery WHERE invitation_id=$1',[fresh.id])).rows[0];assert.ok(!delivery.payload.includes(token)&&!delivery.payload.includes(freshEmail));
 const revoked=ok(await req('/invitations',sender.token,sender.org,{email:'invite-revoke-'+stamp+'@example.invalid',roleId:role.id}));ok(await req('/invitations/'+revoked.id+'/revoke',sender.token,sender.org,{}));assert.equal(ok(await req('/invitations/preview?token='+new URL(revoked.inviteUrl).searchParams.get('token'))).status,'REVOKED');
 fs.mkdirSync('.test-runs/invitations',{recursive:true});fs.writeFileSync('.test-runs/invitations/actors.json',JSON.stringify({sender,receiver,outsider,password,freshEmail,stamp,base,web:cfg.WEB_URL}));
 console.log('Registered inbox, recipient RLS, result idempotency, accept/decline race, personal signup and encrypted email queue passed');
 }finally{await Promise.allSettled([admin.end(),runtime.end()]);}
});
