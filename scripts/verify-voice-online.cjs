// Synthetic formal-site probes. No real email, model invocation or speech-provider calls.
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module'),assert=require('node:assert/strict');
const config=JSON.parse(fs.readFileSync('.test-runs/deploy/online-config.json','utf8'));
if(new URL(config.NEXT_PUBLIC_API_URL).hostname!=='collabspace-api.purelamp.uk'||config.DATABASE_ADMIN_URL)throw Error('Invalid online acceptance target');
const base=config.NEXT_PUBLIC_API_URL;
async function main(){
 const context=await require('@playwright/test').request.newContext({timeout:25000,...(process.env.COLLAB_ACCEPTANCE_PROXY?{proxy:{server:process.env.COLLAB_ACCEPTANCE_PROXY}}:{})});
 // Use the same transport as browser acceptance, with an optional explicit system proxy.
 const fetch=async(url,options={})=>{
  const opts={method:options.method||'GET',headers:options.headers};
  if(options.body instanceof FormData){opts.multipart={};for(const [key,value] of options.body.entries())opts.multipart[key]=typeof value==='string'?value:{name:value.name,mimeType:value.type||'application/octet-stream',buffer:Buffer.from(await value.arrayBuffer())};}
  else if(options.body!==undefined)opts.data=options.body;
  const response=await context.fetch(url,opts);return {ok:response.ok(),status:response.status(),json:()=>response.json()};
 };
 try{
 const login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:config.TEST_OWNER_EMAIL,password:config.TEST_PASSWORD}),signal:AbortSignal.timeout(20000)});assert.ok(login.ok,'Login failed');
 const token=(await login.json()).accessToken,headers={Authorization:'Bearer '+token,'x-organization-id':config.TEST_ORG};
 const status=await fetch(base+'/voice/status',{headers,signal:AbortSignal.timeout(20000)});assert.equal(status.status,200);const capabilities=await status.json();assert.equal(capabilities.configured,false);assert.equal(capabilities.realistic.configured,false);
 const profile=await fetch(base+'/voice/persona',{headers,signal:AbortSignal.timeout(20000)});assert.equal(profile.status,200);assert.equal((await profile.json()).identity,'human');
 const disabled=await fetch(base+'/voice/jobs',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),projectId:config.TEST_PROJECT,kind:'TTS',locale:'zh-CN',text:'Synthetic disabled-provider check'}),signal:AbortSignal.timeout(20000)});assert.equal(disabled.status,503);
 const denied=await fetch(base+'/voice/persona',{headers:{...headers,'x-organization-id':'voice-unrelated-test-org'},signal:AbortSignal.timeout(20000)});assert.equal(denied.status,403);
 const apiRequire=createRequire(path.resolve('apps/api/package.json')),JSZip=createRequire(apiRequire.resolve('mammoth'))('jszip'),zip=new JSZip();
 const source='Synthetic voice release check. Alice owns delivery Friday. No real message is sent. '.repeat(3);
 zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
 zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'+source+'</w:t></w:r></w:p></w:body></w:document>');
 const bytes=await zip.generateAsync({type:'nodebuffer'}),form=new FormData();form.append('projectId',config.TEST_PROJECT);form.append('file',new Blob([bytes]),'synthetic-voice-release.docx');
 const extraction=await fetch(base+'/assistant/extract',{method:'POST',headers,body:form,signal:AbortSignal.timeout(25000)});assert.equal(extraction.status,201,'Existing DOCX parser online regression');assert.match((await extraction.json()).text,/Alice owns delivery Friday/);
 const result={at:new Date().toISOString(),api:base,status:'PASSED',checks:['authenticated voice status','human persona read','unconfigured TTS refuses 503 without paid call','foreign organization rejected 403','existing Linux DOCX parser synthetic round trip'],cloudSpeechConfigured:false,realisticConfigured:false};
 fs.writeFileSync('evidence/collaboration/voice-online-api.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await context.dispose();}
}
main().catch(e=>{console.error(JSON.stringify({error:e.name,message:e instanceof assert.AssertionError?e.message:'Online transport request failed',code:e.cause?.code}));process.exitCode=1;});
