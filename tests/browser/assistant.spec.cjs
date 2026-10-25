const {test,expect}=require('@playwright/test'),c=require('./config.cjs');
const source='Synthetic meeting: Alice owns delivery on Friday. Pending test coverage is a risk. '.repeat(3);
test('assistant: real project/auth and upload, bounded generation UI, speech lifecycle, email preview and retry, mobile',async({browser,request})=>{
 test.setTimeout(180000);
 const login=await request.post(c.NEXT_PUBLIC_API_URL+'/auth/login',{data:{email:c.TEST_OWNER_EMAIL,password:c.TEST_PASSWORD}});expect(login.ok(),await login.text()).toBeTruthy();const token=(await login.json()).accessToken;
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 await ctx.addInitScript(({token,org})=>{
  localStorage.setItem('access_token',token);localStorage.setItem('current_org_id',org);
  window.__speech=[];Object.defineProperty(window,'speechSynthesis',{value:{cancel:()=>window.__speech.push('cancel'),speak:u=>window.__speech.push(u.text),pause:()=>{},resume:()=>{},paused:false}});
 },{token,org:c.TEST_ORG});
 try{
  const p=await ctx.newPage();let generateCalls=0,mailCalls=0,mailPayload;const modes=[],ids=[];
  await p.route('**/assistant/status',r=>r.fulfill({json:{ai:true,mail:true,speech:'browser'}}));
  await p.route('**/assistant/generate',r=>{generateCalls++;modes.push(r.request().postDataJSON().mode);return r.fulfill({json:{text:'Synthetic summary: Alice owns delivery Friday.',usage:{total_tokens:111},cached:false,truncated:false}});});
  await p.route('**/assistant/mail',r=>{
   if(r.request().method()==='POST'){mailCalls++;mailPayload=r.request().postDataJSON();ids.push(mailPayload.requestId);if(mailCalls===1)return r.fulfill({status:502,json:{message:'合成发送超时，结果待核查'}});return r.fulfill({json:{status:'ACCEPTED',id:'synthetic-provider-receipt',requestId:mailPayload.requestId}});}
   return r.fulfill({json:[]});
  });
  await p.goto(c.WEB_URL+'/assistant');await expect(p.getByRole('heading',{name:'协作助手',exact:true})).toBeVisible();
  await p.getByLabel('项目',{exact:true}).selectOption(c.TEST_PROJECT);
  await p.getByLabel('导入资料').setInputFiles({name:'meeting.md',mimeType:'text/markdown',buffer:Buffer.from(source)});
  await expect(p.getByLabel('资料正文',{exact:true})).toHaveValue(source);expect(generateCalls).toBe(0);
  await p.getByRole('button',{name:'生成',exact:true}).click();await expect(p.getByLabel('可修改结果')).toHaveValue('Synthetic summary: Alice owns delivery Friday.');expect(generateCalls).toBe(1);
  await p.getByRole('button',{name:'朗读结果',exact:true}).click();expect(await p.evaluate(()=>window.__speech.some(v=>v.includes('Alice')))).toBeTruthy();await p.getByRole('button',{name:'停止朗读'}).click();
  for(const [mode,text]of [['translate-en','请周五交付。'],['translate-zh','Please deliver Friday.']]){await p.getByLabel('生成内容').selectOption(mode);await p.getByLabel('资料正文',{exact:true}).fill(text);await p.getByRole('button',{name:'生成',exact:true}).click();await expect(p.getByLabel('可修改结果')).toHaveValue('Synthetic summary: Alice owns delivery Friday.');}
  expect(modes).toEqual(['summary','translate-en','translate-zh']);
  await p.getByLabel('资料正文',{exact:true}).fill('长'.repeat(1201));await expect(p.getByRole('button',{name:'生成',exact:true})).toBeDisabled();
  await p.getByLabel('生成内容').selectOption('email');await p.getByLabel('可修改结果').fill('Manual synthetic delivery note.');await p.getByLabel('收件人').fill('synthetic@example.test');await p.getByLabel('主题',{exact:true}).fill('Synthetic subject');
  await p.getByRole('button',{name:'预览并发送邮件'}).click();expect(mailCalls).toBe(0);await expect(p.getByRole('heading',{name:'确认对外发送项目邮件'})).toBeVisible();await p.getByRole('button',{name:'确认发送',exact:true}).click();
  await expect(p.getByRole('alert').filter({hasText:'合成发送超时'})).toBeVisible();await p.reload();await expect(p.getByLabel('可修改结果')).toHaveValue('Manual synthetic delivery note.');await expect(p.getByLabel('收件人')).toHaveValue('synthetic@example.test');
  await p.getByRole('button',{name:'预览并发送邮件'}).click();await p.getByRole('button',{name:'确认发送',exact:true}).click();
  await expect(p.getByRole('status')).toContainText('尚不代表送达');expect(mailCalls).toBe(2);expect(ids[0]).toBe(ids[1]);expect(mailPayload.confirmed).toBe(true);expect(mailPayload.text).toBe('Manual synthetic delivery note.');
  await p.setViewportSize({width:390,height:844});expect(await p.evaluate(()=>document.body.scrollWidth<=innerWidth+1)).toBeTruthy();
  require('fs').mkdirSync('.test-runs/assistant-browser',{recursive:true});await p.screenshot({path:'.test-runs/assistant-browser/mobile.png',fullPage:true});
  const denied=await request.post(c.NEXT_PUBLIC_API_URL+'/assistant/generate',{headers:{Authorization:'Bearer '+token,'x-organization-id':c.TEST_OTHER_ORG||'forged-release-organization'},data:{projectId:c.TEST_PROJECT,text:source,mode:'summary'}});expect([403,404]).toContain(denied.status());
 }finally{await ctx.close();}
});
