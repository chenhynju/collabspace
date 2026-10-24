const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function load(file){const filename=path.join(__dirname,'../src/components/documents',file),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return m.exports;}
const {DocumentFormula,formulaHTML}=load('DocumentFormula.tsx');
const {getSchema}=require('@tiptap/core'),StarterKit=require('@tiptap/starter-kit').default,Y=require('yjs');
const {prosemirrorJSONToYDoc,yXmlFragmentToProsemirrorJSON}=require('y-prosemirror');
const schema=getSchema([StarterKit,DocumentFormula]);
test('formula renders matrices, calculus and non trusted input safely; rejects malformed/oversized source',()=>{
 for(const latex of ['\\frac{a}{b}','\\int_0^1 x^2 dx','\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}'])assert.match(formulaHTML(latex),/katex/);
 for(const latex of ['', 'x'.repeat(8001), '\\frac{'])assert.throws(()=>formulaHTML(latex));
 assert.doesNotMatch(formulaHTML('\\href{javascript:alert(1)}{click}'),/<a\b|href=/);
});
test('formula source survives Yjs peer sync, edits and fresh history lineage',()=>{
 const latex='\\sum_{i=1}^{n} x_i',json={type:'doc',content:[{type:'documentFormula',attrs:{latex}}]};
 const a=prosemirrorJSONToYDoc(schema,json,"default"),b=new Y.Doc();Y.applyUpdate(b,Y.encodeStateAsUpdate(a));
 assert.equal(yXmlFragmentToProsemirrorJSON(b.getXmlFragment('default')).content[0].attrs.latex,latex);
 b.getXmlFragment('default').get(0).setAttribute('latex','x^2');Y.applyUpdate(a,Y.encodeStateAsUpdate(b));
 const snapshot=yXmlFragmentToProsemirrorJSON(a.getXmlFragment('default')),copy=prosemirrorJSONToYDoc(schema,snapshot,"default");
 assert.equal(snapshot.content[0].attrs.latex,'x^2');assert.notEqual(copy.clientID,a.clientID);
 assert.equal(yXmlFragmentToProsemirrorJSON(copy.getXmlFragment('default')).content[0].attrs.latex,'x^2');
 for(const d of [a,b,copy])d.destroy();
});
test('all reused palette templates render',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/components/documents/FormulaPalette.tsx'),'utf8');
 const out={};const code=ts.transpileModule(source.replace('const CATEGORIES:', 'export const CATEGORIES:'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(code,__filename);
 let count=0;for(const category of m.exports.CATEGORIES)for(const item of category.items){formulaHTML(item.latex);count++;}assert.ok(count>40);
});
