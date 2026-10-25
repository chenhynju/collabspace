const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/components/personas/persona-events.ts'),'utf8');
const moduleFixture={exports:{}};new Function('exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(moduleFixture.exports);
const {applyPersonaEvent}=moduleFixture.exports;
test('runtime events ignore reordered/duplicate events and cannot resurrect terminal runs',()=>{
 const base={version:1,runId:'run-1',source:'skill',authority:'runtime',sequence:1,state:'executing'};
 assert.equal(applyPersonaEvent(base,{...base,sequence:0,state:'thinking'}),base);
 assert.throws(()=>applyPersonaEvent(base,{...base,sequence:2,state:'completed'}));
 const done=applyPersonaEvent(base,{...base,sequence:3,state:'completed',resultRef:'result:1'});
 assert.equal(applyPersonaEvent(done,{...base,sequence:4,state:'executing'}),done);
 assert.throws(()=>applyPersonaEvent(null,{...base,authority:'ui'}));
 assert.equal(applyPersonaEvent(done,{...base,runId:'run-2',sequence:0}).runId,'run-2');
});
