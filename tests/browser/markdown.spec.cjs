const {test,expect}=require('@playwright/test'),config=require('./config.cjs'),{randomUUID}=require('node:crypto'),fs=require('node:fs');
test('native Markdown import, GFM/Mermaid preview, two-editor convergence, offline export, comments and private history',async({browser,request})=>{
 const api=config.NEXT_PUBLIC_API_URL,contexts=[];
 const login=async email=>{const r=await request.post(api+'/auth/login',{data:{email,password:config.TEST_PASSWORD}});expect(r.ok()).toBeTruthy();return(await r.json()).accessToken;};
 const owner=await login(config.TEST_OWNER_EMAIL),peer=await login(config.TEST_MEMBER_EMAIL),viewer=await login(config.TEST_ADMIN_EMAIL),headers={Authorization:'Bearer '+owner,'x-organization-id':config.TEST_ORG};
 const client=async token=>{const c=await browser.newContext();contexts.push(c);await c.addInitScript(({token,org})=>{localStorage.setItem('access_token',token);localStorage.setItem('current_org_id',org);},{token,org:config.TEST_ORG});return c.newPage();};
 const source=p=>p.getByLabel('协作 Markdown 源码'),saved=p=>expect(p.getByRole('status').filter({hasText:'已保存到服务器'})).toBeVisible({timeout:60000});
 try{
  const a=await client(owner),filename='Native-'+randomUUID().slice(0,8)+'.md';
  const initial='# 原生 Markdown\n\n|项目|状态|\n|---|---|\n|文档|完成|\n\n- [x] 实时协作\n\n```mermaid\nflowchart LR\n A[源文件] --> B[协作]\n```\n\n<script>window.markdownUnsafe=true</script>\n[unsafe](javascript:alert(1))\n';
  await a.goto(`${config.WEB_URL}/projects/${config.TEST_PROJECT}/documents`);
  await a.getByLabel('导入 Markdown 文件').setInputFiles({name:filename,mimeType:'text/markdown',buffer:Buffer.from('\ufeff'+initial.replaceAll('\n','\r\n'))});
  await a.getByRole('link').filter({hasText:filename}).click();await expect(source(a)).toHaveValue(initial);await saved(a);
  const id=a.url().split('/').pop();
  let listRequests=0;const mineRoute=api+'/documents/mine';await a.route(mineRoute,r=>{listRequests++;return listRequests===1?r.abort():r.continue();});
  await a.goto(config.WEB_URL+'/files');await a.getByRole('link').filter({hasText:filename}).click();expect(listRequests).toBeGreaterThan(1);await a.unroute(mineRoute);await expect(source(a)).toHaveValue(initial);await saved(a);
  for(const [userId,role]of[[config.TEST_MEMBER,'EDITOR'],[config.TEST_ADMIN,'VIEWER']])expect((await request.put(`${api}/documents/${id}/grants`,{headers,data:{userId,role}})).ok()).toBeTruthy();
  const b=await client(peer),v=await client(viewer);await b.goto(a.url());await v.goto(a.url());await saved(b);await saved(v);
  await expect(source(v)).toHaveAttribute('readonly','');await expect(a.getByLabel('Markdown 安全预览').locator('table')).toContainText('完成');
  await expect(a.frameLocator('iframe[title="Mermaid 图表"]').locator('svg')).toContainText('源文件');expect(await a.evaluate(()=>window.markdownUnsafe)).toBeUndefined();await expect(a.getByLabel('Markdown 安全预览').locator('script')).toHaveCount(0);
  await source(a).press('Control+Home');await source(b).press('Control+End');await Promise.all([a.keyboard.insertText('<!-- owner -->\n'),b.keyboard.insertText('\n<!-- peer -->')]);
  await expect(source(a)).toHaveValue(/owner/);await expect(source(a)).toHaveValue(/peer/);await expect.poll(()=>source(b).inputValue()).toBe(await source(a).inputValue());await saved(a);await saved(b);
  await contexts[1].setOffline(true);await source(b).press('Control+End');await b.keyboard.insertText('\nOffline Markdown\n');await expect(b.getByRole('status')).toContainText('此设备');
  const [download]=await Promise.all([b.waitForEvent('download'),b.getByRole('button',{name:'下载 .md',exact:true}).click()]);expect(download.suggestedFilename()).toBe(filename);expect(fs.readFileSync(await download.path(),'utf8')).toBe(await source(b).inputValue());
  await contexts[1].setOffline(false);await expect(source(a)).toHaveValue(/Offline Markdown/);await saved(b);
  await source(a).press('Control+Home');await source(a).press('Control+Shift+End');await a.getByLabel('评论内容').fill('Markdown review');await a.getByRole('button',{name:'评论选中内容',exact:true}).click();await expect(b.getByText('Markdown review',{exact:true})).toBeVisible({timeout:10000});
  await a.getByRole('button',{name:'历史版本',exact:true}).click();await a.getByLabel('版本名称').fill('Native source version');await a.getByRole('button',{name:'创建版本',exact:true}).click();await a.getByRole('button',{name:'只读预览',exact:true}).click();await expect(a.getByRole('dialog').getByLabel('Markdown 安全预览')).toContainText('Offline Markdown');await a.getByRole('button',{name:'关闭预览',exact:true}).click();
  const text=await source(a).inputValue();await a.screenshot({path:'evidence/collaboration/markdown-workspace.png',fullPage:true});
  await a.getByRole('button',{name:'恢复为副本',exact:true}).click();await expect(a).not.toHaveURL(new RegExp(id+'$'));await expect(source(a)).toHaveValue(text);await a.reload();await expect(source(a)).toHaveValue(text);await saved(a);
  const copy=a.url().split('/').pop();expect((await request.get(`${api}/documents/${copy}`,{headers:{Authorization:'Bearer '+peer,'x-organization-id':config.TEST_ORG}})).status()).toBe(404);
  const mine=await request.get(api+'/documents/mine',{headers});expect(mine.ok()).toBeTruthy();expect((await mine.json()).some(d=>d.id===copy)).toBe(true);
  const peerMine=await request.get(api+'/documents/mine',{headers:{Authorization:'Bearer '+peer,'x-organization-id':config.TEST_ORG}});expect((await peerMine.json()).some(d=>d.id===copy)).toBe(false);
 }finally{for(const c of contexts)await c.close();}
});
