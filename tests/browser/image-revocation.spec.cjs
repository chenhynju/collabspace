const {test,expect}=require('@playwright/test'),config=require('./config.cjs'),fs=require('node:fs');
test('known revocation hides decoded images and clears private image cache while retaining text draft',async({browser,request})=>{
 const api=config.NEXT_PUBLIC_API_URL,contexts=[];
 const login=async email=>{const r=await request.post(api+'/auth/login',{data:{email,password:config.TEST_PASSWORD}});expect(r.ok()).toBeTruthy();return(await r.json()).accessToken;};
 const owner=await login(config.TEST_OWNER_EMAIL),peer=await login(config.TEST_MEMBER_EMAIL),headers={Authorization:'Bearer '+owner,'x-organization-id':config.TEST_ORG};
 const created=await request.post(api+'/documents',{headers,data:{projectId:config.TEST_PROJECT,title:'Private image cache revocation'}});expect(created.ok()).toBeTruthy();const doc=await created.json();
 expect((await request.put(`${api}/documents/${doc.id}/grants`,{headers,data:{userId:config.TEST_MEMBER,role:'EDITOR'}})).ok()).toBeTruthy();
 const page=async token=>{const c=await browser.newContext();contexts.push(c);await c.addInitScript(({token,org})=>{localStorage.setItem('access_token',token);localStorage.setItem('current_org_id',org);},{token,org:config.TEST_ORG});const p=await c.newPage();await p.goto(`${config.WEB_URL}/projects/${config.TEST_PROJECT}/documents/${doc.id}`);await expect(p.getByRole('textbox',{name:'协作文档正文'})).toBeVisible({timeout:60000});await expect(p.getByRole('status').filter({hasText:'已保存到服务器'})).toBeVisible({timeout:60000});return p;};
 try{
  const a=await page(owner),b=await page(peer);await a.getByLabel('上传文档图片').setInputFiles({name:'private.png',mimeType:'image/png',buffer:fs.readFileSync(require('node:path').join(__dirname,'fixtures/article.png'))});
  const image=b.locator('figure.document-image img');await expect(image).toHaveCount(1);await expect.poll(()=>image.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
  const keys=()=>b.evaluate(async({user,org,doc})=>new Promise((resolve,reject)=>{const r=indexedDB.open(`collabspace:v1:${location.origin}:${user}:${org}:${doc}`,1);r.onsuccess=()=>{const db=r.result,q=db.transaction('data').objectStore('data').getAllKeys();q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);}),{user:config.TEST_MEMBER,org:config.TEST_ORG,doc:doc.id});
  await expect.poll(async()=>(await keys()).filter(k=>String(k).startsWith('image:')).length).toBe(1);
  expect((await request.put(`${api}/documents/${doc.id}/grants`,{headers,data:{userId:config.TEST_MEMBER,role:'REMOVE'}})).ok()).toBeTruthy();
  await expect(b.getByRole('status').filter({hasText:'权限已撤销'})).toBeVisible({timeout:30000});await expect(image).toHaveCount(0);
  await expect.poll(async()=>(await keys()).filter(k=>String(k).startsWith('image:')).length).toBe(0);expect(await keys()).toContain('state');
 }finally{for(const c of contexts)await c.close();}
});
