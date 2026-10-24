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
  const stateFile=path.join(out,process.env.OFFICE_PROFILE_REPLAY==='1'?'wait-document.json':process.env.OFFICE_PROFILE_FRESH==='1'?'exact-document.json':'document.json');let doc;
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
  console.log('Synthetic editor ready');
  const f=p.frames().find(x=>/presentationeditor/.test(x.url()));if(!f)throw Error('Native presentation frame missing');
  await f.locator('#id_viewer_overlay').waitFor({timeout:120000});
  if(phase==='inspect'){
   console.log('image-button-dom',await f.locator('#tlbtn-insertimage-0').evaluate(x=>x.outerHTML.slice(0,6000)));
   console.log(JSON.stringify({docId:doc.id,framePath:clean(f.url()),fileInputs:await f.locator('input[type=file]').evaluateAll(xs=>xs.map(x=>({id:x.id,accept:x.accept}))),imageControls:await f.locator('[id*="image"],[id*="picture"],[data-hint*="图片"]').evaluateAll(xs=>xs.slice(0,35).map(x=>({tag:x.tagName,id:x.id,text:(x.textContent||'').trim().slice(0,40),visible:!!x.getClientRects().length})))}));
   await p.screenshot({path:path.join(out,'editor.png'),fullPage:true});
   fs.writeFileSync(path.join(out,'initial-network.json'),JSON.stringify(records,null,2));
  }
  if(phase==='measure'){
   await f.evaluate(enabled=>{window.__profileReplay=enabled;},process.env.OFFICE_PROFILE_REPLAY==='1');
   await f.evaluate(()=>{
    window.__profileUploads=[];window.__profileBodies=[];
    const open=XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open=function(method,url,...args){
     this.__profileUpload=method.toUpperCase()==='POST'&&/upload/i.test(String(url));
     if(this.__profileUpload)this.addEventListener('load',()=>{
      try{window.__profileUploads.push(JSON.parse(this.responseText));}catch{}
     });
     return open.call(this,method,url,...args);
    };
    if(window.__profileReplay){
     const send=XMLHttpRequest.prototype.send;
     XMLHttpRequest.prototype.send=function(body){
      if(this.__profileUpload){
       const response=new Response(body),contentType=body instanceof FormData?response.headers.get('content-type'):null;
       window.__profileBodies.push(response.arrayBuffer().then(buffer=>{
        const bytes=new Uint8Array(buffer);let binary='';
        for(let offset=0;offset<bytes.length;offset+=32768)binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
        return {body:btoa(binary),contentType};
       }));
      }
      return send.call(this,body);
     };
    }
   });
   const cdp=await ctx.newCDPSession(f).catch(()=>ctx.newCDPSession(p)),network=[],active=new Map(),samples=[];
   await cdp.send('Network.enable',{maxTotalBufferSize:64*1024*1024,maxResourceBufferSize:16*1024*1024});
   cdp.on('Network.requestWillBeSent',e=>active.set(e.requestId,{method:e.request.method,path:clean(e.request.url),start:e.timestamp,type:e.type}));
   cdp.on('Network.responseReceived',e=>{const r=active.get(e.requestId);if(r){r.status=e.response.status;r.details=e.response.timing;r.type=e.type;r.protocol=e.response.protocol;r.cache=!!e.response.fromDiskCache||!!e.response.fromServiceWorker;}});
   cdp.on('Network.loadingFinished',e=>{const r=active.get(e.requestId);if(!r)return;const t=r.details||{};network.push({method:r.method,path:r.path,type:r.type,status:r.status,protocol:r.protocol,cache:r.cache,totalMs:(e.timestamp-r.start)*1000,uploadMs:t.sendEnd>=0?t.sendEnd-t.sendStart:null,waitMs:t.receiveHeadersStart>=0?t.receiveHeadersStart-t.sendEnd:null,downloadMs:t.receiveHeadersEnd>=0?(e.timestamp-t.requestTime)*1000-t.receiveHeadersEnd:null,encodedBytes:e.encodedDataLength});});
   const sizes=(process.env.OFFICE_PROFILE_SIZES||'small,large,small,large').split(',');if(sizes.some(s=>!['small','large','large-optimized'].includes(s)))throw Error('Invalid fixture size');
   for(const size of sizes){
    await f.locator('#tlbtn-insertimage-0 button').click();
    const choice=p.waitForEvent('filechooser',{timeout:10000});
    await f.locator('#tlbtn-insertimage-0').getByText('来自文件的图片',{exact:true}).click();
    const picker=await choice,begin=Date.now(),index=network.length;
    const posted=p.waitForResponse(r=>r.request().method()==='POST'&&/upload/i.test(new URL(r.url()).pathname),{timeout:90000});
    const mediaResponses=[];
    const collectMedia=r=>{if(/\/media\//.test(new URL(r.url()).pathname))mediaResponses.push(r);};
    p.on('response',collectMedia);
    const fixture=path.join(out,size+(size.endsWith('optimized')?'.webp':'.png'));
    await picker.setFiles(fixture);
    const upload=await posted;await upload.finished();const postDoneMs=Date.now()-begin;
    console.log(JSON.stringify({stage:'upload-complete',size,status:upload.status(),postDoneMs}));
    // Capture the native XHR response before Chromium discards its inspector copy.
    const payload=await f.evaluate(()=>window.__profileUploads.shift())||await upload.json();
    const urls=[];const visit=value=>{if(typeof value==='string'&&/\/media\//.test(value)){try{urls.push(new URL(value,upload.url()).pathname);}catch{}}else if(value&&typeof value==='object')Object.values(value).forEach(visit);};visit(payload);
    if(!urls.length)throw Error('Upload response has no media URL; do not substitute unrelated image requests');
    const exact=r=>urls.includes(new URL(r.url()).pathname);
    let img=mediaResponses.find(exact);
    if(!img)img=await p.waitForResponse(exact,{timeout:90000});
    await img.finished();const imageDoneMs=Date.now()-begin;
    p.off('response',collectMedia);
    await f.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await p.screenshot({path:path.join(out,'insert-'+samples.length+'-'+size+'.png'),fullPage:true});
    const sample={size,bytes:fs.statSync(fixture).size,postDoneMs,imageDoneMs,exactMediaMatch:true,uploadStatus:upload.status(),imageStatus:img.status(),network:network.slice(index).filter(r=>r.path.includes('/office-engine/'))};
    samples.push(sample);console.log(JSON.stringify(sample));
    if(process.env.OFFICE_PROFILE_REPLAY==='1'){
     const request=upload.request(),url=new URL(upload.url()),headers=await request.allHeaders();
     const body=await f.evaluate(()=>window.__profileBodies.shift());
     if(!body)throw Error('Synthetic XHR body not captured');
     if(body.contentType)headers['content-type']=body.contentType;
     const packet={path:url.pathname.replace(/^\/office-engine/,'')+url.search,body:body.body,headers};
     const {spawnSync}=require('node:child_process');
     const probe=spawnSync('python',['scripts/probe-office-upload-layers.py'],{input:JSON.stringify(packet),encoding:'utf8',timeout:180000,maxBuffer:2*1024*1024});
     if(probe.status!==0){let kind=probe.error?.code||'unknown';try{kind=JSON.parse(probe.stderr.trim()).error||kind;}catch{}throw Error('Layer replay failed: '+kind);}
     sample.layerReplay=JSON.parse(probe.stdout);console.log(JSON.stringify({layerReplay:sample.layerReplay}));
    }
    fs.writeFileSync(path.join(out,(process.env.OFFICE_PROFILE_REPLAY==='1'?'measurements-layers-':'measurements-exact-')+(http1?'http1':'default')+'.json'),JSON.stringify({at:new Date().toISOString(),browser:http1?'Edge headless HTTP/1.1 forced':'Edge headless default negotiation',document:doc.id,samples},null,2));
    await p.keyboard.press('Escape');
   }
   if(process.env.OFFICE_PROFILE_VERIFY_SAVE==='1'){
    await p.close();
    let state;
    for(let attempt=0;attempt<45;attempt++){
     const r=await ctx.request.get(c.NEXT_PUBLIC_API_URL+'/office/'+doc.id+'/state',{headers});
     if(!r.ok())throw Error('Saved state status '+r.status());
     state=await r.json();if(state.phase==='CLOSED')break;
     await new Promise(resolve=>setTimeout(resolve,2000));
    }
    if(state.phase!=='CLOSED')throw Error('Final save not confirmed: '+state.phase);
    const download=await ctx.request.get(c.NEXT_PUBLIC_API_URL+'/office/'+doc.id+'/download',{headers});
    if(!download.ok())throw Error('Saved download status '+download.status());
    const {createRequire}=require('node:module'),apiRequire=createRequire(path.resolve('apps/api/package.json'));
    const JSZip=createRequire(apiRequire.resolve('mammoth'))('jszip'),zip=await JSZip.loadAsync(await download.body());
    const media=Object.keys(zip.files).filter(name=>/^ppt\/media\//.test(name)&&!zip.files[name].dir),dimensions=[];
    const probe=await ctx.newPage();await probe.goto('about:blank');
    for(const name of media){const bytes=await zip.file(name).async('base64');dimensions.push(await probe.evaluate(async base64=>{const b=await createImageBitmap(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))]));const dimensions={width:b.width,height:b.height};b.close();return dimensions;},bytes));}
    await probe.close();
    if(!dimensions.some(d=>d.width===1280&&d.height===720))throw Error('Optimized image absent from saved PPT');
    const reopened=await ctx.newPage();await reopened.goto(c.WEB_URL+'/office/'+doc.id,{waitUntil:'domcontentloaded',timeout:60000});
    await reopened.locator('[data-office-ready="true"]').waitFor({timeout:180000});
    const proof={revision:state.revision,phase:state.phase,mediaCount:media.length,dimensions,reopened:true};
    fs.writeFileSync(path.join(out,'saved-image-proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
   }
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message.replace(/https?:\/\/\S+/g,'[url omitted]'));process.exitCode=1;});
