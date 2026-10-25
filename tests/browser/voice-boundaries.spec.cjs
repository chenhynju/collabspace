const {test,expect}=require('@playwright/test');
const {randomUUID}=require('node:crypto');
const config=require('./config.cjs');
test.skip(![config.WEB_URL,config.NEXT_PUBLIC_API_URL].every(value=>['localhost','127.0.0.1'].includes(new URL(value).hostname)),'Disposable local fixture only');
test.use({launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']},permissions:['microphone']});
async function auth(request,email=config.TEST_OWNER_EMAIL){const r=await request.post(`${config.NEXT_PUBLIC_API_URL}/auth/login`,{data:{email,password:config.TEST_PASSWORD}});expect(r.ok()).toBeTruthy();return {Authorization:`Bearer ${(await r.json()).accessToken}`,'x-organization-id':config.TEST_ORG};}
async function login(page){await page.goto(`${config.WEB_URL}/login`);await page.locator('input[type=email]').fill(config.TEST_OWNER_EMAIL);await page.locator('input[type=password]').fill(config.TEST_PASSWORD);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL('**/dashboard');}

test('HTTP boundary: authentication, organization, malformed speech, scope, unavailable provider and immutable persona identity',async({request})=>{
 const base=config.NEXT_PUBLIC_API_URL,h=await auth(request),body={requestId:randomUUID(),projectId:config.TEST_PROJECT,kind:'TTS',locale:'zh-CN',text:'Synthetic boundary check'};
 expect((await request.get(`${base}/voice/status`)).status()).toBe(401);
 expect((await request.get(`${base}/voice/status`,{headers:{Authorization:h.Authorization}})).status()).toBe(400);
 expect((await request.get(`${base}/voice/status`,{headers:{...h,'x-organization-id':config.TEST_OTHER_ORG}})).status()).toBe(403);
 for(const change of [{requestId:'forged'},{locale:'xx-XX'},{kind:'VIDEO'},{text:''},{text:'x'.repeat(4001)},{projectId:undefined},{conversationId:'foreign'}]){
  const response=await request.post(`${base}/voice/jobs`,{headers:h,data:{...body,...change}});expect(response.status()).toBe(400);
 }
 expect((await request.post(`${base}/voice/jobs`,{headers:h,data:{...body,projectId:'foreign'}})).status()).toBe(404);
 expect((await request.post(`${base}/voice/jobs`,{headers:h,data:body})).status()).toBe(503);
 expect((await request.post(`${base}/voice/jobs`,{headers:h,multipart:{requestId:randomUUID(),projectId:config.TEST_PROJECT,kind:'STT',locale:'zh-CN',file:{name:'fake.wav',mimeType:'audio/wav',buffer:Buffer.from('not a WAV')}}})).status()).toBe(400);
 for(const id of ['not-uuid',randomUUID()]){
  expect((await request.get(`${base}/voice/jobs/${id}`,{headers:h})).status()).toBe(404);
  expect((await request.get(`${base}/voice/jobs/${id}/audio`,{headers:h})).status()).toBe(404);
  expect((await request.delete(`${base}/voice/jobs/${id}`,{headers:h})).status()).toBe(404);
 }
 const original=await (await request.get(`${base}/voice/persona`,{headers:h})).json();
 try{
  expect((await request.put(`${base}/voice/persona`,{headers:h,data:{style:'admin',locale:'zh-CN'}})).status()).toBe(400);
  expect((await request.put(`${base}/voice/persona`,{headers:h,data:{style:'cartoon',locale:'xx-XX'}})).status()).toBe(400);
  const update=await request.put(`${base}/voice/persona`,{headers:h,data:{style:'cartoon',locale:'en-US',identity:'agent',actorId:config.TEST_MEMBER,organizationId:config.TEST_OTHER_ORG}});expect(update.ok()).toBeTruthy();
  const profile=await (await request.get(`${base}/voice/persona`,{headers:h})).json();expect(profile.identity).toBe('human');expect(profile.actorId).toBe(original.actorId);expect(profile.locale).toBe('en-US');
 }finally{expect((await request.put(`${base}/voice/persona`,{headers:h,data:{style:original.style,locale:original.locale}})).ok()).toBeTruthy();}
});

test('recording cancel/discard releases tracks and sends nothing; oversized local VRM stays local',async({page,request})=>{
 await page.addInitScript(()=>{window.__voiceStreams=[];const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async options=>{const stream=await capture(options);window.__voiceStreams.push(stream);return stream;};});
 let writes=0;page.on('request',r=>{if(r.method()==='POST'&&(/\/voice\/jobs$|\/messages$|\/attachments(?:\?|$)/.test(r.url())))writes++;});
 const headers=await auth(request),created=await request.post(`${config.NEXT_PUBLIC_API_URL}/conversations/direct`,{headers,data:{userId:config.TEST_MEMBER}});expect(created.ok()).toBeTruthy();const {id}=await created.json();
 await login(page);await page.goto(`${config.WEB_URL}/im?c=${id}`);await page.getByText('语音选项',{exact:true}).click();
 await page.getByRole('button',{name:/^录音/}).click();await expect(page.getByRole('button',{name:/^结束录音/})).toBeVisible();
 await page.getByRole('button',{name:'停止语音',exact:true}).click();await expect(page.getByRole('button',{name:/^录音/})).toBeVisible();await expect(page.getByLabel('录音试听')).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.__voiceStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
 await page.getByRole('button',{name:/^录音/}).click();await page.waitForTimeout(600);await page.getByRole('button',{name:/^结束录音/}).click();await expect(page.getByLabel('录音试听')).toBeVisible();await page.getByRole('button',{name:'丢弃录音',exact:true}).click();await expect(page.getByLabel('录音试听')).toHaveCount(0);expect(writes).toBe(0);
 await page.getByText('我的数字形象',{exact:true}).click();await expect(page.getByLabel('形象风格')).toHaveCount(0);
 await page.getByLabel('预览VRM模型').setInputFiles({name:'synthetic-large.vrm',mimeType:'application/octet-stream',buffer:Buffer.alloc(10*1024*1024+1)});await expect(page.getByText('模型最大10MB',{exact:true})).toBeVisible();expect(writes).toBe(0);
});
