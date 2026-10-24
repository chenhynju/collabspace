// Synthetic online diagnostic. Credentials/config and signed URLs never enter the report.
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {chromium}=require('@playwright/test');
const out=path.resolve('.test-runs/ppt-image-profile');fs.mkdirSync(out,{recursive:true});
const c=JSON.parse(fs.readFileSync(process.env.COLLAB_BROWSER_CONFIG||'.test-runs/deploy/online-config.json','utf8'));
const phase=process.argv[2]||'inspect';
const http1=process.env.OFFICE_PROFILE_HTTP1!=='0';
const clean=url=>{const u=new URL(url);return u.pathname.replace(/\/(doc|data|files|upload)\/[^/]+/g,'/$1/:document').replace(/[a-f0-9]{32,}/gi,':hash');};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:http1?['--disable-http2','--disable-quic']:[]});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1050}});
  const login=await ctx.request.post(c.NEXT_PUBLIC_API_URL+'/auth/login',{data:{email:c.TEST_OWNER_EMAIL,password:c.TEST_PASSWORD}});
  if(!login.ok())throw Error('Synthetic login status '+login.status());
  const token=(await login.json()).accessToken,headers={Authorization:'Bearer '+token,'x-organization-id':c.TEST_ORG};
  const stateFile=path.join(out,'document.json');let doc;
  if(fs.existsSync(stateFile))doc=JSON.parse(fs.readFileSync(stateFile,'utf8'));
  else{
   const created=await ctx.request.post(c.NEXT_PUBLIC_API_URL+'/office/create',{headers,data:{projectId:c.TEST_PROJECT,title:'Synthetic-image-latency-'+randomUUID().slice(0,8),extension:'pptx',requestId:randomUUID()}});
   if(!created.ok())throw Error('Synthetic PPT creation status '+created.status());
   const data=await created.json();doc={id:data.id,createdAt:new Date().toISOString()};fs.writeFileSync(stateFile,JSON.stringify(doc,null,2));
  }
  await ctx.addInitScript(({token,org})=>{localStorage.setItem('access_token',token);localStorage.setItem('current_org_id',org);},{token,org:c.TEST_ORG});
  const p=await ctx.newPage(),records=[],inflight=new Map();
  p.on('request',req=>{inflight.set(req,{method:req.method(),path:clean(req.url()),type:req.resourceType(),bodyBytes:req.postDataBuffer()?.length||0});});
  p.on('requestfinished',async req=>{const row=inflight.get(req);if(!row)return;const r=await req.response();records.push({...row,status:r?.status(),timing:req.timing()});});
  p.on('requestfailed',req=>{const row=inflight.get(req);if(row)records.push({...row,error:req.failure()?.errorText,timing:req.timing()});});
  await p.goto(c.WEB_URL+'/office/'+doc.id,{waitUntil:'domcontentloaded',timeout:60000});
  await p.locator('[data-office-ready="true"]').waitFor({timeout:180000});
  const f=p.frames().find(x=>/presentationeditor/.test(x.url()));if(!f)throw Error('Native presentation frame missing');
  await f.locator('#id_viewer_overlay').waitFor({timeout:120000});
  if(phase==='inspect'){
   console.log('image-button-dom',await f.locator('#tlbtn-insertimage-0').evaluate(x=>x.outerHTML.slice(0,6000)));
   console.log(JSON.stringify({docId:doc.id,framePath:clean(f.url()),fileInputs:await f.locator('input[type=file]').evaluateAll(xs=>xs.map(x=>({id:x.id,accept:x.accept}))),imageControls:await f.locator('[id*="image"],[id*="picture"],[data-hint*="图片"]').evaluateAll(xs=>xs.slice(0,35).map(x=>({tag:x.tagName,id:x.id,text:(x.textContent||'').trim().slice(0,40),visible:!!x.getClientRects().length})))}));
   await p.screenshot({path:path.join(out,'editor.png'),fullPage:true});
   fs.writeFileSync(path.join(out,'initial-network.json'),JSON.stringify(records,null,2));
  }
  if(phase==='measure'){
   const cdp=await ctx.newCDPSession(f).catch(()=>ctx.newCDPSession(p)),network=[],active=new Map(),samples=[];
   await cdp.send('Network.enable');
   cdp.on('Network.requestWillBeSent',e=>active.set(e.requestId,{method:e.request.method,path:clean(e.request.url),start:e.timestamp,type:e.type}));
   cdp.on('Network.responseReceived',e=>{const r=active.get(e.requestId);if(r){r.status=e.response.status;r.details=e.response.timing;r.type=e.type;r.protocol=e.response.protocol;r.cache=!!e.response.fromDiskCache||!!e.response.fromServiceWorker;}});
   cdp.on('Network.loadingFinished',e=>{const r=active.get(e.requestId);if(!r)return;const t=r.details||{};network.push({method:r.method,path:r.path,type:r.type,status:r.status,protocol:r.protocol,cache:r.cache,totalMs:(e.timestamp-r.start)*1000,uploadMs:t.sendEnd>=0?t.sendEnd-t.sendStart:null,waitMs:t.receiveHeadersStart>=0?t.receiveHeadersStart-t.sendEnd:null,downloadMs:t.receiveHeadersEnd>=0?(e.timestamp-t.requestTime)*1000-t.receiveHeadersEnd:null,encodedBytes:e.encodedDataLength});});
   const sizes=(process.env.OFFICE_PROFILE_SIZES||'small,large,small,large').split(',');if(sizes.some(s=>!['small','large'].includes(s)))throw Error('Invalid fixture size');
   for(const size of sizes){
    await f.locator('#tlbtn-insertimage-0 button').click();
    const choice=p.waitForEvent('filechooser',{timeout:10000});
    await f.locator('#tlbtn-insertimage-0').getByText('来自文件的图片',{exact:true}).click();
    const picker=await choice,begin=Date.now(),index=network.length;
    const posted=p.waitForResponse(r=>r.request().method()==='POST'&&/upload/i.test(new URL(r.url()).pathname),{timeout:90000});
    const image=p.waitForResponse(r=>r.request().resourceType()==='image'&&/\/media\//.test(new URL(r.url()).pathname),{timeout:90000});
    await picker.setFiles(path.join(out,size+'.png'));
    const upload=await posted;await upload.finished();const postDoneMs=Date.now()-begin;
    const img=await image;await img.finished();const imageDoneMs=Date.now()-begin;
    await f.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await p.screenshot({path:path.join(out,'insert-'+samples.length+'-'+size+'.png'),fullPage:true});
    const sample={size,bytes:fs.statSync(path.join(out,size+'.png')).size,postDoneMs,imageDoneMs,uploadStatus:upload.status(),imageStatus:img.status(),network:network.slice(index).filter(r=>r.path.includes('/office-engine/'))};
    samples.push(sample);console.log(JSON.stringify(sample));
    fs.writeFileSync(path.join(out,http1?'measurements-http1.json':'measurements-default.json'),JSON.stringify({at:new Date().toISOString(),browser:http1?'Edge headless HTTP/1.1 forced':'Edge headless default negotiation',document:doc.id,samples},null,2));
    await p.keyboard.press('Escape');
   }
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message.replace(/https?:\/\/\S+/g,'[url omitted]'));process.exitCode=1;});
