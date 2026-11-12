const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
require('../node_modules/ts-node').register({project:path.join(__dirname,'../tsconfig.json'),transpileOnly:true});
const {meetingInput,mediaRoom,mediaIdentity}=require('../src/modules/meetings/meeting-domain');
const {MeetingMediaService}=require('../src/modules/meetings/meeting-media.service');

test('meeting input bounds, stable opaque room and identity',()=>{
 const requestId=randomUUID();assert.equal(meetingInput({requestId,projectId:'p',title:'  评审  '}).title,'评审');
 for(const b of [{requestId:'x',projectId:'p',title:'x'},{requestId,projectId:'',title:'x'},{requestId,projectId:'p',title:' '},{requestId,projectId:'p',title:'x'.repeat(121)}])assert.throws(()=>meetingInput(b));
 assert.notEqual(mediaRoom('a',requestId),mediaRoom('b',requestId));assert.equal(mediaRoom('a',requestId),mediaRoom('a',requestId));
 assert.ok(!mediaIdentity('a','person@example.com').includes('person'));assert.notEqual(mediaIdentity('a','u'),mediaIdentity('b','u'));
});
test('media fails closed without configuration; actual signed JWT grants no administration or data publication',async()=>{
 const names=['MEETINGS_ENABLED','LIVEKIT_URL','LIVEKIT_API_KEY','LIVEKIT_API_SECRET','LIVEKIT_DEPLOYMENT','NODE_ENV'],old=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 try{
  for(const k of names)delete process.env[k];const p=new MeetingMediaService();assert.equal(p.status().configured,false);await assert.rejects(p.ticket('org',randomUUID(),'user'),e=>e.getStatus()===503);
  Object.assign(process.env,{MEETINGS_ENABLED:'true',LIVEKIT_URL:'wss://synthetic.livekit.cloud',LIVEKIT_API_KEY:'synthetic-key',LIVEKIT_API_SECRET:'synthetic-secret-not-a-real-key-12345678',LIVEKIT_DEPLOYMENT:'cloud'});
  const id=randomUUID(),receipt=await p.ticket('org',id,'user'),jwt=JSON.parse(Buffer.from(receipt.token.split('.')[1],'base64url'));
  assert.equal(receipt.expiresIn,600);assert.equal(jwt.video.room,mediaRoom('org',id));assert.equal(jwt.sub,mediaIdentity('org','user'));assert.equal(jwt.exp-jwt.nbf,600);
  assert.equal(jwt.video.roomJoin,true);assert.equal(jwt.video.canPublishData,false);for(const grant of ['roomAdmin','roomCreate','roomRecord'])assert.ok(!jwt.video[grant]);
  for(const url of ['https://synthetic.livekit.cloud','wss://example.com','wss://u:p@synthetic.livekit.cloud','wss://synthetic.livekit.cloud/?secret=bad']){process.env.LIVEKIT_URL=url;assert.equal(p.status().configured,false);}
  Object.assign(process.env,{LIVEKIT_DEPLOYMENT:'self-hosted',LIVEKIT_URL:'ws://127.0.0.1:7880',NODE_ENV:'test'});assert.equal(p.status().configured,false);await assert.rejects(p.ticket('org',randomUUID(),'user'),e=>e.getStatus()===503);process.env.NODE_ENV='production';assert.equal(p.status().configured,false);
 }finally{for(const k of names){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});


test('Cloud ending revokes issued identities with explicit cutoff before deletion and fails closed',async()=>{
 const {RoomServiceClient}=require('livekit-server-sdk');const proto=RoomServiceClient.prototype,old={list:proto.listParticipants,remove:proto.removeParticipant,del:proto.deleteRoom};const env={...process.env};
 try{Object.assign(process.env,{LIVEKIT_URL:'wss://synthetic.livekit.cloud',LIVEKIT_API_KEY:'synthetic',LIVEKIT_API_SECRET:'synthetic-secret-not-real-123456789',LIVEKIT_DEPLOYMENT:'cloud'});const events=[];proto.listParticipants=async()=>[];proto.removeParticipant=async(room,identity,options)=>{assert.ok(options.revokeTokenTs>BigInt(Math.floor(Date.now()/1000)+20));events.push('revoke');};proto.deleteRoom=async()=>{events.push('delete');};const p=new MeetingMediaService();await p.end('org',randomUUID(),['one','two']);assert.deepEqual(events,['revoke','revoke','delete']);events.length=0;proto.removeParticipant=async()=>{throw Error('uncertain revocation');};await assert.rejects(p.end('org',randomUUID(),['one']),e=>e.getStatus()===503);assert.deepEqual(events,[]);await assert.rejects(p.end('org',randomUUID(),[]),e=>e.getStatus()===503);
 }finally{proto.listParticipants=old.list;proto.removeParticipant=old.remove;proto.deleteRoom=old.del;for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);}
});

test('server monitor revokes a denied subject; uncertain authorization never records success',async()=>{
 const {MeetingsService}=require('../src/modules/meetings/meetings.service');const previous=process.env.MEETINGS_ACCESS_MONITOR_ENABLED;process.env.MEETINGS_ACCESS_MONITOR_ENABLED='true';
 try{let unknown=false,cloudFails=true,revokes=0,marked=0;const audits=[];
 const candidate={id:randomUUID(),organization_id:'org',project_id:'project',issued_user_ids:['member'],revoked_user_ids:[],status:'ACTIVE'};
 const prisma={$queryRaw:async()=>[candidate],withOrgUser:async(org,user,fn)=>{assert.equal(org,'org');assert.equal(user,'member');let calls=0;return fn({$queryRaw:async()=>{if(unknown)throw Error('database unavailable');return calls++===0?[{status:'ACTIVE'}]:[];}});},withOrg:async(org,fn)=>{assert.equal(org,'org');return fn({$queryRaw:async()=>{marked++;return[{id:candidate.id}];}});}};
 const media={status:()=>({enabled:true,configured:true}),revoke:async(org,id,user)=>{assert.deepEqual([org,id,user],['org',candidate.id,'member']);revokes++;if(cloudFails)throw Error('provider unavailable');}};
 const service=new MeetingsService(prisma,{}, {record:async(tx,input)=>audits.push(input)},media);
 await service.checkAccess();assert.equal(revokes,1);assert.equal(marked,0);assert.equal(audits.length,0);
 cloudFails=false;await service.checkAccess();assert.equal(revokes,2);assert.equal(marked,1);assert.equal(audits[0].actorId,null);assert.equal(audits[0].after.mediaAccess,false);
 unknown=true;await service.checkAccess();assert.equal(revokes,2);assert.equal(marked,1);
 }finally{if(previous===undefined)delete process.env.MEETINGS_ACCESS_MONITOR_ENABLED;else process.env.MEETINGS_ACCESS_MONITOR_ENABLED=previous;}
});

test('application admission is disabled without the server access monitor',async()=>{
 const {MeetingsService}=require('../src/modules/meetings/meetings.service'),old=process.env.MEETINGS_ACCESS_MONITOR_ENABLED;delete process.env.MEETINGS_ACCESS_MONITOR_ENABLED;
 try{let signed=0;const id=randomUUID(),meeting={id,project_id:'project',status:'ACTIVE',issued_user_ids:[]};const prisma={withOrgUser:async(org,user,fn)=>fn({$queryRaw:async parts=>parts.join('').includes('SELECT * FROM rtc_meeting')?[meeting]:[{id:'project'}],$executeRaw:async()=>1})};const media={status:()=>({enabled:true,configured:true}),ticket:async()=>{signed++;return{};}};const service=new MeetingsService(prisma,{assert:async()=>{}},{},media);assert.equal(service.status().configured,false);await assert.rejects(service.join('org','user',id),e=>e.getStatus()===503);assert.equal(signed,0);
 }finally{if(old===undefined)delete process.env.MEETINGS_ACCESS_MONITOR_ENABLED;else process.env.MEETINGS_ACCESS_MONITOR_ENABLED=old;}
});

test('pending host end is retried by the server; provider failure cannot report completion',async()=>{
 const {MeetingsService}=require('../src/modules/meetings/meetings.service');const old=process.env.MEETINGS_ACCESS_MONITOR_ENABLED;process.env.MEETINGS_ACCESS_MONITOR_ENABLED='true';
 try{
  const meeting={id:randomUUID(),organization_id:'org',project_id:'project',issued_user_ids:['host'],revoked_user_ids:[],status:'ENDING'};
  let providerFails=true,dbWrites=0,ended=false;const audits=[];
  const prisma={$queryRaw:async()=>ended?[]:[meeting],withOrg:async(org,fn)=>{assert.equal(org,'org');return fn({$queryRaw:async sql=>{assert.match(sql.join(''),/status='ENDING'/);dbWrites++;ended=true;return[{id:meeting.id}];}});}};
  const media={status:()=>({enabled:true,configured:true}),end:async(org,id,users)=>{assert.deepEqual([org,id,users],['org',meeting.id,['host']]);if(providerFails)throw Error('network unavailable');}};
  const service=new MeetingsService(prisma,{}, {record:async(tx,input)=>audits.push(input)},media);
  await service.checkAccess();assert.equal(dbWrites,0);assert.equal(audits.length,0);
  providerFails=false;await service.checkAccess();assert.equal(dbWrites,1);assert.equal(audits[0].actorId,null);assert.equal(audits[0].after.source,'server-monitor');assert.equal(audits[0].action,'meeting:ended');
  await service.checkAccess();assert.equal(dbWrites,1);assert.equal(audits.length,1);
 }finally{if(old===undefined)delete process.env.MEETINGS_ACCESS_MONITOR_ENABLED;else process.env.MEETINGS_ACCESS_MONITOR_ENABLED=old;}
});
