const {test,expect}=require('@playwright/test');
const {randomUUID}=require('node:crypto');
const c=require('./config.cjs');
test('release timeline: actual WS edit, immutable automatic snapshot, private restore and viewer refusal',async({page,request})=>{
 const api=c.NEXT_PUBLIC_API_URL,created=[];
 async function login(email){const r=await request.post(api+'/auth/login',{data:{email,password:c.TEST_PASSWORD}});expect(r.ok()).toBeTruthy();return {Authorization:'Bearer '+(await r.json()).accessToken,'x-organization-id':c.TEST_ORG};}
 const owner=await login(c.TEST_OWNER_EMAIL),peer=await login(c.TEST_MEMBER_EMAIL);
 const list=async id=>{const r=await request.get(api+`/documents/${id}/versions`,{headers:owner});expect(r.ok()).toBeTruthy();return r.json();};
 try{
  const r=await request.post(api+'/documents',{headers:owner,data:{projectId:c.TEST_PROJECT,title:'Synthetic release timeline '+randomUUID(),kind:'MARKDOWN',source:'Initial'}});expect(r.ok()).toBeTruthy();const doc=await r.json();created.push(doc.id);
  await page.addInitScript(({token,org})=>{localStorage.setItem('access_token',token);localStorage.setItem('current_org_id',org);},{token:owner.Authorization.slice(7),org:c.TEST_ORG});
  await page.goto(c.WEB_URL+`/projects/${c.TEST_PROJECT}/documents/${doc.id}`);
  const editor=page.getByLabel('协作 Markdown 源码');await expect(editor).toHaveValue('Initial');
  await editor.fill('First confirmed edit');
  await expect(page.getByRole('status').filter({hasText:'已保存到服务器'})).toBeVisible();
  await expect.poll(async()=> (await list(doc.id)).filter(v=>v.source==='AUTO').length).toBe(1);
  const auto=(await list(doc.id)).find(v=>v.source==='AUTO');
  const preview=await request.get(api+`/documents/${doc.id}/versions/${auto.id}`,{headers:owner});expect(preview.ok()).toBeTruthy();const original=await preview.json();
  await editor.fill('Later confirmed edit');await expect(page.getByRole('status').filter({hasText:'已保存到服务器'})).toBeVisible();
  const named=await request.post(api+`/documents/${doc.id}/versions`,{headers:owner,data:{id:randomUUID(),name:'Release checkpoint'}});expect(named.ok()).toBeTruthy();
  const immutable=await request.get(api+`/documents/${doc.id}/versions/${auto.id}`,{headers:owner});expect((await immutable.json()).state).toBe(original.state);
  const grant=await request.put(api+`/documents/${doc.id}/grants`,{headers:owner,data:{userId:c.TEST_MEMBER,role:'VIEWER'}});expect(grant.ok()).toBeTruthy();
  const denied=await request.post(api+`/documents/${doc.id}/versions/${auto.id}/restore-copy`,{headers:peer,data:{id:randomUUID()}});expect([403,404]).toContain(denied.status());
  await page.getByRole('button',{name:'历史版本',exact:true}).click();await expect(page.getByText('快照时间轴',{exact:true})).toBeVisible();
  await expect(page.getByRole('slider',{name:'快照时间轴'})).toBeVisible();
  const restored=await request.post(api+`/documents/${doc.id}/versions/${auto.id}/restore-copy`,{headers:owner,data:{id:randomUUID()}});expect(restored.ok()).toBeTruthy();const copy=await restored.json();created.push(copy.id);
  const foreign=await request.get(api+'/documents/'+copy.id,{headers:peer});expect([403,404]).toContain(foreign.status());
  await page.goto(c.WEB_URL+`/projects/${c.TEST_PROJECT}/documents/${copy.id}`);await expect(page.getByLabel('协作 Markdown 源码')).toHaveValue('First confirmed edit');
  await page.reload();await expect(page.getByLabel('协作 Markdown 源码')).toHaveValue('First confirmed edit');
 }finally{
  for(const id of created){const r=await request.post(api+`/documents/${id}/archive`,{headers:owner});expect(r.ok()).toBeTruthy();}
 }
});
