const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
test('Office file actions real HTTP: authentication, rename conflict, copy replay and viewer refusal',{skip:!process.env.OFFICE_PRODUCT_HTTP_CONFIG},async()=>{
 const c=JSON.parse(fs.readFileSync(path.resolve(process.env.OFFICE_PRODUCT_HTTP_CONFIG),'utf8'));
 assert.equal(new URL(c.NEXT_PUBLIC_API_URL).port,'43321');assert.equal(new URL(c.DATABASE_URL).port,'5571');
 const {OfficeStore}=require('@collabspace/store/office.cjs'),s=new OfficeStore(c.COLLAB_TEST_DATABASE_URL,{OFFICE_PUBLIC_URL:'http://localhost:3390',OFFICE_INTERNAL_URL:'http://localhost:3390',OFFICE_JWT_SECRET:'synthetic',OFFICE_CAPABILITY_SECRET:'synthetic',UPLOAD_ROOT:c.UPLOAD_ROOT});
 const login=async(email)=>{const r=await fetch(c.NEXT_PUBLIC_API_URL+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'Passw0rd!'})});assert.equal(r.status,201);return (await r.json()).accessToken};
 const owner=await login('owner@acme.dev'),peer=await login('member@acme.dev');
 const post=(id,action,token,body,org=c.TEST_ORG)=>fetch(c.NEXT_PUBLIC_API_URL+'/office/'+id+'/'+action,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),'x-organization-id':org},body:JSON.stringify(body)});
 try{
  for(const extension of ['docx','xlsx','pptx']){
   const d=await s.createBlank({org:c.TEST_ORG,user:c.TEST_OWNER},c.TEST_PROJECT,{title:'HTTP '+randomUUID(),extension,requestId:randomUUID()}),state=await s.heartbeat({org:c.TEST_ORG,user:c.TEST_OWNER},d.id);
   await s.grant({org:c.TEST_ORG,user:c.TEST_OWNER},d.id,{userId:c.TEST_MEMBER,role:'VIEWER'});
   const rename={title:'HTTP renamed',expectedTitle:state.title};assert.equal((await post(d.id,'name',null,rename)).status,401);
   assert.equal((await post(d.id,'name',peer,rename)).status,403);
   assert.equal((await post(d.id,'name',owner,rename,c.TEST_OTHER_ORG)).status,403);
   const named=await post(d.id,'name',owner,rename);assert.equal(named.status,201);assert.equal((await named.json()).title,'HTTP renamed.'+extension);
   assert.equal((await post(d.id,'name',owner,rename)).status,409);
   const copy={title:'HTTP private',versionId:state.versions[0].id,requestId:randomUUID()};
   assert.equal((await post(d.id,'copy',peer,copy)).status,403);
   const first=await post(d.id,'copy',owner,copy),second=await post(d.id,'copy',owner,copy);assert.equal(first.status,201);assert.equal(second.status,201);assert.equal((await first.json()).id,(await second.json()).id);
   assert.equal((await post(d.id,'export/pdf',null,{versionId:copy.versionId})).status,401);
   assert.equal((await post(d.id,'export/pdf',owner,{versionId:'bad'})).status,400);
  }
 }finally{await s.close()}
});
