const {test,expect}=require('@playwright/test'),config=require('./config.cjs'),fs=require('node:fs'),{randomUUID}=require('node:crypto');
test.describe('authenticated Office file collaboration',()=>{
 test.skip(!process.env.OFFICE_BROWSER_TEST,'Requires isolated Office engine and API configuration');
 test.setTimeout(600000);
 test.use({actionTimeout:20000});
 for(const format of ['word','sheet','slides'])test(format+': upload, native editors, read-only, persistent checkpoint and history',async({browser,request})=>{
  const ext={word:'docx',sheet:'xlsx',slides:'pptx'}[format],contexts=[],api=config.NEXT_PUBLIC_API_URL,writes=new WeakMap();
  const login=async email=>{const r=await request.post(api+'/auth/login',{data:{email,password:config.TEST_PASSWORD}});expect(r.ok()).toBeTruthy();return (await r.json()).accessToken};
  const owner=await login(config.TEST_OWNER_EMAIL),peer=await login(config.TEST_MEMBER_EMAIL),viewer=await login(config.TEST_ADMIN_EMAIL),headers={Authorization:'Bearer '+owner,'x-organization-id':config.TEST_ORG};
  const pageFor=async token=>{const c=await browser.newContext({viewport:{width:1600,height:1000}});contexts.push(c);await c.addInitScript(({token,org})=>{localStorage.setItem('access_token',token);localStorage.setItem('current_org_id',org)},{token,org:config.TEST_ORG});const p=await c.newPage();writes.set(p,0);p.on('websocket',ws=>ws.on('framesent',e=>{if(String(e.payload).includes('saveChanges'))writes.set(p,writes.get(p)+1)}));return p};
  try{
   const filename='Office-'+randomUUID().slice(0,8)+'.'+ext;
   const upload=await request.post(api+'/files/upload',{headers,multipart:{projectId:config.TEST_PROJECT,file:{name:filename,mimeType:'application/octet-stream',buffer:fs.readFileSync('.test-runs/office/fixtures/baseline.'+ext)}}});expect(upload.ok()).toBeTruthy();const file=await upload.json();
   let oldShare;if(format==='word'){const r=await request.post(api+'/files/'+file.id+'/share',{headers,data:{ttlDays:1}});expect(r.ok()).toBeTruthy();oldShare=(await r.json()).shareId}
   const a=await pageFor(owner);await a.goto(config.WEB_URL+'/files');await a.getByRole('row').filter({hasText:filename}).getByRole('button',{name:'在线编辑',exact:true}).click();await expect(a).toHaveURL(/\/office\//);const id=a.url().split('/').pop();
   if(oldShare)expect((await request.get(api+'/files/shared/'+oldShare+'/download')).status()).toBe(410);
   const frame=async p=>{await expect(p.locator('[data-office-ready="true"]')).toBeVisible({timeout:240000});return p.frames().find(f=>/documenteditor|spreadsheeteditor|presentationeditor/.test(f.url()))};
   const fa=await frame(a);console.log(format,'owner native editor ready');
   for(const [user,role]of[[config.TEST_MEMBER,'EDITOR'],[config.TEST_ADMIN,'VIEWER']]){await a.getByLabel('Office 授权成员').selectOption(user);await a.getByLabel('Office 成员权限').selectOption(role);await Promise.all([a.waitForResponse(r=>r.url().endsWith('/documents/'+id+'/grants')&&r.request().method()==='PUT'),a.getByRole('button',{name:'更新权限',exact:true}).click()]);await expect(a.getByText('权限已更新，活动会话会重新校验。')).toBeVisible()}
   const b=await pageFor(peer),v=await pageFor(viewer);await b.goto(a.url());const fb=await frame(b);console.log(format,'peer ready');await v.goto(a.url());await frame(v);console.log(format,'viewer ready');await expect(v.getByRole('button',{name:'保存到服务器',exact:true})).toBeDisabled();
   await expect.poll(async()=>{const r=await request.get(api+'/office/'+id+'/state',{headers});return (await r.json()).users.length},{timeout:30000}).toBeGreaterThanOrEqual(2);
   const markers=['Alice-'+Date.now(),'Bob-'+Date.now()];
   const edit=async(p,f,i)=>{
    if(format==='sheet'){await f.locator('#ce-cell-name').fill(i===0?'C4':'D4');await f.locator('#ce-cell-name').press('Enter')}
    else if(format==='slides'){await f.locator('#id_viewer_overlay').dblclick({position:{x:350,y:84}});await p.keyboard.press('End')}
    else {await f.locator('#id_viewer_overlay').click({position:{x:650,y:220}});await p.keyboard.press('Control+End');await p.keyboard.press('End');await p.keyboard.press('Enter')}
    await p.waitForTimeout(1000);await p.keyboard.type(markers[i],{delay:120});if(format==='sheet')await p.keyboard.press('Enter');await p.waitForTimeout(1500);
   };
   // Distinct Excel cells can be entered concurrently; text tests serialize caret placement.
   if(format==='sheet')await Promise.all([edit(a,fa,0),edit(b,fb,1)]);else {await edit(a,fa,0);await edit(b,fb,1)}
   await a.waitForTimeout(3000);await a.getByRole('button',{name:'保存到服务器',exact:true}).click();await expect.poll(async()=>{const r=await request.get(api+'/office/'+id+'/state',{headers});return (await r.json()).revision},{timeout:90000}).toBe(2);
   const state=await(await request.get(api+'/office/'+id+'/state',{headers})).json();expect(state.versions.length).toBe(2);
   expect((await request.get(api+'/files/'+file.id+'/download',{headers})).ok()).toBeTruthy();console.log(format,'persistent revision',state.revision);
   fs.mkdirSync('.test-runs/office-integrated/results',{recursive:true});fs.writeFileSync('.test-runs/office-integrated/results/'+format+'.'+ext,await(await request.get(api+'/office/'+id+'/download',{headers})).body());fs.writeFileSync('.test-runs/office-integrated/results/'+format+'-markers.json',JSON.stringify(markers));
   await a.screenshot({path:'evidence/collaboration/office-integrated-'+format+'.png',fullPage:true});
   const readerHeaders={Authorization:'Bearer '+viewer,'x-organization-id':config.TEST_ORG};expect((await request.post(api+'/office/'+id+'/save',{headers:readerHeaders})).status()).toBe(403);
   if(format==='word'){
    const foreign={Authorization:'Bearer '+peer,'x-organization-id':config.TEST_ORG};await expect.poll(()=>writes.get(b),{timeout:15000}).toBeGreaterThan(0);
    // Simulate a client that refuses the app's revocation notification. The
    // native engine must stop writes independently of hiding the React editor.
    const stateRoute='**/office/'+id+'/state*';await b.route(stateRoute,r=>r.abort());await a.getByLabel('Office 授权成员').selectOption(config.TEST_MEMBER);await a.getByLabel('Office 成员权限').selectOption('REMOVE');await a.getByRole('button',{name:'更新权限',exact:true}).click();
    await expect.poll(async()=>{const r=await request.get(api+'/office/'+id+'/state',{headers});return (await r.json()).phase},{timeout:30000}).toBe('FROZEN');expect((await request.post(api+'/office/'+id+'/config',{headers:foreign})).status()).toBe(404);
    // The engine presents its own blocking access/save warning even while the
    // application heartbeat is suppressed. Do not click through that warning.
    await expect(fb.getByText(/这份文件无法保存/).first()).toBeVisible({timeout:30000});await b.screenshot({path:'evidence/collaboration/office-integrated-revoked.png',fullPage:true});const before=writes.get(b);await b.keyboard.type('REVOKED-MUST-NOT-WRITE',{delay:80});await b.waitForTimeout(5000);expect(writes.get(b)).toBe(before);await b.unroute(stateRoute);await expect(b.getByRole('alert').filter({hasText:'访问已撤销'})).toContainText('访问已撤销');
    expect((await(await request.get(api+'/office/'+id+'/state',{headers})).json()).revision).toBe(2);
    const confirmed=state.versions.find(x=>x.revision===2);await a.getByText('已保存版本与恢复候选',{exact:true}).click();await a.locator('[data-office-version="'+confirmed.id+'"]').getByRole('button',{name:'恢复为私有副本',exact:true}).click();await expect(a).not.toHaveURL(new RegExp(id+'$'));const copy=a.url().split('/').pop();await frame(a);expect((await request.post(api+'/office/'+copy+'/config',{headers:foreign})).status()).toBe(404);await a.reload();await frame(a);await expect.poll(async()=>{const r=await request.get(api+'/office/'+copy+'/state',{headers});return (await r.json()).phase}).toBe('OPEN');
   }else{
    await v.close();await b.close();await a.close();
    await expect.poll(async()=>{const r=await request.get(api+'/office/'+id+'/state',{headers});return (await r.json()).phase},{timeout:90000}).toBe('CLOSED');
    const closed=await(await request.get(api+'/office/'+id+'/state',{headers})).json();expect(closed.revision).toBeGreaterThanOrEqual(2);expect(closed.users).toHaveLength(0);
    fs.writeFileSync('.test-runs/office-integrated/results/'+format+'.'+ext,await(await request.get(api+'/office/'+id+'/download',{headers})).body());
    const reopened=await pageFor(owner);await reopened.goto(config.WEB_URL+'/office/'+id);await frame(reopened);console.log(format,'final save and reopen verified');
   }
  }finally{for(const c of contexts)await c.close()}
 });
});
