const {test,expect}=require('@playwright/test'),{randomUUID}=require('node:crypto'),config=require('./config.cjs');
const fs=require('node:fs');
test('rich article: formats, upload/paste/drop images, captions, collaboration, private history and image ACL',async({browser,request})=>{
 const api=config.NEXT_PUBLIC_API_URL,contexts=[];
 const login=async email=>{const r=await request.post(api+'/auth/login',{data:{email,password:config.TEST_PASSWORD}});expect(r.ok()).toBeTruthy();return(await r.json()).accessToken;};
 const owner=await login(config.TEST_OWNER_EMAIL),member=await login(config.TEST_MEMBER_EMAIL),viewer=await login(config.TEST_ADMIN_EMAIL),alien=await login(config.TEST_OTHER_EMAIL || 'owner@globex.dev');
 const headers={Authorization:`Bearer ${owner}`,'x-organization-id':config.TEST_ORG};
 const r=await request.post(api+'/documents',{headers,data:{projectId:config.TEST_PROJECT,title:'Rich article '+randomUUID().slice(0,8)}});expect(r.ok()).toBeTruthy();const d=await r.json();
 for(const [userId,role]of[[config.TEST_MEMBER,'EDITOR'],[config.TEST_ADMIN,'VIEWER']])expect((await request.put(`${api}/documents/${d.id}/grants`,{headers,data:{userId,role}})).ok()).toBeTruthy();
 const open=async token=>{const c=await browser.newContext();contexts.push(c);await c.addInitScript(({token,org})=>{localStorage.setItem('access_token',token);localStorage.setItem('current_org_id',org);},{token,org:config.TEST_ORG});const p=await c.newPage();await p.goto(`${config.WEB_URL}/projects/${config.TEST_PROJECT}/documents/${d.id}`);await expect(p.getByRole('textbox',{name:'协作文档正文'})).toBeVisible({timeout:60000});return p;};
 const body=p=>p.getByRole('textbox',{name:'协作文档正文'}),images=p=>body(p).locator('figure.document-image img');
 const saved=p=>expect(p.getByRole('status').filter({hasText:'已保存到服务器'})).toBeVisible({timeout:60000});
 const png=fs.readFileSync('tests/browser/fixtures/article.png');
 try{
  const a=await open(owner),b=await open(member),v=await open(viewer);await saved(a);await saved(b);await saved(v);
  await body(a).fill('图文协作样例');await a.getByLabel('段落样式').selectOption('1');await expect(body(a).locator('h1')).toContainText('图文协作样例');
  await body(a).press('End');await body(a).press('Enter');await a.keyboard.insertText('这是在线编写的图文正文。');
  await body(a).press('Control+a');await a.getByRole('button',{name:'粗体',exact:true}).click();await expect(body(a).locator('strong').first()).toBeVisible();
  await body(a).press('Control+End');
  await a.getByLabel('上传文档图片').setInputFiles({name:'article.png',mimeType:'image/png',buffer:png});
  await expect(images(a)).toHaveCount(1);await expect(images(b)).toHaveCount(1);await expect.poll(()=>images(a).first().evaluate(el=>el.complete && el.naturalWidth>0)).toBe(true);await saved(a);
  await images(a).first().click();await a.getByLabel('图片说明',{exact:true}).fill('图一：协作写作的配图说明');
  await a.getByLabel('图片宽度',{exact:true}).selectOption('75');await expect(a.getByLabel('图片说明',{exact:true})).toHaveValue('图一：协作写作的配图说明');
  await a.getByRole('button',{name:'保存图片说明',exact:true}).click();await expect(body(b).locator('figcaption')).toContainText('图一：协作写作的配图说明');
  for(const kind of ['paste','drop']){
    await body(a).press('Control+End');
    await body(a).evaluate((el,{base64,kind})=>{
      const binary=atob(base64),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));const transfer=new DataTransfer();transfer.items.add(new File([bytes],kind+'.png',{type:'image/png'}));
      if(kind==='paste')el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true,cancelable:true}));
      else {const box=el.getBoundingClientRect();el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,clientX:box.left+50,clientY:box.bottom-20,bubbles:true,cancelable:true}));}
    },{base64:png.toString('base64'),kind});
    await expect(images(a)).toHaveCount(kind==='paste'?2:3);await saved(a);
  }
  await expect(images(b)).toHaveCount(3);await expect(images(v)).toHaveCount(3);
  await expect(v.getByRole('button',{name:'插入图片',exact:true})).toBeDisabled();
  const asset=await body(a).locator('figure.document-image').first().getAttribute('data-asset-id');
  const image=await request.get(`${api}/documents/${d.id}/images/${asset}`,{headers});expect(image.ok()).toBeTruthy();expect(image.headers()['cache-control']).toBe('no-store');expect(await image.body()).toEqual(png);
  expect((await request.post(`${api}/documents/${d.id}/images`,{headers:{Authorization:`Bearer ${viewer}`,'x-organization-id':config.TEST_ORG},multipart:{file:{name:'test.png',mimeType:'image/png',buffer:png}}})).status()).toBe(403);
  expect((await request.get(`${api}/documents/${d.id}/images/${asset}`,{headers:{Authorization:`Bearer ${alien}`,'x-organization-id':config.TEST_OTHER_ORG}})).status()).toBe(404);
  await a.getByLabel('上传文档图片').setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await expect(a.getByRole('alert').filter({hasText:'PNG'})).toBeVisible();await expect(images(a)).toHaveCount(3);
  await body(b).press('Control+End');await b.keyboard.insertText('远端成员补充的文字。');await expect(body(a)).toContainText('远端成员补充的文字。');await saved(b);
  await a.reload();await expect(images(a)).toHaveCount(3);await expect(body(a)).toContainText('图一：协作写作的配图说明');
  await a.getByRole('button',{name:'历史版本',exact:true}).click();await a.getByLabel('版本名称').fill('Article with images');await a.getByRole('button',{name:'创建版本',exact:true}).click();await a.getByRole('button',{name:'只读预览',exact:true}).click();
  await expect(a.getByLabel('历史版本只读预览').locator('figure.document-image img')).toHaveCount(3);await a.getByRole('button',{name:'关闭预览',exact:true}).click();
  await a.screenshot({path:'evidence/collaboration/richtext-workspace.png',fullPage:true});
  await a.getByRole('button',{name:'恢复为副本',exact:true}).click();await expect(a).not.toHaveURL(new RegExp(d.id+'$'));await expect(images(a)).toHaveCount(3);await expect.poll(()=>images(a).first().evaluate(el=>el.complete && el.naturalWidth>0)).toBe(true);await saved(a);
  const copy=a.url().split('/').pop();expect((await request.get(`${api}/documents/${copy}/images/${asset}`,{headers:{Authorization:`Bearer ${member}`,'x-organization-id':config.TEST_ORG}})).status()).toBe(404);
 }finally{for(const c of contexts)await c.close();}
});
