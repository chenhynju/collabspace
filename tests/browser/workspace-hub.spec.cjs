const {test,expect}=require('@playwright/test'),{randomUUID}=require('crypto'),fs=require('fs'),c=require('./config.cjs');
test.use({launchOptions:{args:['--disable-http2','--disable-quic']}});
const login=async(request,email)=>{const r=await request.post(c.NEXT_PUBLIC_API_URL+'/auth/login',{data:{email,password:c.TEST_PASSWORD}});expect(r.ok()).toBeTruthy();return(await r.json()).accessToken;};
const pageFor=async(browser,token,contexts)=>{const ctx=await browser.newContext({viewport:{width:1600,height:1050}});contexts.push(ctx);await ctx.addInitScript(({token,org})=>{localStorage.setItem('access_token',token);localStorage.setItem('current_org_id',org)},{token,org:c.TEST_ORG});return ctx.newPage();};
test('unified workspace: create/import content, metadata, project scope, legacy links and mobile navigation',async({browser,request})=>{
 test.setTimeout(420000);const contexts=[],token=await login(request,c.TEST_OWNER_EMAIL),prefix='Hub-'+randomUUID().slice(0,8),url=c.WEB_URL+'/projects/'+c.TEST_PROJECT+'/content';
 try{const p=await pageFor(browser,token,contexts);await p.goto(url);await expect(p.getByRole('heading',{name:'协作空间',exact:true})).toBeVisible();await expect(p.getByRole('link',{name:'协作空间',exact:true})).toHaveAttribute('aria-current','page');
 for(const name of ['富文本文档','Markdown','白板 / Mermaid','Word','Excel','PowerPoint'])await expect(p.getByRole('button',{name:'新建 '+name,exact:true})).toBeVisible();
 for(const [kind,name]of [['DOCUMENT','富文本文档'],['MARKDOWN','Markdown'],['BOARD','白板 / Mermaid']]){
  await p.getByRole('button',{name:'新建 '+name,exact:true}).click();await p.getByLabel('新内容标题').fill(prefix+'-'+kind);await p.getByRole('button',{name:'创建并打开',exact:true}).click();await expect(p).toHaveURL(/\/documents\/[a-f0-9-]+$/);await expect(p.getByRole('heading',{name:prefix+'-'+kind,exact:true})).toBeVisible();await p.getByRole('link',{name:'← 协作空间',exact:true}).click();await expect(p).toHaveURL(/\/content$/);
 }
 for(const [ext,source,label]of [['md','# Unified import\n\nPersistent Markdown.\n','协作 Markdown 源码'],['mmd','flowchart LR\n A[Unified] --> B[Workspace]','协作 Mermaid 源码']]){
  await p.getByRole('button',{name:'上传文件',exact:true}).click();await p.getByLabel('上传已有文件').setInputFiles({name:prefix+'.'+ext,mimeType:'text/plain',buffer:Buffer.from('\ufeff'+source.replaceAll('\n','\r\n'))});await p.getByRole('button',{name:'上传并打开',exact:true}).click();await expect(p.getByLabel(label)).toHaveValue(source);await expect(p.getByRole('status').filter({hasText:'已保存到服务器'})).toBeVisible();await p.getByRole('link',{name:'← 协作空间',exact:true}).click();
 }
 await p.getByLabel('搜索协作资源').fill(prefix);await expect(p.getByRole('row').filter({hasText:prefix})).toHaveCount(5);const row=p.getByRole('row').filter({hasText:prefix+'-DOCUMENT'});await expect(row.getByRole('cell').nth(4)).toHaveText(/^\d{4}-\d{2}-\d{2}$/);await expect(row).toContainText('所有者');await expect(row.getByRole('cell').nth(3)).not.toHaveText('历史作者未记录');
 await p.getByLabel('内容类型').selectOption('MARKDOWN');await expect(p.getByRole('row').filter({hasText:prefix})).toHaveCount(2);
 for(const [path,kind]of [['documents','DOCUMENTS'],['boards','BOARD']]){await p.goto(c.WEB_URL+'/projects/'+c.TEST_PROJECT+'/'+path);await expect(p.getByRole('heading',{name:'协作空间',exact:true})).toBeVisible();await expect(p.getByLabel('内容类型')).toHaveValue(kind);}
 await p.goto(c.WEB_URL+'/collaboration');await p.getByLabel('搜索协作资源').fill(prefix);await expect(p.getByRole('row').filter({hasText:prefix})).toHaveCount(5);fs.mkdirSync('.test-runs/content-hub-browser',{recursive:true});await p.screenshot({path:'.test-runs/content-hub-browser/hub.png',fullPage:true});await p.setViewportSize({width:390,height:844});await p.getByRole('button',{name:'打开导航',exact:true}).click();await expect(p.getByRole('link',{name:'协作空间',exact:true})).toBeVisible();await p.keyboard.press('Escape');expect(await p.evaluate(()=>document.body.scrollWidth<=innerWidth+1)).toBeTruthy();await p.screenshot({path:'.test-runs/content-hub-browser/mobile.png',fullPage:true});
 }finally{for(const ctx of contexts)await ctx.close();}
});
test('blank Office from shared create menu: three formats, real role boundaries and file-filter isolation',async({browser,request})=>{
 test.setTimeout(600000);const contexts=[],api=c.NEXT_PUBLIC_API_URL,owner=await login(request,c.TEST_OWNER_EMAIL),peer=await login(request,c.TEST_MEMBER_EMAIL),viewer=await login(request,c.TEST_ADMIN_EMAIL),headers={Authorization:'Bearer '+owner,'x-organization-id':c.TEST_ORG},prefix='Blank-'+randomUUID().slice(0,8),native=process.env.OFFICE_BROWSER_TEST==='1';
 try{const p=await pageFor(browser,owner,contexts);
 if(!native)await p.route('**/web-apps/apps/api/documents/api.js',route=>route.fulfill({contentType:'application/javascript',body:'window.DocsAPI={DocEditor:class{constructor(id,c){document.getElementById(id).innerHTML="<p>LOCAL ENGINE STUB</p>";setTimeout(()=>c.events.onDocumentReady(),30)}destroyEditor(){}}}'}));
 for(const [name,extension]of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
  await p.goto(c.WEB_URL+'/projects/'+c.TEST_PROJECT+'/content');await p.getByRole('button',{name:'新建 '+name,exact:true}).click();await p.getByLabel('新内容标题').fill(prefix+'-'+name);
  const [response]=await Promise.all([p.waitForResponse(r=>r.url().endsWith('/office/create')&&r.request().method()==='POST'),p.getByRole('button',{name:'创建并打开',exact:true}).click()]);expect(response.ok()).toBeTruthy();const d=await response.json();await expect(p).toHaveURL(new RegExp('/office/'+d.id+'$'));await expect(p.locator('[data-office-ready="true"]')).toBeVisible({timeout:native?240000:60000});await expect(p.getByRole('heading',{name:prefix+'-'+name+'.'+extension,exact:true})).toBeVisible();
  if(native)expect(p.frames().some(f=>/documenteditor|spreadsheeteditor|presentationeditor/.test(f.url()))).toBeTruthy();
  expect((await request.get(api+'/office/'+d.id+'/download',{headers})).ok()).toBeTruthy();
  if(extension==='docx'){
   for(const[userId,role]of [[c.TEST_MEMBER,'EDITOR'],[c.TEST_ADMIN,'VIEWER']])expect((await request.put(api+'/documents/'+d.id+'/grants',{headers,data:{userId,role}})).ok()).toBeTruthy();
   const b=await pageFor(browser,peer,contexts),v=await pageFor(browser,viewer,contexts);await b.goto(c.WEB_URL+'/collaboration');await b.getByLabel('搜索协作资源').fill(prefix+'-'+name);await expect(b.getByRole('row').filter({hasText:prefix+'-'+name})).toHaveCount(1);await expect(b.getByRole('row').filter({hasText:prefix+'-'+name})).toContainText('可编辑');
   await v.goto(c.WEB_URL+'/collaboration');await v.getByLabel('搜索协作资源').fill(prefix+'-'+name);await expect(v.getByRole('row').filter({hasText:prefix+'-'+name})).toContainText('只读');expect((await request.post(api+'/office/'+d.id+'/save',{headers:{Authorization:'Bearer '+viewer,'x-organization-id':c.TEST_ORG}})).status()).toBe(403);
   await request.put(api+'/documents/'+d.id+'/grants',{headers,data:{userId:c.TEST_MEMBER,role:'REMOVE'}});await b.reload();await b.getByLabel('搜索协作资源').fill(prefix+'-'+name);await expect(b.getByRole('row').filter({hasText:prefix+'-'+name})).toHaveCount(0);
  }
  await p.getByRole('link',{name:'← 协作空间',exact:true}).click();await expect(p).toHaveURL(/\/content$/);await p.getByLabel('搜索协作资源').fill(prefix+'-'+name);await expect(p.getByRole('row').filter({hasText:prefix+'-'+name})).toHaveCount(1);
 }
 // An explicitly requested project must intersect the server-verified accessible projects.
 let privateProject=c.TEST_PRIVATE_PROJECT;if(!privateProject){const projectInfo=await(await request.get(api+'/projects/'+c.TEST_PROJECT,{headers})).json();const created=await request.post(api+'/projects',{headers,data:{name:'Hub restricted '+randomUUID().slice(0,8),workspaceId:projectInfo.workspace.id}});expect(created.ok(),await created.text()).toBeTruthy();privateProject=(await created.json()).id;expect((await request.patch(api+'/groups/resources/projects/'+privateProject,{headers,data:{visibility:'RESTRICTED'}})).ok()).toBeTruthy();}
 expect((await request.post(api+'/files/upload',{headers,multipart:{projectId:privateProject,file:{name:'private-isolation.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic restricted attachment')}}})).ok()).toBeTruthy();
 const denied=await request.get(api+'/files?projectId='+privateProject,{headers:{Authorization:'Bearer '+peer,'x-organization-id':c.TEST_ORG}});if(denied.ok())expect(await denied.json()).toEqual([]);else expect([403,404]).toContain(denied.status());
 const forged=await request.post(api+'/office/create',{headers:{...headers,'x-organization-id':'unrelated-'+randomUUID()},data:{projectId:c.TEST_PROJECT,title:'Denied',extension:'docx',requestId:randomUUID()}});expect([403,404]).toContain(forged.status());
 const extraOrg=await request.post(api+'/office/create',{headers,data:{projectId:c.TEST_PROJECT,title:'Denied',extension:'docx',requestId:randomUUID(),organizationId:'forged'}});expect(extraOrg.status()).toBe(400);
 console.log('Blank Office validated with '+(native?'real native engine':'LOCAL ENGINE STUB (not native editing acceptance)'));
 }finally{for(const ctx of contexts)await ctx.close();}
});
