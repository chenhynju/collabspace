const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');

function fixture(){
 let values=[],index=0,effect,cleanup,deps;
 const sockets=[];
 const react={useState(initial){const i=index++;if(!(i in values))values[i]=initial;return [values[i],v=>{values[i]=typeof v==='function'?v(values[i]):v;}];},useRef(v){const i=index++;return values[i]??(values[i]={current:v});},useEffect(fn,next){if(!deps||next.some((x,i)=>x!==deps[i])){effect=fn;deps=next;}}};
 const io=()=>{const handlers={},sent=[];const socket={connected:true,on:(name,fn)=>{handlers[name]=fn;},emit:(...args)=>sent.push(args),removeAllListeners(){},disconnect(){socket.connected=false;},handlers,sent};sockets.push(socket);return socket;};
 const exports={};const source=fs.readFileSync(path.join(__dirname,'../src/lib/use-realtime.ts'),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,process:{env:{}},localStorage:{getItem:()=> 'synthetic'},require:id=>id==='react'?react:id==='socket.io-client'?{io}:require(id)});
 return {sockets,render(org,project,task,meeting){index=0;return exports.useProjectRealtime(org,project,task,meeting);},commit(){if(effect){cleanup?.();cleanup=effect();effect=undefined;}},close(){cleanup?.();}};
}

test('project presence and connected state clear immediately on tenant switch, disconnect and denied join',async()=>{
 const f=fixture();let tasks=0,meetings=0;
 const render=(org='A')=>f.render(org,'project',()=>tasks++,()=>meetings++);
 render();f.commit();const a=f.sockets[0];a.handlers.connect();
 assert.equal(render().connected,false);
 a.sent.find(x=>x[0]==='project:open')[2]({ok:true});
 await Promise.resolve();await Promise.resolve();
 assert.equal(tasks,1);assert.equal(meetings,1);
 a.handlers['presence:update']({users:[{userId:'private-A'}]});
 assert.equal(render().presence.length,1);
 assert.equal(render('B').presence.length,0);assert.equal(render('B').connected,false);
 f.commit();const b=f.sockets[1];b.handlers.connect();b.sent.find(x=>x[0]==='project:open')[2]({ok:false});
 assert.equal(render('B').connected,false);
 // An acknowledgement already in flight from the old room cannot restore it.
 a.connected=true;a.sent.find(x=>x[0]==='project:open')[2]({ok:true});
 assert.equal(render('B').presence.length,0);assert.equal(render('B').connected,false);
 b.sent.find(x=>x[0]==='project:open')[2]({ok:true});
 b.handlers['presence:update']({users:[{userId:'B'}]});b.handlers.disconnect();
 assert.equal(render('B').presence.length,0);assert.equal(render('B').connected,false);
 f.close();
});
