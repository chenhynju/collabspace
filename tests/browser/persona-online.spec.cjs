const {test,expect}=require('@playwright/test'),{randomUUID}=require('node:crypto'),fs=require('node:fs'),c=require('./config.cjs');
test.skip(c.WEB_URL!=='https://collabspace.purelamp.uk'||c.NEXT_PUBLIC_API_URL!=='https://collabspace-api.purelamp.uk/api/v1','Canonical site only');
test.skip(c.TEST_OWNER_EMAIL!=='owner@acme.dev','Dedicated synthetic acceptance identity only');
async function auth(request,email=c.TEST_OWNER_EMAIL){const r=await request.post(c.NEXT_PUBLIC_API_URL+'/auth/login',{data:{email,password:c.TEST_PASSWORD}});expect(r.ok()).toBeTruthy();return{Authorization:'Bearer '+(await r.json()).accessToken,'x-organization-id':c.TEST_ORG};}
test('online API: real synthetic DOCX extraction is transient and malformed PDF is rejected',async({request})=>{
 const h=await auth(request),{createRequire}=require('node:module'),JSZip=createRequire(require.resolve('../../apps/api/node_modules/mammoth'))('jszip'),zip=new JSZip();
 zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'+('Synthetic release acceptance. Alice owns delivery Friday. ').repeat(8)+'</w:t></w:r></w:p></w:body></w:document>');
 const r=await request.post(c.NEXT_PUBLIC_API_URL+'/assistant/extract',{headers:h,timeout:45000,multipart:{projectId:c.TEST_PROJECT,file:{name:'synthetic-release.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:await zip.generateAsync({type:'nodebuffer'})}}});expect(r.ok()).toBeTruthy();expect(await r.json()).toMatchObject({persisted:false});expect((await r.json()).text).toContain('Alice owns delivery Friday');
 const bad=await request.post(c.NEXT_PUBLIC_API_URL+'/assistant/extract',{headers:h,multipart:{projectId:c.TEST_PROJECT,file:{name:'invalid.pdf',mimeType:'application/pdf',buffer:Buffer.from('Not a PDF')}}});expect(bad.status()).toBe(400);
});
test('online API: synthetic private source isolation, revoked bytes, delivered catalog and disabled payment routes',async({request})=>{
 const h=await auth(request),peer=await auth(request,c.TEST_MEMBER_EMAIL),api=c.NEXT_PUBLIC_API_URL,id=randomUUID();
 for(const p of ['stripe','paypal']){const r=await request.get(api+`/billing/${p}/configuration`,{headers:h});expect(r.ok()).toBeTruthy();expect(await r.json()).toMatchObject({enabled:false,mode:p==='stripe'?'test':'sandbox'});}
 const cat=await request.get(api+'/voice/persona/agent',{headers:h});expect(cat.ok()).toBeTruthy();const a=await cat.json();expect(a.catalog).toHaveLength(20);expect(a.customizationAvailable).toBe(false);
 const cap=await(await request.get(api+'/voice/persona/capabilities',{headers:h})).json();const bytes=fs.readFileSync('apps/web/public/personas/agent-lan-v1.png'),data={requestId:id,kind:'PHOTO',locale:'zh-CN',consent:'true',consentVersion:cap.consentVersion,file:{name:'synthetic-original-art.png',mimeType:'image/png',buffer:bytes}};
 try{
 expect((await request.post(api+'/voice/persona/drafts',{headers:h,multipart:{...data,consent:'false'}})).status()).toBe(400);
 const r=await request.post(api+'/voice/persona/drafts',{headers:h,multipart:data});expect(r.ok()).toBeTruthy();expect(await r.json()).toMatchObject({state:'DRAFT',providerSubmitted:false});
 const source=await request.get(api+`/voice/persona/drafts/${id}/source`,{headers:h});expect(source.ok()).toBeTruthy();expect(source.headers()['cache-control']).toBe('no-store');expect(await source.body()).toEqual(bytes);
 expect((await request.get(api+`/voice/persona/drafts/${id}/source`,{headers:peer})).status()).toBe(404);
 expect((await request.delete(api+`/voice/persona/drafts/${id}`,{headers:peer})).ok()).toBe(false);
 if(!cap.creation.configured)expect((await request.post(api+`/voice/persona/drafts/${id}/create`,{headers:h})).status()).toBe(503);
 }finally{expect((await request.delete(api+`/voice/persona/drafts/${id}`,{headers:h})).ok()).toBeTruthy();}
 expect((await request.get(api+`/voice/persona/drafts/${id}/source`,{headers:h})).status()).toBe(404);
});
test('online UI: choose a delivered preset, persist on refresh, display on Agent and restore original',async({page,request})=>{
 test.skip(process.env.PERSONA_ONLINE_UI!=='1','Enable after frontend promotion');const h=await auth(request),api=c.NEXT_PUBLIC_API_URL,original=await(await request.get(api+'/voice/persona/agent',{headers:h})).json();
 await page.addInitScript(({token,org})=>{localStorage.setItem('access_token',token);localStorage.setItem('current_org_id',org);},{token:h.Authorization.slice(7),org:c.TEST_ORG});
 try{
 await page.goto(c.WEB_URL+'/system/configs');const s=page.getByLabel('后台Agent形象配置');await expect(s.getByRole('radio')).toHaveCount(20);await s.getByRole('button',{name:'男款',exact:true}).click();await expect(s.getByRole('radio')).toHaveCount(10);await s.getByRole('radio',{name:'选择形象 知行',exact:true}).check();await s.getByRole('button',{name:'保存Agent形象',exact:true}).click();await expect(s.getByRole('status')).toContainText('已保存当前组织');await page.reload();await expect(s.getByRole('radio',{name:'选择形象 知行',exact:true})).toBeChecked();await s.getByRole('button',{name:'男款',exact:true}).click();await expect.poll(()=>s.getByAltText('待保存形象 知行').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);await page.screenshot({path:'evidence/collaboration/persona-online-catalog-20261028.png',fullPage:true});
 await page.goto(c.WEB_URL+'/assistant');await expect(page.getByAltText('知行 · 当前Agent形象')).toBeVisible();await page.getByRole('button',{name:'查看Agent形象',exact:true}).click();await expect(page.getByLabel('Agent静态形象')).toBeVisible();await page.screenshot({path:'evidence/collaboration/persona-online-agent-20261028.png',fullPage:true});
 }finally{const current=await(await request.get(api+'/voice/persona/agent',{headers:h})).json();expect((await request.put(api+'/voice/persona/agent',{headers:h,data:{mode:'preset',presetId:original.presetId,revision:current.revision}})).ok()).toBeTruthy();}
});
