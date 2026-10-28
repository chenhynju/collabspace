const {test,expect}=require('@playwright/test'),{randomUUID}=require('node:crypto'),fs=require('node:fs'),config=require('./config.cjs');
const local=[config.WEB_URL,config.NEXT_PUBLIC_API_URL].every(v=>['localhost','127.0.0.1'].includes(new URL(v).hostname));test.skip(!local,'Synthetic isolated local acceptance only');
async function auth(request,email=config.TEST_OWNER_EMAIL){const r=await request.post(config.NEXT_PUBLIC_API_URL+'/auth/login',{data:{email,password:config.TEST_PASSWORD}});expect(r.ok()).toBeTruthy();const token=(await r.json()).accessToken;return {Authorization:'Bearer '+token,'x-organization-id':config.TEST_ORG};}
const png=()=>fs.readFileSync('apps/web/public/personas/agent-lan-v1.png');
test('private photo/video source drafts: own identity, consent, idempotency, RLS, revocation and unavailable real generation',async({request})=>{
 const h=await auth(request),peer=await auth(request,config.TEST_MEMBER_EMAIL),api=config.NEXT_PUBLIC_API_URL;
 const cap=await(await request.get(api+'/voice/persona/capabilities',{headers:h})).json();expect(cap.creation.configured).toBe(false);
 const id=randomUUID(),data={requestId:id,kind:'PHOTO',locale:'zh-CN',consent:'true',consentVersion:cap.consentVersion,file:{name:'synthetic-art.png',mimeType:'image/png',buffer:png()}};
 const rejected=await request.post(api+'/voice/persona/drafts',{headers:h,multipart:{...data,consent:'false'}});expect(rejected.status()).toBe(400);
 const saved=await request.post(api+'/voice/persona/drafts',{headers:h,multipart:data});expect(saved.ok()).toBeTruthy();expect(await saved.json()).toMatchObject({state:'DRAFT',providerSubmitted:false,validation:'CONTAINER_ONLY'});
 expect((await request.post(api+'/voice/persona/drafts',{headers:h,multipart:data})).ok()).toBeTruthy();
 expect((await request.post(api+'/voice/persona/drafts',{headers:h,multipart:{...data,locale:'en-US'}})).status()).toBe(409);
 const read=await request.get(api+`/voice/persona/drafts/${id}/source`,{headers:h});expect(read.ok()).toBeTruthy();expect(await read.body()).toEqual(png());expect(read.headers()['cache-control']).toBe('no-store');
 for(const who of [peer,{...h,'x-organization-id':config.TEST_OTHER_ORG}]){expect((await request.get(api+`/voice/persona/drafts/${id}/source`,{headers:who})).ok()).toBeFalsy();expect((await request.delete(api+`/voice/persona/drafts/${id}`,{headers:who})).ok()).toBeFalsy();}
 expect((await request.post(api+`/voice/persona/drafts/${id}/create`,{headers:h})).status()).toBe(503);
 expect((await request.delete(api+`/voice/persona/drafts/${id}`,{headers:h})).ok()).toBeTruthy();expect((await request.get(api+`/voice/persona/drafts/${id}/source`,{headers:h})).status()).toBe(404);
 expect((await request.post(api+'/voice/persona/drafts',{headers:h,multipart:data})).status()).toBe(409);
 const a=await(await request.get(api+'/voice/persona/agent',{headers:h})).json();expect(a.planned).toEqual({male:10,female:10});expect(a.customizationAvailable).toBe(false);
 expect((await request.put(api+'/voice/persona/agent',{headers:peer,data:{mode:'preset',presetId:'lan-v1',revision:a.revision}})).status()).toBe(403);
 expect((await request.put(api+'/voice/persona/agent',{headers:h,data:{mode:'custom',presetId:'missing',revision:a.revision}})).status()).toBe(400);
 expect((await request.put(api+'/voice/persona/agent',{headers:h,data:{mode:'preset',presetId:'lan-v1',revision:a.revision}})).ok()).toBeTruthy();
 expect((await request.put(api+'/voice/persona/agent',{headers:h,data:{mode:'preset',presetId:'lan-v1',revision:a.revision}})).status()).toBe(409);
 console.log(JSON.stringify({test:'private draft and organization config',status:'PASSED',draft:id,providerCalls:0}));
});
async function enter(page,request,path){const h=await auth(request);await page.addInitScript(({token,org})=>{localStorage.setItem('access_token',token);localStorage.setItem('current_org_id',org);},{token:h.Authorization.slice(7),org:config.TEST_ORG});await page.goto(config.WEB_URL+path);}
test('actual browser: employee photo/video paths, local preview, upload/reload/revoke; no fake generation',async({page,request})=>{
 test.setTimeout(300000);const h=await auth(request),c=await request.post(config.NEXT_PUBLIC_API_URL+'/conversations/direct',{headers:h,data:{userId:config.TEST_MEMBER}}),{id}=await c.json();
 await enter(page,request,'/im?c='+id);await page.getByText('我的数字分身',{exact:true}).click();await expect(page.getByRole('button',{name:'保存私有素材草稿',exact:true})).toBeDisabled();
 await page.getByLabel('选择本人照片',{exact:true}).setInputFiles({name:'synthetic-art.png',mimeType:'image/png',buffer:png()});await expect(page.getByAltText('本人素材预览，尚非生成结果')).toBeVisible();await page.getByLabel('本人素材草稿授权').check();await page.getByRole('button',{name:'保存私有素材草稿',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'已保存私有素材草稿'})).toBeVisible({timeout:60000});
 await page.reload();await page.getByText('我的数字分身',{exact:true}).click();await expect(page.getByRole('button',{name:'查看原素材',exact:true})).toHaveCount(1,{timeout:60000});await page.getByRole('button',{name:'查看原素材',exact:true}).click();await expect(page.getByAltText('本人素材预览，尚非生成结果')).toBeVisible();
 await page.getByRole('button',{name:'撤销并删除素材',exact:true}).click();await expect(page.getByRole('button',{name:'查看原素材',exact:true})).toHaveCount(0);
 await page.getByRole('radio',{name:'视频创建',exact:true}).check();
 // Real browser-generated WebM container; synthetic colored canvas, no human identity or provider calls.
 const video=await page.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;const ctx=canvas.getContext('2d');ctx.fillStyle='#a5b4fc';ctx.fillRect(0,0,320,240);const stream=canvas.captureStream(10),rec=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];const done=new Promise(resolve=>rec.onstop=async()=>{const b=new Uint8Array(await new Blob(chunks).arrayBuffer());stream.getTracks().forEach(t=>t.stop());resolve(Array.from(b));});rec.ondataavailable=e=>chunks.push(e.data);rec.start();await new Promise(r=>setTimeout(r,500));rec.stop();return done;});
 await page.getByLabel('选择本人视频',{exact:true}).setInputFiles({name:'synthetic-video.webm',mimeType:'video/webm',buffer:Buffer.from(video)});await expect(page.getByLabel('本人视频素材预览')).toBeVisible();await page.getByLabel('本人素材草稿授权').check();await page.getByRole('button',{name:'保存私有素材草稿',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'已保存私有素材草稿'})).toBeVisible();await expect(page.getByText('草稿，未生成',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:/创建数字分身|开始训练/})).toHaveCount(0);await page.screenshot({path:'evidence/collaboration/digital-human-local-drafts.png',fullPage:true});await page.getByRole('button',{name:'撤销并删除素材',exact:true}).click();
});
test('actual browser: backend Agent config and a compact honest character stage',async({page,request})=>{
 test.setTimeout(300000);await enter(page,request,'/system/configs');await expect(page.getByLabel('后台Agent形象配置')).toBeVisible({timeout:90000});await page.getByRole('radio',{name:'选择形象 小岚',exact:true}).check();await page.getByRole('button',{name:'保存Agent形象',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'已保存当前组织的Agent形象配置'})).toBeVisible();
 await page.goto(config.WEB_URL+'/assistant');await expect(page.getByRole('button',{name:'查看Agent形象',exact:true})).toBeVisible({timeout:90000});await expect(page.getByLabel('Agent静态形象')).toHaveCount(0);await page.getByRole('button',{name:'查看Agent形象',exact:true}).click();await expect(page.getByLabel('Agent静态形象')).toBeVisible();await expect(page.getByText('静态角色外观稿 · 可动3D模型尚未交付',{exact:true})).toBeVisible();await page.screenshot({path:'evidence/collaboration/digital-human-local-agent.png',fullPage:true});await page.getByRole('button',{name:'收起形象',exact:true}).click();await expect(page.getByLabel('Agent静态形象')).toHaveCount(0);
});
