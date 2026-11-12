// Produces a local review document only. There is intentionally no submit mode.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),env=require('../apps/api/node_modules/dotenv').parse(fs.readFileSync(path.join(root,'.test-runs/private/third-party.env')));
assert.equal(process.argv.length,2,'This planner accepts no execution/upload arguments');
assert.equal(env.AVATAR_3D_PROVIDER,'tripo3d','Select Tripo before preparing this plan');
const budget=Number(env.AVATAR_3D_TRIAL_BUDGET_USD);assert.ok(Number.isFinite(budget)&&budget>0,'A positive trial budget is required');
const manifest=require('../docs/collaboration/assets/avatar-20-production-manifest.json');
const names=env.AVATAR_3D_PILOT_NAMES.split(',').map(s=>s.trim());assert.deepEqual(names,['知夏','知行','明悦']);
const pilots=names.map(name=>{
 const records=manifest.models.filter(m=>m.name===name);assert.equal(records.length,1);const m=records[0];
 assert.match(m.source.poster,/^\/personas\/[a-z0-9-]+\.png$/);
 const file=path.join(root,'apps/web/public',m.source.poster),bytes=fs.readFileSync(file);
 assert.ok(bytes.length<=20*1024*1024);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.ok(bytes.readUInt32BE(16)>=256&&bytes.readUInt32BE(20)>=256);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),m.source.sha256,'Portrait changed; review before upload');
 return {presetId:m.presetId,name,source:{poster:m.source.poster,sha256:m.source.sha256,sizeBytes:bytes.length},
  generation:{path:'/v3/generation/image-to-model',input:null,model:'v3.1-20260211',texture:true,pbr:true,texture_quality:'standard',geometry_quality:'standard',face_limit:30000},
  rigCheck:{path:'/v3/animations/rig-check',input:null},
  bodyRig:{path:'/v3/animations/rig',input:null,model:'v3.0-20260909',rig_type:'biped',spec:'vrm',out_format:'glb'},
  estimatedBaseCredits:55,sourceUploaded:false,taskIds:[],finalModelReady:false};
});
const credits=pilots.reduce((sum,p)=>sum+p.estimatedBaseCredits,0),estimatedUSD=credits/100;
assert.ok(estimatedUSD<=budget,'Basic draft exceeds configured budget');
const plan={status:'DRAFT_REVIEW_ONLY',provider:'tripo3d',apiBase:'https://openapi.tripo3d.ai',budgetCapUSD:budget,
 pricing:{checkedOn:'2026-10-29',source:'https://developers.tripo3d.ai/en/pricing',usdPerCredit:.01,imageWithStandardTexture:30,bodyRig:25,rigCheck:0},
 estimatedFirstPassCredits:credits,estimatedFirstPassUSD:estimatedUSD,
 exclusions:['remakes','animation retarget','format conversion','face blendshapes','face customization','manual art work','tax or top-up charges'],
 uploadApproved:env.AVATAR_3D_UPLOAD_APPROVED==='true',generationEnabled:env.AVATAR_3D_ENABLED==='true',
 finalFormat:env.AVATAR_3D_TARGET_FORMAT||null,intermediateFormat:'glb',
 warnings:['VRM skeleton names do not prove a valid VRM container or facial expressions.','Estimate is not a fixed vendor quote; recheck pricing before any submission.','This script performs zero network operations and does not enforce a future runtime spending ledger.'],pilots};
const out=path.join(root,'.test-runs/avatar-3d/tripo-pilot-plan.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({status:plan.status,pilots:pilots.map(p=>p.name),budgetCapUSD:budget,estimatedFirstPassUSD:estimatedUSD,uploads:0,generationRequests:0,plan:'.test-runs/avatar-3d/tripo-pilot-plan.json'}));
