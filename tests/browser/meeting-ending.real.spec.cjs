const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
test.skip(process.env.RTC_VOICE_REAL_TEST!=='1','Explicit isolated real-provider test opt-in');
test('server recovers durable ENDING intent without the host browser',async({request})=>{
 test.setTimeout(240000);
 const root=path.resolve(__dirname,'../..'),c=JSON.parse(fs.readFileSync(process.env.COLLAB_BROWSER_CONFIG));
 for(const u of [c.WEB_URL,c.NEXT_PUBLIC_API_URL,c.DATABASE_ADMIN_URL])expect(['localhost','127.0.0.1']).toContain(new URL(u).hostname);
 expect(new URL(c.NEXT_PUBLIC_API_URL).port).toBe('14431');expect(new URL(c.DATABASE_ADMIN_URL).port).toBe('15570');
 await expect.poll(async()=>{try{const r=await request.get(c.NEXT_PUBLIC_API_URL+'/health/ready',{timeout:5000});return r.ok()&&(await r.json()).status==='ok';}catch{return false;}},{timeout:120000}).toBe(true);
 const env=require(path.join(root,'apps/api/node_modules/dotenv')).parse(fs.readFileSync(path.join(root,'.test-runs/private/third-party.env'))),{RoomServiceClient}=require(path.join(root,'apps/api/node_modules/livekit-server-sdk'));
 const cloud=new RoomServiceClient(env.LIVEKIT_URL.replace(/^ws/,'http'),env.LIVEKIT_API_KEY,env.LIVEKIT_API_SECRET,{requestTimeout:10,failover:false});
 const {Client}=require(path.join(root,'packages/collab-store/node_modules/pg')),db=new Client({connectionString:c.DATABASE_ADMIN_URL});await db.connect();let id,headers,failed=false;
 try{
  const login=await request.post(c.NEXT_PUBLIC_API_URL+'/auth/login',{data:{email:'owner@acme.dev',password:'Passw0rd!'}});expect(login.ok()).toBeTruthy();headers={Authorization:'Bearer '+(await login.json()).accessToken,'x-organization-id':c.TEST_ORG};
  const created=await request.post(c.NEXT_PUBLIC_API_URL+'/meetings',{headers,data:{requestId:randomUUID(),projectId:c.TEST_PROJECT,title:'R4 pending end '+Date.now()}});expect(created.status()).toBe(201);const meeting=await created.json();id=meeting.id;
  expect((await request.post(c.NEXT_PUBLIC_API_URL+'/meetings/'+id+'/join',{headers,data:{}})).status()).toBe(201);
  const room='rtc_'+createHash('sha256').update(JSON.stringify([c.TEST_ORG,id])).digest('hex');await cloud.createRoom({name:room});
  // Isolated fixture: process interruption after host end intent was persisted.
  // No provider failure is mocked; recovery uses real Cloud revoke/delete RPCs.
  const changed=await db.query("UPDATE rtc_meeting SET status='ENDING' WHERE id=$1 AND organization_id=$2 AND host_id=$3 AND status='ACTIVE' RETURNING id",[id,c.TEST_ORG,meeting.host_id]);expect(changed.rowCount).toBe(1);
  await expect.poll(async()=>{const r=await db.query('SELECT status FROM rtc_meeting WHERE id=$1 AND organization_id=$2',[id,c.TEST_ORG]);return r.rows[0]?.status;},{timeout:120000,intervals:[1000,3000,5000]}).toBe('ENDED');
  expect((await cloud.listRooms([room])).length).toBe(0);
  const audit=await db.query("SELECT actor_id,after_value FROM sys_oper_log WHERE organization_id=$1 AND resource_id=$2 AND action='meeting:ended'",[c.TEST_ORG,id]);
  expect(audit.rows.length).toBe(1);expect(audit.rows[0].actor_id).toBeNull();
  expect(JSON.stringify(audit.rows[0].after_value)).toContain('server-monitor');
  const repeated=await request.post(c.NEXT_PUBLIC_API_URL+'/meetings/'+id+'/end',{headers,data:{}});expect(repeated.status()).toBe(201);expect((await repeated.json()).status).toBe('ENDED');
 }catch(error){failed=true;throw error;}finally{try{if(id&&headers){const end=await request.post(c.NEXT_PUBLIC_API_URL+'/meetings/'+id+'/end',{headers,data:{}});console.log('Pending-end cleanup HTTP '+end.status());if(!failed)expect(end.status()).toBe(201);}}finally{await db.end();}}
});
