// Read-only credential check. Never uploads art, starts tasks, or changes config.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dotenv=require('../apps/api/node_modules/dotenv');
async function main(){
 const env=dotenv.parse(fs.readFileSync(path.join(root,'.test-runs/private/third-party.env')));
 const provider=env.AVATAR_3D_PROVIDER;
 if(provider!=='tripo3d')throw Error('SELECT_TRIPO_FIRST');
 const key=env.TRIPO_API_KEY?.trim();
 if(!key)throw Error('TRIPO_KEY_MISSING');
 if(key.startsWith('tcli_'))throw Error('CLIENT_ID_IS_NOT_API_KEY');
 const legacy=process.argv.includes('--legacy-v2');
 const endpoint=legacy?'https://api.tripo3d.ai/v2/openapi/user/balance':'https://openapi.tripo3d.ai/v3/account/balance';
 const response=await fetch(endpoint,{
  method:'GET',headers:{Authorization:'Bearer '+key,Accept:'application/json'},
  signal:AbortSignal.timeout(15000),redirect:'error'
 });
 const body=await response.text();if(body.length>65536)throw Error('UNEXPECTED_RESPONSE_SIZE');
 let data;try{data=JSON.parse(body);}catch{throw Error('UNEXPECTED_RESPONSE_FORMAT');}
 const balance=data?.data?.balance;
 const result={provider,apiVersion:legacy?'v2':'v3',operation:'read-only account balance',http:response.status,
  providerCode:typeof data.code==='number'?data.code:null,
  authenticated:response.ok&&data.code===0&&typeof balance==='number'&&Number.isFinite(balance),
  creditsAvailable:typeof balance==='number'&&Number.isFinite(balance)?balance>0:null,
  generationEnabled:env.AVATAR_3D_ENABLED==='true',uploadApproved:env.AVATAR_3D_UPLOAD_APPROVED==='true',
  budgetConfigured:Boolean(env.AVATAR_3D_TRIAL_BUDGET_USD?.trim()),
  uploads:0,generationRequests:0};
 console.log(JSON.stringify(result,null,2));if(!result.authenticated)process.exitCode=1;
}
main().catch(error=>{
 const known=['SELECT_TRIPO_FIRST','TRIPO_KEY_MISSING','CLIENT_ID_IS_NOT_API_KEY','UNEXPECTED_RESPONSE_SIZE','UNEXPECTED_RESPONSE_FORMAT'];
 const networkCodes=['ECONNRESET','ENOTFOUND','ETIMEDOUT','ECONNREFUSED','UND_ERR_CONNECT_TIMEOUT'];
 console.log(JSON.stringify({result:'BLOCKED',reason:known.includes(error.message)?error.message:'PROVIDER_CHECK_FAILED',errorType:error.name,networkCode:networkCodes.includes(error.cause?.code)?error.cause.code:null,uploads:0,generationRequests:0}));process.exitCode=1;
});
