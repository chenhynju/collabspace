const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {AssistantRuntimeService}=require('../dist/modules/assistant/assistant-runtime.service');
const source='Synthetic project notes: Alice delivers Friday; approvals remain pending. '.repeat(3);
function fixture(){let allowed=true,calls=0,release,signal;const logs=[];
 const tx={membership:{findFirst:async()=>allowed?{id:'member'}:null},project:{findFirst:async()=>({name:'Synthetic project'})},task:{count:async()=>3}};
 const db={withOrg:async(org,fn)=>fn(tx)},policy={assert:async()=>{if(!allowed)throw Object.assign(Error('denied'),{status:404});}},ai={generate:async(_scope,_source,_mode,_budget,s)=>{calls++;signal=s;return new Promise(resolve=>release=resolve);}},audit={record:async(_tx,row)=>logs.push(row)};
 const runtime=new AssistantRuntimeService(db,policy,ai,audit),body={requestId:randomUUID(),projectId:'project',mode:'summary',text:source};
 return {runtime,body,logs,get calls(){return calls;},get signal(){return signal;},deny:()=>allowed=false,finish:result=>release(result||{text:'Actual fixture result',cached:false}),ready:async()=>{for(let i=0;i<30&&!release;i++)await new Promise(r=>setTimeout(r,2));assert.equal(typeof release,'function');}};
}
async function ended(f,id=f.body.requestId){for(let i=0;i<40;i++){const r=await f.runtime.get('org','actor',id);if(['completed','failed','cancelled'].includes(r.state))return r;await new Promise(r=>setTimeout(r,2));}throw Error('run did not finish');}
test('bounded runtime: real tool result receipt, actor isolation, duplicate replay and input conflict',async()=>{
 const f=fixture(),r=await f.runtime.start('org','actor',f.body,'trace');assert.equal(r.durable,false);await f.ready();
 await f.runtime.start('org','actor',f.body,'replay');assert.equal(f.calls,1);
 await assert.rejects(f.runtime.start('org','actor',{...f.body,text:source+'changed'},'conflict'),e=>e.getStatus()===409);
 await assert.rejects(f.runtime.get('org','other',r.id),e=>e.getStatus()===404);await assert.rejects(f.runtime.get('other','actor',r.id),e=>e.getStatus()===404);
 f.finish();const done=await ended(f);assert.equal(done.state,'completed');assert.equal(done.event.authority,'runtime');assert.equal(done.event.resultRef,`assistant-run:${r.id}`);assert.deepEqual(done.projectFacts,{name:'Synthetic project',taskCount:3});assert.equal(done.result.text,'Actual fixture result');
 assert.ok(!JSON.stringify(f.logs).includes(source));
});
test('authorization and skill allowlist reject before model calls; one active workflow per actor',async()=>{
 const f=fixture();await assert.rejects(f.runtime.start('org','actor',{...f.body,mode:'send-email'},'bad'),e=>e.getStatus()===400);assert.equal(f.calls,0);
 await f.runtime.start('org','actor',f.body,'start');await f.ready();await assert.rejects(f.runtime.start('org','actor',{...f.body,requestId:randomUUID()},'parallel'),e=>e.getStatus()===429);f.finish();await ended(f);
 const denied=fixture();denied.deny();await assert.rejects(denied.runtime.start('org','actor',denied.body,'denied'));assert.equal(denied.calls,0);
});
test('cancel signals provider and ignores late result; same request cannot restart or pretend completion',async()=>{
 const f=fixture();await f.runtime.start('org','actor',f.body,'start');await f.ready();const stop=await f.runtime.cancel('org','actor',f.body.requestId);assert.equal(stop.state,'cancelled');assert.equal(f.signal.aborted,true);f.finish();await new Promise(r=>setTimeout(r,10));
 const r=await ended(f);assert.equal(r.state,'cancelled');assert.equal(r.result,undefined);assert.equal(r.event.resultRef,undefined);assert.equal((await f.runtime.start('org','actor',f.body,'replay')).state,'cancelled');assert.equal(f.calls,1);
});
test('revoked permission and incomplete model output cannot produce completed receipt',async()=>{
 const f=fixture();await f.runtime.start('org','actor',f.body,'start');await f.ready();f.deny();f.finish();await new Promise(r=>setTimeout(r,10));
 const internal=f.runtime.runs.get(f.body.requestId);assert.equal(internal.state,'failed');assert.equal(internal.result,undefined);await assert.rejects(f.runtime.get('org','actor',f.body.requestId));
 const partial=fixture();await partial.runtime.start('org','actor',partial.body,'start');await partial.ready();partial.finish({text:'Partial',incomplete:true});assert.equal((await ended(partial)).state,'failed');
});
test('expired receipts are inaccessible and a new service instance does not invent recovery',async()=>{
 const f=fixture();await f.runtime.start('org','actor',f.body,'start');await f.ready();f.finish();await ended(f);f.runtime.runs.get(f.body.requestId).expires=Date.now()-1;await assert.rejects(f.runtime.get('org','actor',f.body.requestId),e=>e.getStatus()===404);
 const newInstance=fixture();await assert.rejects(newInstance.runtime.get('org','actor',f.body.requestId),e=>e.getStatus()===404);
});
