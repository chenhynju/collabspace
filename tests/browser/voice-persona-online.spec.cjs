const {test,expect}=require('@playwright/test');
const {randomUUID}=require('node:crypto');
const config=require('./config.cjs');
test.skip(process.env.VOICE_ONLINE_ACCEPTANCE!=='1','Explicit synthetic online acceptance only');
const proxy=process.env.COLLAB_ACCEPTANCE_PROXY?{server:process.env.COLLAB_ACCEPTANCE_PROXY}:undefined;
test.use({launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']},permissions:['microphone'],...(proxy?{proxy}:{})});
async function session(request,email){const r=await request.post(`${config.NEXT_PUBLIC_API_URL}/auth/login`,{data:{email,password:config.TEST_PASSWORD}});expect(r.ok()).toBeTruthy();return {Authorization:`Bearer ${(await r.json()).accessToken}`,'x-organization-id':config.TEST_ORG};}
async function login(page,email){await page.goto(`${config.WEB_URL}/login`);await page.locator('input[type=email]').fill(email);await page.locator('input[type=password]').fill(config.TEST_PASSWORD);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL('**/dashboard');}
test('formal domain: two synthetic users exchange private voice; 3D preference persists; cloud disabled; mail stays preview only',async({page,request,browser})=>{
 expect(new URL(config.WEB_URL).hostname).toBe('collabspace.purelamp.uk');
 expect(config.DATABASE_ADMIN_URL).toBeUndefined();
 const headers=await session(request,config.TEST_OWNER_EMAIL),status=await request.get(`${config.NEXT_PUBLIC_API_URL}/voice/status`,{headers});expect(status.ok()).toBeTruthy();const capability=await status.json();expect(capability.configured).toBe(false);expect(capability.realistic.configured).toBe(false);
 const profile=await request.get(`${config.NEXT_PUBLIC_API_URL}/voice/persona`,{headers});expect(profile.ok()).toBeTruthy();const original=await profile.json();
 let peerContext;
 try{
  const created=await request.post(`${config.NEXT_PUBLIC_API_URL}/conversations/direct`,{headers,data:{userId:config.TEST_MEMBER}});expect(created.ok()).toBeTruthy();const {id}=await created.json();
  await login(page,config.TEST_OWNER_EMAIL);await page.goto(`${config.WEB_URL}/im?c=${id}`);await expect(page.getByPlaceholder('输入消息...')).toBeVisible();
  await page.getByText('我的数字形象',{exact:true}).click();await page.getByLabel('形象风格').selectOption('cartoon');await expect(page.getByLabel('3D卡通预览').locator('canvas')).toBeVisible({timeout:90000});
  await page.getByRole('button',{name:'预览讲话动作（无音频）'}).click();await expect(page.getByRole('button',{name:'停止动作预览'})).toBeVisible();await page.getByRole('button',{name:'停止动作预览'}).click();
  const saved=page.waitForResponse(r=>r.url().endsWith('/voice/persona')&&r.request().method()==='PUT');await page.getByRole('button',{name:'保存形象偏好'}).click();expect((await saved).ok()).toBeTruthy();
  await page.reload();await page.getByText('我的数字形象',{exact:true}).click();await expect(page.getByLabel('形象风格')).toHaveValue('cartoon');
  await page.screenshot({path:'evidence/collaboration/voice-persona-online-cartoon.png',fullPage:true});
  const text=`Synthetic voice acceptance ${randomUUID()}`;await page.getByPlaceholder('输入消息...').fill(text);await expect(page.getByRole('button',{name:'生成语音朗读',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:/^录音/}).click();await expect(page.getByRole('button',{name:/^结束录音/})).toBeVisible();await page.waitForTimeout(1100);await page.getByRole('button',{name:/^结束录音/}).click();await expect(page.getByLabel('录音试听')).toBeVisible();await expect(page.getByRole('button',{name:'转写到正文'})).toBeDisabled();
  const sent=page.waitForResponse(r=>r.url().endsWith(`/conversations/${id}/messages`)&&r.request().method()==='POST');await page.getByRole('button',{name:'发送语音和当前文字'}).click();const response=await sent;expect(response.ok()).toBeTruthy();const message=await response.json();expect(message.content).toBe(text);expect(message.attachment.mimeType).toBe('audio/wav');await expect(page.getByLabel('录音试听')).toHaveCount(0);
  const memberHeaders=await session(request,config.TEST_MEMBER_EMAIL);const media=await request.get(`${config.NEXT_PUBLIC_API_URL}/messages/attachments/${message.attachment.id}/download`,{headers:memberHeaders});expect(media.ok()).toBeTruthy();const pcm=await media.body();expect(pcm.toString('ascii',0,4)).toBe('RIFF');expect(pcm.readUInt32LE(24)).toBe(16000);
  const rejected=await request.get(`${config.NEXT_PUBLIC_API_URL}/messages/attachments/${message.attachment.id}/download`,{headers:{...headers,'x-organization-id':'voice-test-foreign-org'}});expect(rejected.ok()).toBeFalsy();
  const replay=await request.post(`${config.NEXT_PUBLIC_API_URL}/conversations/${id}/messages`,{headers,data:{requestId:message.id,type:'FILE',content:text,attachmentId:message.attachment.id}});expect(replay.ok()).toBeTruthy();expect((await replay.json()).id).toBe(message.id);
  peerContext=await browser.newContext(proxy?{proxy}:{});const peer=await peerContext.newPage();await login(peer,config.TEST_MEMBER_EMAIL);await peer.goto(`${config.WEB_URL}/im?c=${id}`);await expect(peer.getByText(text,{exact:true})).toBeVisible();await peer.getByRole('button',{name:'加载语音（鉴权）'}).last().click();await expect(peer.getByLabel('语音消息').last()).toBeVisible();await peer.screenshot({path:'evidence/collaboration/voice-persona-online-peer.png',fullPage:true});
  let mailPosts=0;await page.route('**/assistant/mail',route=>{if(route.request().method()==='POST'){mailPosts++;return route.abort();}return route.continue();});
  await page.goto(`${config.WEB_URL}/assistant`);await page.getByRole('button',{name:/写邮件/}).click();await page.getByLabel('项目',{exact:true}).selectOption(config.TEST_PROJECT);await expect(page.getByLabel('可修改结果')).toBeVisible();await page.getByLabel('可修改结果').fill('Synthetic preview only. Do not send.');
  await expect(page.getByRole('button',{name:'生成语音朗读',exact:true}).last()).toBeDisabled();await page.locator('input[type=email]').fill(config.TEST_OWNER_EMAIL);await page.getByRole('button',{name:'预览并发送邮件'}).click();await expect(page.getByRole('button',{name:'确认发送',exact:true})).toBeVisible();expect(mailPosts).toBe(0);await page.screenshot({path:'evidence/collaboration/voice-persona-online-mail-preview.png',fullPage:true});
 }finally{
  await peerContext?.close();const restored=await request.put(`${config.NEXT_PUBLIC_API_URL}/voice/persona`,{headers,data:{style:original.style,locale:original.locale}});expect(restored.ok()).toBeTruthy();
 }
});
