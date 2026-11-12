const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
function recordTransport(n,stats){const file=test.info().outputPath('transport-'+n+'.json');fs.mkdirSync(require('node:path').dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(stats,null,2));return {path:file,contentType:'application/json'};}
function isolatedConfig(){const c=JSON.parse(fs.readFileSync(process.env.COLLAB_BROWSER_CONFIG));for(const value of [c.WEB_URL,c.NEXT_PUBLIC_API_URL])expect(['localhost','127.0.0.1']).toContain(new URL(value).hostname);expect(new URL(c.NEXT_PUBLIC_API_URL).port).toBe('14431');return c;}
test.skip(process.env.RTC_VOICE_REAL_TEST!=='1','Explicit real-provider opt-in required');
test.use({launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']}});
test.beforeEach(async({request})=>{
 test.setTimeout(600000);
 const c=isolatedConfig();
 // Check both local services before creating accounts or external rooms.
 await expect.poll(async()=>{
  try{
   const api=await request.get(c.NEXT_PUBLIC_API_URL+'/health/ready',{timeout:3000});
   const web=await request.get(c.WEB_URL+'/login',{timeout:10000});
   return api.ok()&&(await api.json()).status==='ok'&&web.ok();
  }catch{return false;}
 },{timeout:180000,intervals:[1000,3000,5000],message:'Local API and web must be ready before real-provider tests'}).toBe(true);
});
test('two real accounts exchange LiveKit media and durable chat',async({browser,request})=>{
 test.setTimeout(600000);
 const c=isolatedConfig();
 expect(new URL(c.NEXT_PUBLIC_API_URL).port).toBe('14431');
 expect(['localhost','127.0.0.1']).toContain(new URL(c.WEB_URL).hostname);
 const login=async email=>{const r=await request.post(c.NEXT_PUBLIC_API_URL+'/auth/login',{data:{email,password:'Passw0rd!'}});expect(r.ok()).toBeTruthy();return(await r.json()).accessToken;};
 const a=await login('owner@acme.dev'),b=await login('member@acme.dev');
 const headers={Authorization:'Bearer '+a,'x-organization-id':c.TEST_ORG};
 let id;const contexts=[];
 try{
  const pages=[];
  for(const token of[a,b]){const ctx=await browser.newContext({viewport:{width:1600,height:2600},permissions:['microphone','camera']});contexts.push(ctx);await ctx.addInitScript(({token,org})=>{localStorage.setItem('access_token',token);localStorage.setItem('current_org_id',org);navigator.mediaDevices.getDisplayMedia=async()=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const g=canvas.getContext('2d');let n=0;setInterval(()=>{g.fillStyle=n++%2?'#335599':'#663399';g.fillRect(0,0,640,360);},100);return canvas.captureStream(5);};},{token,org:c.TEST_ORG});pages.push(await ctx.newPage());}
  for(const ctx of contexts)await ctx.addInitScript(()=>{window.__rtcConnections=[];const Native=window.RTCPeerConnection;window.RTCPeerConnection=new Proxy(Native,{construct(target,args){const pc=Reflect.construct(target,args);window.__rtcConnections.push(pc);return pc;}});});
  if(process.env.RTC_FORCE_TCP==='1')for(const ctx of contexts)await ctx.addInitScript(()=>{
   const filter=config=>{const next={...config,iceTransportPolicy:'relay'};if(!config?.iceServers?.length)return next;next.iceServers=config.iceServers.map(server=>({...server,urls:(Array.isArray(server.urls)?server.urls:[server.urls]).filter(url=>typeof url==='string'&&(/^turns:/i.test(url)||/[?&]transport=tcp(?:&|$)/i.test(url)))})).filter(server=>server.urls.length);if(!next.iceServers.length)throw Error('Vendor supplied no TCP relay; test cannot continue');return next;};
   const Native=window.RTCPeerConnection;window.RTCPeerConnection=new Proxy(Native,{construct(target,args){const pc=Reflect.construct(target,[filter(args[0]||{})]),set=pc.setConfiguration.bind(pc);pc.setConfiguration=config=>set(filter(config));return pc;}});
  });
  if(process.env.RTC_FORCE_RELAY==='1')for(const ctx of contexts)await ctx.addInitScript(()=>{const Native=window.RTCPeerConnection;window.RTCPeerConnection=new Proxy(Native,{construct(target,args){return Reflect.construct(target,[{...(args[0]||{}),iceTransportPolicy:'relay'}]);}});});
  const [pa,pb]=pages;await Promise.all(pages.map(p=>p.goto(c.WEB_URL+'/projects/'+c.TEST_PROJECT+'/meetings')));
  console.log('PASS real application pages loaded');
  const title='Real two-account '+Date.now();await pa.getByLabel('会议名称').fill(title);await pa.getByRole('button',{name:'创建会议',exact:true}).click();
  await expect(pa.locator('li').filter({hasText:title})).toBeVisible();const list=await request.get(c.NEXT_PUBLIC_API_URL+'/meetings?projectId='+c.TEST_PROJECT,{headers});id=(await list.json()).find(m=>m.title===title)?.id;expect(id).toBeTruthy();
  for(const p of pages){const row=p.locator('li').filter({hasText:title});await row.getByRole('button',{name:'加入会议',exact:true}).click();await expect(p.getByRole('region',{name:'会议通话'})).toContainText('已连接');}
  console.log('PASS both real accounts admitted');
  if(process.env.RTC_CHAT_ONLY!=='1'){
  for(const p of pages){await p.getByRole('button',{name:'开启摄像头',exact:true}).click();await p.getByRole('button',{name:'开启麦克风',exact:true}).click();}
  console.log('Local camera and microphone enable actions submitted');
  const remote=p=>p.getByText('参会者 1',{exact:true}).locator('..');
  for(const p of pages){await expect(remote(p).locator('video')).toHaveCount(1);await remote(p).locator('video').scrollIntoViewIfNeeded();await expect.poll(()=>remote(p).locator('video').evaluate(v=>v.videoWidth)).toBeGreaterThan(0);await expect(remote(p).locator('audio')).toHaveCount(1);}
  const bytes=p=>p.evaluate(async()=>{const result={audio:0,video:0};for(const pc of window.__rtcConnections){try{const stats=await pc.getStats();stats.forEach(s=>{if(s.type==='inbound-rtp'&&s.kind in result)result[s.kind]+=s.bytesReceived||0;});}catch{}}return result;});
  for(const p of pages){await expect.poll(async()=>{const s=await bytes(p);return s.audio>0&&s.video>0;}).toBe(true);await expect.poll(()=>remote(p).locator('audio').evaluate(a=>a.currentTime)).toBeGreaterThan(0);}
  const soak=Number(process.env.RTC_SOAK_MS||0);expect(Number.isInteger(soak)&&soak>=0&&soak<=180000).toBe(true);if(soak){let previous=await Promise.all(pages.map(bytes));for(let elapsed=0;elapsed<soak;elapsed+=5000){await pa.waitForTimeout(5000);const current=await Promise.all(pages.map(bytes));for(let i=0;i<pages.length;i++){await expect(pages[i].getByRole('region',{name:'会议通话'})).toContainText('已连接');expect(current[i].audio).toBeGreaterThan(previous[i].audio);expect(current[i].video).toBeGreaterThan(previous[i].video);}previous=current;}console.log('PASS continuous bidirectional audio/video bytes for '+soak+'ms');}
  await pa.getByRole('button',{name:'关闭摄像头',exact:true}).click();await expect(remote(pb).locator('video')).toHaveCount(0);
  await pa.getByRole('button',{name:'开启摄像头',exact:true}).click();await expect(remote(pb).locator('video')).toHaveCount(1);
  await pa.getByRole('button',{name:'共享屏幕',exact:true}).click();await expect(pa.getByRole('button',{name:'停止共享',exact:true})).toBeVisible();await expect(remote(pb).locator('video')).toHaveCount(2);const shared=remote(pb).locator('[data-track-source="screen_share"] video');await shared.scrollIntoViewIfNeeded();await expect.poll(()=>shared.evaluate(v=>v.videoWidth)).toBeGreaterThan(0);await expect.poll(()=>shared.evaluate(v=>v.currentTime)).toBeGreaterThan(0);await pa.getByRole('button',{name:'停止共享',exact:true}).click();await expect(remote(pb).locator('video')).toHaveCount(1);
  }
  for(const p of pages)await p.locator('li').filter({hasText:title}).getByRole('button',{name:'聊天记录',exact:true}).click();
  for(const p of pages)await expect(p.getByLabel('会议消息')).toHaveCount(1);const message='Persisted multi-account '+Date.now();await pa.getByLabel('会议消息').fill(message);await pa.getByRole('button',{name:'发送消息',exact:true}).click();await expect(pb.getByText(message,{exact:true})).toBeVisible();
  await pb.reload();await pb.locator('li').filter({hasText:title}).getByRole('button',{name:'聊天记录',exact:true}).click();await expect(pb.getByText(message,{exact:true})).toBeVisible();
  const [ended]=await Promise.all([
   pa.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/meetings/'+id+'/end')),
   pa.locator('li').filter({hasText:title}).getByRole('button',{name:'结束会议',exact:true}).click()
  ]);
  expect(ended.status(),'Host ending must be confirmed, not just hide the call').toBe(201);
  expect((await ended.json()).status).toBe('ENDED');
  await expect(pa.locator('li').filter({hasText:title})).toContainText('已结束');
  await expect(pa.getByRole('region',{name:'会议通话'})).toHaveCount(0);
 }catch(error){for(let n=0;n<contexts.length;n++)for(const p of contexts[n].pages()){console.log('Actor '+n+' call diagnostics: '+await p.getByRole('region',{name:'会议通话'}).innerText().catch(()=>''));await test.info().attach('call-before-cleanup-'+n,{body:await p.screenshot(),contentType:'image/png'});}throw error;}finally{for(let n=0;n<contexts.length;n++)for(const p of contexts[n].pages()){const stats=await p.evaluate(async()=>{const output=[];for(const pc of window.__rtcConnections||[]){try{const report=await pc.getStats(),rtp=[],pairs=[];report.forEach(s=>{if(s.type==='inbound-rtp')rtp.push({kind:s.kind,bytes:s.bytesReceived,frames:s.framesDecoded});if(s.type==='candidate-pair'&&s.state==='succeeded'){const local=report.get(s.localCandidateId);pairs.push({protocol:local?.protocol,candidateType:local?.candidateType,relayProtocol:local?.relayProtocol,bytesReceived:s.bytesReceived});}});output.push({connectionState:pc.connectionState,iceState:pc.iceConnectionState,rtp,pairs});}catch{}}return output;}).catch(()=>[]);await test.info().attach('transport-metadata-'+n,recordTransport(n,stats));}if(id){const end=await request.post(c.NEXT_PUBLIC_API_URL+'/meetings/'+id+'/end',{headers,data:{}});console.log('Cleanup end HTTP '+end.status());}for(const ctx of contexts)await ctx.close();}
});

test('real accounts share durable chat and protect avatar configuration',async({browser,request})=>{
 const c=isolatedConfig();expect(new URL(c.NEXT_PUBLIC_API_URL).port).toBe('14431');
 const tokens=[];for(const email of ['owner@acme.dev','member@acme.dev']){const r=await request.post(c.NEXT_PUBLIC_API_URL+'/auth/login',{data:{email,password:'Passw0rd!'}});expect(r.ok()).toBeTruthy();tokens.push((await r.json()).accessToken);}
 const h=t=>({Authorization:'Bearer '+t,'x-organization-id':c.TEST_ORG});const owner=h(tokens[0]),member=h(tokens[1]);
 const read=await request.get(c.NEXT_PUBLIC_API_URL+'/voice/persona/agent',{headers:owner});expect(read.ok()).toBeTruthy();const persona=await read.json();expect(persona.catalog).toHaveLength(20);
 const body={mode:'preset',presetId:persona.catalog[1].id,revision:persona.revision};
 const forbidden=await request.put(c.NEXT_PUBLIC_API_URL+'/voice/persona/agent',{headers:member,data:body});expect(forbidden.status()).toBe(403);
 const saved=await request.put(c.NEXT_PUBLIC_API_URL+'/voice/persona/agent',{headers:owner,data:body});expect(saved.ok()).toBeTruthy();expect((await request.put(c.NEXT_PUBLIC_API_URL+'/voice/persona/agent',{headers:owner,data:body})).status()).toBe(409);
 const current=await request.get(c.NEXT_PUBLIC_API_URL+'/voice/persona/agent',{headers:member});expect((await current.json()).presetId).toBe(body.presetId);
 const title='Durable real chat '+Date.now();const created=await request.post(c.NEXT_PUBLIC_API_URL+'/meetings',{headers:owner,data:{requestId:require('node:crypto').randomUUID(),projectId:c.TEST_PROJECT,title}});expect(created.ok()).toBeTruthy();const id=(await created.json()).id;const contexts=[];
 try{const pages=[];for(const token of tokens){const ctx=await browser.newContext();contexts.push(ctx);await ctx.addInitScript(({token,org})=>{localStorage.setItem('access_token',token);localStorage.setItem('current_org_id',org);},{token,org:c.TEST_ORG});const p=await ctx.newPage();pages.push(p);await p.goto(c.WEB_URL+'/projects/'+c.TEST_PROJECT+'/meetings');await p.locator('li').filter({hasText:title}).getByRole('button',{name:'聊天记录',exact:true}).click();}
  const text='Real durable chat '+Date.now();await pages[0].getByLabel('会议消息').fill(text);await pages[0].getByRole('button',{name:'发送消息',exact:true}).click();await expect(pages[1].getByText(text,{exact:true})).toBeVisible();await pages[1].reload();await pages[1].locator('li').filter({hasText:title}).getByRole('button',{name:'聊天记录',exact:true}).click();await expect(pages[1].getByText(text,{exact:true})).toBeVisible();
 }finally{await request.post(c.NEXT_PUBLIC_API_URL+'/meetings/'+id+'/end',{headers:owner,data:{}});for(const ctx of contexts)await ctx.close();}
});
