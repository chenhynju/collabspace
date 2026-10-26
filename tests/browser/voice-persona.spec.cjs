const {test,expect}=require('@playwright/test');
const {randomUUID}=require('node:crypto');
const config=require('./config.cjs');
test.use({launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']},permissions:['microphone']});
async function login(page,email){await page.goto(`${config.WEB_URL}/login`);await page.locator('input[type=email]').fill(email);await page.locator('input[type=password]').fill(config.TEST_PASSWORD);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL('**/dashboard');}
async function session(request,email){const r=await request.post(`${config.NEXT_PUBLIC_API_URL}/auth/login`,{data:{email,password:config.TEST_PASSWORD}});expect(r.ok()).toBeTruthy();return {Authorization:`Bearer ${(await r.json()).accessToken}`,'x-organization-id':config.TEST_ORG};}
test('actual local IM recording sends private PCM audio with editable text; persona persists; Azure missing fails closed',async({page,request,browser})=>{
 const headers=await session(request,config.TEST_OWNER_EMAIL);
 const r=await request.post(`${config.NEXT_PUBLIC_API_URL}/conversations/direct`,{headers,data:{userId:config.TEST_MEMBER}});expect(r.ok()).toBeTruthy();const {id}=await r.json();
 await login(page,config.TEST_OWNER_EMAIL);await page.goto(`${config.WEB_URL}/im?c=${id}`);
 await expect(page.getByPlaceholder('输入消息...')).toBeVisible();
 await page.getByText('我的数字分身',{exact:true}).click();
 await expect(page.getByLabel('形象风格')).toHaveCount(0);
 await expect(page.getByRole('radio',{name:'照片生成',exact:true})).toBeVisible();
 await expect(page.getByLabel('3D卡通预览')).toHaveCount(0);
 await page.screenshot({path:'evidence/collaboration/digital-human-local-employee.png',fullPage:true});
 await expect(page.getByText('Agent形象：尚未启用。',{exact:true})).toHaveCount(0);await page.getByLabel('形象默认语言').selectOption('en-US');
 await page.getByRole('button',{name:'保存形象偏好'}).click();await expect(page.getByText('已保存当前组织的个人语言偏好',{exact:false})).toBeVisible();
 await page.reload();await page.getByText('我的数字分身',{exact:true}).click();await expect(page.getByLabel('形象默认语言')).toHaveValue('en-US');
 const text=`voice-${randomUUID()}`;await page.getByPlaceholder('输入消息...').fill(text);
 await page.getByText('语音选项',{exact:true}).click();await expect(page.getByRole('button',{name:'生成语音朗读',exact:true})).not.toBeVisible();
 await page.getByRole('button',{name:/^录音/}).click();await expect(page.getByRole('button',{name:/^结束录音/})).toBeVisible();
 await page.waitForTimeout(1200);await page.getByRole('button',{name:/^结束录音/}).click();await expect(page.getByLabel('录音试听')).toBeVisible();
 await expect(page.getByRole('button',{name:'转写到正文'})).not.toBeVisible();
 const sent=page.waitForResponse(r=>r.url().endsWith(`/conversations/${id}/messages`)&&r.request().method()==='POST');
 await page.getByRole('button',{name:'发送语音和当前文字'}).click();const response=await sent;expect(response.ok()).toBeTruthy();const message=await response.json();
 expect(message.content).toBe(text);expect(message.attachment.mimeType).toBe('audio/wav');
 await expect(page.getByLabel('录音试听')).toHaveCount(0);
 const replay=await request.post(`${config.NEXT_PUBLIC_API_URL}/conversations/${id}/messages`,{headers,data:{requestId:message.id,type:'FILE',content:text,attachmentId:message.attachment.id}});expect(replay.ok()).toBeTruthy();expect((await replay.json()).id).toBe(message.id);
 const memberHeaders=await session(request,config.TEST_MEMBER_EMAIL);
 const download=await request.get(`${config.NEXT_PUBLIC_API_URL}/messages/attachments/${message.attachment.id}/download`,{headers:memberHeaders});expect(download.ok()).toBeTruthy();const bytes=await download.body();expect(bytes.toString('ascii',0,4)).toBe('RIFF');expect(bytes.readUInt32LE(24)).toBe(16000);
 const otherHeaders={...headers,'x-organization-id':config.TEST_OTHER_ORG};expect((await request.get(`${config.NEXT_PUBLIC_API_URL}/messages/attachments/${message.attachment.id}/download`,{headers:otherHeaders})).ok()).toBeFalsy();
 const context=await browser.newContext();try{const peer=await context.newPage();await login(peer,config.TEST_MEMBER_EMAIL);await peer.goto(`${config.WEB_URL}/im?c=${id}`);await expect(peer.getByText(text,{exact:true})).toBeVisible();await peer.getByRole('button',{name:'加载语音（鉴权）'}).last().click();await expect(peer.getByLabel('语音消息').last()).toBeVisible();}finally{await context.close();}
 await page.screenshot({path:'evidence/collaboration/digital-human-local-im.png',fullPage:true});
});
test('explicit STT/TTS UI fixtures: review transcript, stop speech and invalidate old audio after editing',async({page,request})=>{
 // This isolates frontend orchestration. It does not prove Azure recognition quality or a real TTS call.
 await page.addInitScript(()=>{window.__voicePlays=0;HTMLMediaElement.prototype.play=function(){window.__voicePlays++;return Promise.resolve();};});
 await page.route('**/voice/status',r=>r.fulfill({json:{configured:true}}));
 const headers=await session(request,config.TEST_OWNER_EMAIL),r=await request.post(`${config.NEXT_PUBLIC_API_URL}/conversations/direct`,{headers,data:{userId:config.TEST_MEMBER}});const {id}=await r.json();
 let job,hold=false,release,reached;
 await page.route('**/voice/jobs',async route=>{
  if(route.request().method()!=='POST')return route.fulfill({json:[]});
  const content=route.request().postData()||'',multipart=route.request().headers()['content-type']?.includes('multipart');
  const data=multipart?{requestId:content.match(/name="requestId"\r\n\r\n([^\r]+)/)?.[1],kind:'STT'}:JSON.parse(content);
  job={id:data.requestId,kind:data.kind,status:'SUCCEEDED',text:data.kind==='STT'?'Synthetic STT fixture，请人工核对。':null};await route.fulfill({json:job});
 });
 await page.route('**/voice/jobs/*',route=>route.fulfill({json:job}));
 const wav=Buffer.alloc(32044);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(32000,40);
 await page.route('**/voice/jobs/*/audio',async route=>{if(hold){reached?.();await new Promise(resolve=>release=resolve);}try{await route.fulfill({body:wav,contentType:'audio/wav'});}catch{}});
 await login(page,config.TEST_OWNER_EMAIL);await page.goto(`${config.WEB_URL}/im?c=${id}`);
 const composer=page.getByPlaceholder('输入消息...');await expect(composer).toBeVisible();await page.getByText('语音选项',{exact:true}).click();
 await page.getByRole('button',{name:/^录音/}).click();await expect(page.getByRole('button',{name:/^结束录音/})).toBeVisible();await page.waitForTimeout(500);await page.getByRole('button',{name:/^结束录音/}).click();await page.getByRole('button',{name:'转写到正文'}).click();await expect(composer).toHaveValue('Synthetic STT fixture，请人工核对。');
 await composer.fill('Reviewed fixture transcript.');await page.getByRole('button',{name:'生成语音朗读',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__voicePlays)).toBe(1);await page.getByRole('button',{name:'停止语音',exact:true}).click();
 hold=true;const requested=new Promise(resolve=>reached=resolve);await page.getByRole('button',{name:'生成语音朗读',exact:true}).click();await requested;await composer.fill('Changed after synthesis request.');release();await expect(page.getByRole('button',{name:'生成语音朗读',exact:true})).toBeEnabled();expect(await page.evaluate(()=>window.__voicePlays)).toBe(1);
});
test('mail dictation toolbar cannot send mail; denied microphone reports error; no real vendor calls',async({browser})=>{
 const context=await browser.newContext({permissions:[]});try{const page=await context.newPage();await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('denied','NotAllowedError');};});
 let mails=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/assistant/mail'))mails++;});
 await login(page,config.TEST_OWNER_EMAIL);await page.goto(`${config.WEB_URL}/assistant`);
 await page.getByRole('button',{name:/写邮件/}).click();await page.getByLabel('项目',{exact:true}).selectOption(config.TEST_PROJECT);
 await page.getByRole('button',{name:/^录音/}).last().click();await expect(page.getByText('无法使用麦克风',{exact:false})).toBeVisible();
 await page.getByLabel('可修改结果').fill('Synthetic mail draft, never sent.');await expect(page.getByRole('button',{name:'预览并发送邮件'})).toBeDisabled();expect(mails).toBe(0);
 await page.screenshot({path:'evidence/collaboration/digital-human-local-mail.png',fullPage:true});
 }finally{await context.close();}
});
