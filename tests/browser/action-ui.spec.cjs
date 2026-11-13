const {test,expect}=require('@playwright/test');
const {randomUUID}=require('node:crypto');
const config=require('./config.cjs');
const local=[config.WEB_URL,config.NEXT_PUBLIC_API_URL].every(v=>['localhost','127.0.0.1'].includes(new URL(v).hostname));
const online=process.env.ACTION_UI_ONLINE==='1'&&new URL(config.WEB_URL).hostname==='collabspace.purelamp.uk'&&new URL(config.NEXT_PUBLIC_API_URL).hostname==='collabspace-api.purelamp.uk'&&!config.DATABASE_ADMIN_URL;
test.skip(!local&&!online,'Explicit local or synthetic formal-site acceptance only');
test.use(process.env.COLLAB_ACCEPTANCE_PROXY?{proxy:{server:process.env.COLLAB_ACCEPTANCE_PROXY}}:{});
async function open(page,request,route){
 const r=await request.post(`${config.NEXT_PUBLIC_API_URL}/auth/login`,{data:{email:config.TEST_OWNER_EMAIL,password:config.TEST_PASSWORD}});expect(r.ok()).toBeTruthy();const token=(await r.json()).accessToken;
 await page.addInitScript(({token,org})=>{localStorage.setItem('access_token',token);localStorage.setItem('current_org_id',org);},{token,org:config.TEST_ORG});await page.goto(config.WEB_URL+route);
}
test('IM tools are keyboard buttons; inactive cloud and persona placeholders are absent',async({page,request})=>{
 await open(page,request,'/im');await page.getByText('陆小鹿',{exact:true}).first().click();await expect(page.getByPlaceholder('输入消息...')).toBeVisible();
 const tools=page.getByRole('button',{name:'语音选项',exact:true});await expect(tools).toHaveAttribute('aria-expanded','false');await tools.focus();await page.keyboard.press('Enter');await expect(tools).toHaveAttribute('aria-expanded','true');
 await expect(page.getByRole('button',{name:'生成语音朗读',exact:true})).not.toBeVisible();await expect(page.getByRole('button',{name:'语音输入',exact:true})).not.toBeVisible();await expect(page.getByRole('button',{name:/^录音/})).toBeVisible();await expect(page.getByRole('button',{name:'停止语音',exact:true})).not.toBeVisible();
 const history=page.getByRole('button',{name:'语音任务与恢复',exact:true});await history.click();await page.getByRole('button',{name:'刷新语音任务',exact:true}).click();await expect(history).toHaveAttribute('aria-expanded','true');
 const persona=page.getByRole('button',{name:'我的数字分身',exact:true});await persona.focus();await page.keyboard.press('Space');await expect(persona).toHaveAttribute('aria-expanded','true');await expect(page.getByLabel('形象默认语言')).toBeVisible({timeout:90000});await expect(page.getByLabel('形象风格')).toHaveCount(0);await expect(page.getByText('Agent形象：尚未启用。',{exact:true})).toHaveCount(0);
 const choose=page.waitForEvent('filechooser');await page.getByRole('button',{name:'点击选择或拖入文件 选择本人照片',exact:true}).click();const chooser=await choose;expect(chooser.isMultiple()).toBe(false);await chooser.setFiles([]);
 await page.screenshot({path:`evidence/collaboration/action-ui-${online?'online':'local'}-im.png`,fullPage:true});await persona.click();await expect(page.getByLabel('形象默认语言')).toHaveCount(0);
});
test('explicit runtime fixture: cancel and stop actions only appear when meaningful; result details expand',async({page,request})=>{
 let complete=false,cancels=0,models=0,mails=0;let runId=randomUUID();
 page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/assistant/generate'))models++;if(r.method()==='POST'&&r.url().endsWith('/assistant/mail'))mails++;});
 await page.route('**/assistant/status',r=>r.fulfill({json:{ai:true,mail:false,agentRuntime:true}}));
 const receipt=state=>({id:runId,state,event:{version:1,runId,sequence:state==='executing'?1:2,source:'agent',authority:'runtime',state,...(state==='completed'?{resultRef:'fixture:'+runId}:{})},...(state==='completed'?{result:{text:'Synthetic UI fixture result; no provider call.'}}:{})});
 await page.route('**/assistant/runs',r=>{if(r.request().method()==='POST')runId=randomUUID();return r.fulfill({json:receipt('executing')});});await page.route('**/assistant/runs/*',r=>{if(r.request().method()==='DELETE'){cancels++;return r.fulfill({json:receipt('cancelled')});}return r.fulfill({json:receipt(complete?'completed':'executing')});});
 await open(page,request,'/assistant');await expect(page.getByRole('button',{name:'取消当前任务',exact:true})).not.toBeVisible();await expect(page.getByText('生成结果将显示在这里',{exact:true})).toHaveCount(0);
 const privacy=page.getByRole('button',{name:'用量、隐私与朗读说明',exact:true});await privacy.click();await expect(privacy).toHaveAttribute('aria-expanded','true');
 await page.getByLabel('项目',{exact:true}).selectOption(config.TEST_PROJECT);await page.getByLabel('资料正文',{exact:true}).fill('Synthetic UI acceptance. Alice owns delivery Friday. Bob reviews tests Thursday. No email has been sent.');await page.getByRole('button',{name:'生成',exact:true}).click();await page.getByRole('button',{name:'取消当前任务',exact:true}).click();await expect.poll(()=>cancels).toBe(1);await expect(page.getByRole('button',{name:'取消当前任务',exact:true})).not.toBeVisible();
 complete=true;await page.getByRole('button',{name:'生成',exact:true}).click();await expect(page.getByLabel('可修改结果',{exact:true})).toHaveValue('Synthetic UI fixture result; no provider call.');await expect(page.getByRole('button',{name:'停止播报（不取消任务）',exact:true})).not.toBeVisible();await expect(page.getByRole('button',{name:'停止朗读',exact:true})).not.toBeVisible();const details=page.getByRole('button',{name:'运行详情',exact:true});await details.click();await expect(page.getByText('结果引用：fixture:'+runId,{exact:true})).toBeVisible();expect(models).toBe(0);expect(mails).toBe(0);
 await page.screenshot({path:`evidence/collaboration/action-ui-${online?'online':'local'}-assistant-fixture.png`,fullPage:true});
});
