// Real vendor smoke test: synthetic browser media only; no microphone/camera capture.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..');
require('../apps/api/node_modules/ts-node').register({project:path.join(root,'apps/api/tsconfig.json'),transpileOnly:true});
const {MeetingMediaService}=require('../apps/api/src/modules/meetings/meeting-media.service');
const {mediaRoom}=require('../apps/api/src/modules/meetings/meeting-domain');
const {RoomServiceClient}=require('../apps/api/node_modules/livekit-server-sdk');
const {chromium}=require('@playwright/test');
const config=require('../apps/api/node_modules/dotenv').parse(fs.readFileSync(path.join(root,'.test-runs/private/third-party.env')));
for(const k of ['LIVEKIT_URL','LIVEKIT_API_KEY','LIVEKIT_API_SECRET']){if(!config[k])throw Error('Required field is empty: '+k);process.env[k]=config[k];}
process.env.LIVEKIT_DEPLOYMENT=config.LIVEKIT_DEPLOYMENT||'cloud';process.env.MEETINGS_ENABLED='true';
const media=new MeetingMediaService(),org='synthetic-rtc-acceptance',id=randomUUID();
let browser,server,created=false;const pages=[];
const result={kind:'REAL_LIVEKIT_SYNTHETIC_MEDIA',date:new Date().toISOString(),checks:{},scope:'SDK/vendor transport, not application HTTP authorization or physical microphone/camera or OS screen-picker acceptance'};
async function main(){
 assert.equal(media.status().configured,true,'Invalid LiveKit URL or deployment configuration');
 const api=new RoomServiceClient(config.LIVEKIT_URL.replace(/^ws/,'http'),config.LIVEKIT_API_KEY,config.LIVEKIT_API_SECRET,{requestTimeout:15,failover:false});
 await api.createRoom({name:mediaRoom(org,id),emptyTimeout:30,maxParticipants:2});created=true;result.checks.vendorAuth=true;
 const bundle=fs.readFileSync(path.join(root,'apps/web/node_modules/livekit-client/dist/livekit-client.umd.js'));
 server=http.createServer((req,res)=>{if(req.url==='/sdk.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle);}else{res.setHeader('Content-Type','text/html');res.end('<html><body><script src="/sdk.js"></script></body></html>');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 for(const user of ['one','two']){const context=await browser.newContext({permissions:['microphone','camera']});const p=await context.newPage();pages.push(p);await p.goto('http://127.0.0.1:'+server.address().port);const ticket=await media.ticket(org,id,user);
 await p.evaluate(async ticket=>{window.received=[];window.room=new LivekitClient.Room();room.on(LivekitClient.RoomEvent.TrackSubscribed,(track)=>{received.push(track.kind);const el=track.attach();el.autoplay=true;el.muted=true;document.body.appendChild(el);});await room.connect(ticket.url,ticket.token);await room.localParticipant.setMicrophoneEnabled(true);await room.localParticipant.setCameraEnabled(true);},ticket);}
 result.stage='remote-track-reception';
 for(const p of pages){await p.waitForFunction(()=>received.includes('audio')&&received.includes('video'),{},{timeout:30000});await p.waitForFunction(()=>Array.from(document.querySelectorAll('video')).some(v=>v.videoWidth>0&&v.currentTime>0),{},{timeout:20000});}
 result.checks.twoParticipantsPublishAndReceiveAudioVideo=true;result.checks.remoteVideoDecoded=true;
 const stats=await pages[0].evaluate(async()=>{const all=[];for(const p of room.remoteParticipants.values())for(const pub of p.trackPublications.values())if(pub.track){const s=await pub.track.getRTCStatsReport();if(s)s.forEach(x=>{if(x.type==='inbound-rtp')all.push({kind:x.kind,bytes:x.bytesReceived});});}return all;});
 assert.ok(stats.some(s=>s.kind==='audio'&&s.bytes>0),'No received audio bytes');assert.ok(stats.some(s=>s.kind==='video'&&s.bytes>0),'No received video bytes');result.checks.remoteAudioVideoBytes=true;
 const soak=Number(process.env.RTC_SOAK_MS||0);assert.ok(Number.isInteger(soak)&&soak>=0&&soak<=180000,'Soak must be 0..180000ms');
 if(soak){result.stage='media-soak';result.soak=[];for(let elapsed=0;elapsed<soak;elapsed+=5000){await new Promise(r=>setTimeout(r,5000));const sample=await Promise.all(pages.map(p=>p.evaluate(async()=>{const bytes={audio:0,video:0};for(const person of room.remoteParticipants.values())for(const pub of person.trackPublications.values())if(pub.track){const report=await pub.track.getRTCStatsReport();report?.forEach(s=>{if(s.type==='inbound-rtp'&&s.kind in bytes)bytes[s.kind]+=s.bytesReceived||0;});}return {state:room.state,...bytes};})));result.soak.push({elapsedMs:elapsed+5000,actors:sample});for(const actor of sample)assert.equal(actor.state,'connected','Connection lost during soak');}const first=result.soak[0].actors,last=result.soak.at(-1).actors;for(let n=0;n<last.length;n++){assert.ok(last[n].audio>first[n].audio,'Audio stalled during soak');assert.ok(last[n].video>first[n].video,'Video stalled during soak');}result.checks.mediaSoak=true;}
 result.stage='screen-share';
 await pages[0].evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;document.body.appendChild(canvas);const ctx=canvas.getContext('2d');let i=0;window.screenTimer=setInterval(()=>{ctx.fillStyle=i++%2?'blue':'green';ctx.fillRect(0,0,320,180);},100);window.syntheticScreen=canvas.captureStream(10).getVideoTracks()[0];await room.localParticipant.publishTrack(syntheticScreen,{source:LivekitClient.Track.Source.ScreenShare});});
 await pages[1].waitForFunction(()=>Array.from(room.remoteParticipants.values()).some(p=>Array.from(p.trackPublications.values()).some(pub=>pub.source===LivekitClient.Track.Source.ScreenShare&&pub.track)),{},{timeout:15000});
 await pages[1].waitForFunction(()=>Array.from(document.querySelectorAll('video')).some(v=>v.videoWidth===320&&v.currentTime>0),{},{timeout:15000});result.checks.syntheticScreenShareDecoded=true;
 await pages[0].evaluate(async()=>{await room.localParticipant.unpublishTrack(syntheticScreen);syntheticScreen.stop();clearInterval(screenTimer);});
 await pages[1].waitForFunction(()=>Array.from(room.remoteParticipants.values()).every(p=>!Array.from(p.trackPublications.values()).some(pub=>pub.source===LivekitClient.Track.Source.ScreenShare)),{},{timeout:15000});result.checks.screenShareStopped=true;
 const stale=await media.ticket(org,id,'one'),oldIssuedAt=Date.now();
 await media.end(org,id,['one','two']);created=false;for(const p of pages)await p.waitForFunction(()=>room.state==='disconnected',{},{timeout:15000});result.checks.deleteDisconnectsBoth=true;
 result.stage='fresh-old-token-after-end';
 const attempt=await pages[0].evaluate(async stale=>{try{await room.connect(stale.url,stale.token);return {rejoined:true};}catch(e){return {rejoined:false,reason:e.reason,status:e.status};}},stale);
 result.oldTokenAttempt=attempt;result.oldTokenAgeSeconds=(Date.now()-oldIssuedAt)/1000;
 if(attempt.rejoined){created=true;result.checks.freshOldTokenRejectedAfterEnd=false;throw Error('ENDED_ROOM_REJOINED_WITH_OLD_TOKEN');}
 assert.ok(result.oldTokenAgeSeconds<55,'Token expiry makes this revocation test inconclusive');assert.ok(attempt.reason===0&&[401,403,404].includes(attempt.status),'Transport failure is not revocation proof');result.checks.freshOldTokenRejectedAfterEnd=true;
 console.log(JSON.stringify(result));
}
main().catch(async e=>{result.diagnostics=await Promise.all(pages.map(p=>p.evaluate(()=>({state:room.state,received:window.received,participants:room.remoteParticipants.size,videos:Array.from(document.querySelectorAll('video')).map(v=>({width:v.videoWidth,time:v.currentTime}))})).catch(()=>({unavailable:true}))));result.failure={name:e.name,status:e.status||e.code||null};console.error('LiveKit smoke failed (sanitized): '+JSON.stringify(result.failure));process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));if(created){try{await media.end(org,id,['one','two']);result.cleanup='deleted';}catch{result.cleanup='UNKNOWN; inspect synthetic rtc room';process.exitCode=1;}}fs.mkdirSync(path.join(root,'.test-runs/rtc-live'),{recursive:true});fs.writeFileSync(path.join(root,'.test-runs/rtc-live/result.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(root,'.test-runs/rtc-live/result-'+id+'.json'),JSON.stringify(result,null,2));});
