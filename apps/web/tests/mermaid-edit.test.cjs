const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const exports_={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/lib/mermaid-edit.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exports_});
const {addFlowNode,connectFlowNodes,flowNodes}=exports_;
test('mindmap drag reparents the complete subtree and refuses cycles/root moves',()=>{
 const s='mindmap\n  root((Team))\n    Documents\n      Comments\n    People';
 const nodes=exports_.mindNodes(s);assert.equal(nodes.length,4);
 const moved=exports_.moveMindBranch(s,'L2','L4');assert.match(moved,/People\n      Documents\n        Comments/);
 assert.throws(()=>exports_.moveMindBranch(s,'L2','L3'));assert.throws(()=>exports_.moveMindBranch(s,'L1','L4'));
 const added=exports_.addMindNode(s,'Versions','L2');assert.match(added,/Comments\n      Versions\n    People/);
 assert.equal(exports_.mindNodes('mindmap\n  root((Team))\n    ::icon(fa fa-book)').length,0);
});
test('drag append preserves comments, subgraphs and styling; connections validate actual defined nodes',()=>{
 const original='flowchart LR\n%% keep\nsubgraph Delivery\n A[需求] --> B{评审}\nend\nstyle A fill:#fff';
 const added=addFlowNode(original,'交付','process','New');assert.ok(added.startsWith(original));
 const connected=connectFlowNodes(added,'B','New');assert.ok(connected.endsWith('B --> New'));assert.equal(connectFlowNodes(connected,'B','New'),connected);
 assert.equal(flowNodes(connected).length,3);assert.throws(()=>connectFlowNodes(connected,'Missing','New'));assert.throws(()=>connectFlowNodes(connected,'B','B'));
});
test('unsupported diagrams and unsafe labels are preserved by refusing graphical mutation',()=>{
 assert.throws(()=>addFlowNode('sequenceDiagram\n A->>B: hi','Node','process','New'));
 for(const s of ['<script>','A] --> Evil','A\nB','"click"'])assert.throws(()=>addFlowNode('',s,'process','New'));
 assert.throws(()=>addFlowNode('flowchart LR\n New[A]','Node','process','New'));
});
