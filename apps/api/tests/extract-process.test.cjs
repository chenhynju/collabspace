const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),cp=require('node:child_process');
const {AssistantController}=require('../dist/modules/assistant/assistant.controller');
test('isolated parser withholds source until ready, bounds startup/parse and reports retryable timeout',async t=>{
 const original=cp.execFile;let callback,child,writes=[];
 t.mock.timers.enable({apis:['setTimeout']});
 cp.execFile=(_exe,_args,options,cb)=>{assert.equal(options.timeout,30000);callback=cb;child=new EventEmitter();child.stderr=new EventEmitter();child.stdin=new EventEmitter();child.stdin.end=b=>writes.push(b);child.kill=()=>queueMicrotask(()=>callback(Object.assign(new Error('killed'),{killed:true}),''));return child;};
 const c=new AssistantController({withOrg:async(_,fn)=>fn({})},{assert:async()=>{}},{},{},{}),o={organizationId:'synthetic-org'},u={id:'synthetic-user'},f={originalname:'sample.txt',buffer:Buffer.from('Synthetic source only. '.repeat(10))};
 try{
  const pending=c.extract(o,u,'project',f);await new Promise(setImmediate);assert.equal(writes.length,0);t.mock.timers.tick(19999);assert.equal(writes.length,0);
  child.stderr.emit('data',Buffer.from('EXTRACT_RE'));child.stderr.emit('data',Buffer.from('ADY\n'));assert.equal(writes.length,1);assert.equal(writes[0],f.buffer);
  t.mock.timers.tick(9999);assert.equal(c.parsing,1);t.mock.timers.tick(1);await assert.rejects(pending,e=>e.getStatus()===503&&e.getResponse().retryable===true);assert.equal(c.parsing,0);
  writes=[];const startup=c.extract(o,u,'project',f);await new Promise(setImmediate);t.mock.timers.tick(20000);await assert.rejects(startup,e=>e.getStatus()===503);assert.equal(writes.length,0);assert.equal(c.parsing,0);
 }finally{cp.execFile=original;t.mock.timers.reset();}
});
