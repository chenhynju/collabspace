const {test}=require('node:test'),assert=require('node:assert/strict');
const {ConfigService}=require('@nestjs/config');
const {OAuthService}=require('../dist/modules/auth/oauth.service');
test('OAuth real Redis: browser binding, provider binding, PKCE, verified email, single-use state and handoff',{skip:!process.env.OAUTH_TEST_REDIS_URL},async()=>{
 const config=new ConfigService({REDIS_URL:process.env.OAUTH_TEST_REDIS_URL,GOOGLE_CLIENT_ID:'test-google',GOOGLE_CLIENT_SECRET:'synthetic',GOOGLE_CALLBACK_URL:'https://example.test/google',GITHUB_CLIENT_ID:'test-github',GITHUB_CLIENT_SECRET:'synthetic',GITHUB_CALLBACK_URL:'https://example.test/github'});
 const service=new OAuthService(config),originalFetch=global.fetch;const requests=[];let verified=true;
 global.fetch=async(url,init)=>{requests.push({url,init});return {ok:true,json:async()=>url.includes('/token')||url.includes('/access_token')?{access_token:'synthetic-provider-token'}:url.endsWith('/emails')?[{email:'Verified@example.test',primary:true,verified}]:url.includes('googleapis')?{sub:'google-user',email:'Verified@example.test',email_verified:verified,name:'Synthetic'}:{id:123,name:'Synthetic'}};};
 try{
  for(const provider of ['google','github']){
   const flow=await service.getAuthorizeUrl(provider),url=new URL(flow.url),state=url.searchParams.get('state');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
   await assert.rejects(service.exchangeCode(provider,'code',state,'x'.repeat(43)),/INVALID_STATE/);
   await assert.rejects(service.exchangeCode(provider==='google'?'github':'google','code',state,flow.binding),/INVALID_STATE/);
   const profile=await service.exchangeCode(provider,'code',state,flow.binding);assert.equal(profile.email,'verified@example.test');assert.ok(!('accessToken'in profile));
   const request=requests.findLast(r=>r.init.method==='POST'),verifier=new URLSearchParams(request.init.body).get('code_verifier');assert.equal(require('node:crypto').createHash('sha256').update(verifier).digest('base64url'),url.searchParams.get('code_challenge'));
   await assert.rejects(service.exchangeCode(provider,'code',state,flow.binding),/INVALID_STATE/);
   const handoff=await service.handoff({accessToken:'synthetic-app-token'},flow.binding);await assert.rejects(service.redeem(handoff,'x'.repeat(43)),/INVALID_STATE/);
   const results=await Promise.allSettled([service.redeem(handoff,flow.binding),service.redeem(handoff,flow.binding)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
   verified=false;const denied=await service.getAuthorizeUrl(provider);await assert.rejects(service.exchangeCode(provider,'code',new URL(denied.url).searchParams.get('state'),denied.binding),/OAUTH_EMAIL_NOT_VERIFIED/);verified=true;
  }
  await assert.rejects(service.getAuthorizeUrl('unknown'),/INVALID_PROVIDER/);
 }finally{global.fetch=originalFetch;service.onModuleDestroy();}
});
