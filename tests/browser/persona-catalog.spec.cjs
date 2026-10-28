const {test,expect}=require('@playwright/test');
const config=require('./config.cjs');
test.skip(!['localhost','127.0.0.1'].includes(new URL(config.WEB_URL).hostname),'Isolated local synthetic acceptance only');
async function auth(request,email=config.TEST_OWNER_EMAIL){const r=await request.post(config.NEXT_PUBLIC_API_URL+'/auth/login',{data:{email,password:config.TEST_PASSWORD}});expect(r.ok()).toBeTruthy();return{Authorization:'Bearer '+(await r.json()).accessToken,'x-organization-id':config.TEST_ORG};}
test('20 delivered portraits: select, persist, filter, render Agent and reject unauthorized/conflicting changes',async({page,request})=>{
 test.setTimeout(300000);const api=config.NEXT_PUBLIC_API_URL,h=await auth(request),peer=await auth(request,config.TEST_MEMBER_EMAIL);
 const initial=await request.get(api+'/voice/persona/agent',{headers:h});expect(initial.ok()).toBeTruthy();let a=await initial.json();expect(a.catalog).toHaveLength(20);expect(a.catalog.filter(c=>c.gender==='male')).toHaveLength(10);expect(a.catalog.filter(c=>c.gender==='female')).toHaveLength(10);expect(a.catalog.every(c=>c.modelAvailable===false)).toBeTruthy();
 expect((await request.put(api+'/voice/persona/agent',{headers:peer,data:{mode:'preset',presetId:'male-01-v1',revision:a.revision}})).status()).toBe(403);
 expect((await request.put(api+'/voice/persona/agent',{headers:h,data:{mode:'custom',presetId:'male-01-v1',revision:a.revision}})).status()).toBe(400);
 expect((await request.put(api+'/voice/persona/agent',{headers:h,data:{mode:'preset',presetId:'not-installed',revision:a.revision}})).status()).toBe(400);
 expect((await request.get(api+'/voice/persona/agent',{headers:{...h,'x-organization-id':config.TEST_OTHER_ORG}})).status()).toBe(403);
 await page.addInitScript(({token,org})=>{localStorage.setItem('access_token',token);localStorage.setItem('current_org_id',org);},{token:h.Authorization.slice(7),org:config.TEST_ORG});
 try{
 await page.goto(config.WEB_URL+'/system/configs');const section=page.getByLabel('后台Agent形象配置');await expect(section.getByRole('radio')).toHaveCount(20,{timeout:90000});
 await section.getByRole('button',{name:'男款',exact:true}).click();await expect(section.getByRole('radio')).toHaveCount(10);
 await section.getByRole('radio',{name:'选择形象 知行',exact:true}).check();await section.getByRole('button',{name:'保存Agent形象',exact:true}).click();await expect(section.getByRole('status')).toContainText('已保存当前组织');
 expect((await request.put(api+'/voice/persona/agent',{headers:h,data:{mode:'preset',presetId:'lan-v1',revision:a.revision}})).status()).toBe(409);
 await page.reload();await expect(section.getByRole('radio',{name:'选择形象 知行',exact:true})).toBeChecked();await section.getByRole('button',{name:'男款',exact:true}).click();const label=section.getByRole('radio',{name:'选择形象 知行',exact:true}).locator('..');await label.scrollIntoViewIfNeeded();await expect(label).toBeInViewport();const preview=section.getByAltText('待保存形象 知行');await expect.poll(()=>preview.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);await expect(label).toHaveText(/知行/);await page.screenshot({path:'evidence/collaboration/persona-catalog-phase2.png',fullPage:true});
 await section.getByRole('button',{name:'女款',exact:true}).click();await expect(section.getByRole('radio')).toHaveCount(10);
 await page.goto(config.WEB_URL+'/assistant');await expect(page.getByAltText('知行 · 当前Agent形象')).toBeVisible({timeout:90000});await page.getByRole('button',{name:'查看Agent形象',exact:true}).click();await expect(page.getByLabel('Agent静态形象')).toBeVisible();await expect(page.getByText('静态角色外观稿 · 可动3D模型尚未交付',{exact:true})).toBeVisible();await page.screenshot({path:'evidence/collaboration/persona-agent-phase2.png',fullPage:true});
 }finally{a=await(await request.get(api+'/voice/persona/agent',{headers:h})).json();expect((await request.put(api+'/voice/persona/agent',{headers:h,data:{mode:'preset',presetId:'lan-v1',revision:a.revision}})).ok()).toBeTruthy();}
});
test('registered payment controllers expose disabled provider configuration without credentials',async({request})=>{const h=await auth(request);for(const p of ['stripe','paypal']){const r=await request.get(config.NEXT_PUBLIC_API_URL+`/billing/${p}/configuration`,{headers:h});expect(r.ok()).toBeTruthy();const c=await r.json();expect(c.enabled).toBe(false);expect(c.mode).toBe(p==='stripe'?'test':'sandbox');}});
