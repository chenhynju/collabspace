const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const exportsForTest={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/display-date.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsForTest});
test('history dates use yyyy-mm-dd and the product timezone across UTC midnight',()=>{
 assert.equal(exportsForTest.displayDate('2026-10-21T17:05:00Z'),'2026-10-22');
 assert.equal(exportsForTest.displayDate('2026-01-01T00:00:00Z'),'2026-01-01');
 assert.equal(exportsForTest.displayDate('invalid'),'—');assert.equal(exportsForTest.displayDate(null),'—');
});
test('snapshot timestamps distinguish seconds and use Shanghai across UTC midnight',()=>{
 assert.equal(exportsForTest.displayDateTime('2026-10-21T17:05:09Z'),'2026-10-22 01:05:09');
 assert.equal(exportsForTest.displayDateTime('invalid'),'—');
});
