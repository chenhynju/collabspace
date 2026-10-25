const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const exports_={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/lib/mermaid-edit.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exports_,require:(name)=>{if(name!=='./diagram-catalog')throw Error(name);const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/lib/diagram-catalog.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:out});return out;}});
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

test('modern shape definitions, labeled edges, layout and properties preserve surrounding source',()=>{
 const original='flowchart LR\n%% keep me\nsubgraph Team\n A[Request] --> B{Approve}\nend';
 const s=addFlowNode(original,'Storage','database','Db');assert.equal(flowNodes(s).find(n=>n.id==='Db').label,'Storage');
 const linked=connectFlowNodes(s,'B','Db','dashed','Yes');assert.ok(linked.endsWith('B -.->|Yes| Db'));assert.equal(connectFlowNodes(linked,'B','Db','dashed','Yes'),linked);
 const renamed=exports_.renameFlowNode(linked,'Db','Primary');assert.ok(renamed.startsWith(original));assert.match(renamed,/label: "Primary"/);assert.ok(renamed.endsWith('B -.->|Yes| Db'));
 const old=exports_.renameFlowNode(original,'A','New');assert.match(old,/A\["New"\] --> B/);assert.ok(old.includes('%% keep me'));
 assert.ok(exports_.flowDirection(renamed,'TB').startsWith('flowchart TB'));
 assert.match(exports_.colorFlowNode(renamed,'Db','teal'),/style Db fill:#ccfbf1/);
 assert.throws(()=>exports_.renameFlowNode(original+'\n A[Again]','A','No'));assert.throws(()=>connectFlowNodes(s,'B','Db','arrow','a|b'));assert.throws(()=>exports_.colorFlowNode(s,'Db','url(evil)'));
});

test('leading collaboration comments preserve graphical editing and direction changes',()=>{
 const s='%% Remote note\n  %% Another note\nflowchart TB\n A[One]';
 assert.equal(flowNodes(s).length,1);assert.equal(exports_.getFlowDirection(s),'TB');
 assert.ok(exports_.flowDirection(s,'LR').startsWith('%% Remote note\n  %% Another note\nflowchart LR'));
 assert.match(addFlowNode(s,'More','cloud','B'),/shape: cloud/);
});

test('deletion removes generated and template nodes without losing other definitions',()=>{
 let s=addFlowNode('flowchart LR\n A[Keep]','Delete','cloud','B');s=connectFlowNodes(s,'A','B','both','Link');s=exports_.colorFlowNode(s,'B','teal');
 const copy=exports_.duplicateFlowNode(s,'B','C');assert.match(copy,/C@\{ shape: cloud, label: "Delete 副本"/);
 const removed=exports_.deleteFlowNode(copy,'B');assert.ok(removed.includes('A[Keep]'));assert.ok(removed.includes('C@'));assert.ok(!removed.includes('B@'));assert.ok(!removed.includes('A <-->'));
 assert.ok(!exports_.deleteFlowNode(s+'\n class B external','B').includes('class B'));assert.ok(exports_.deleteFlowNode(s,'A').includes('B@'));assert.throws(()=>exports_.deleteFlowNode(s+'\n A & B --> C','B'));
});

test('partial chain deletion preserves surviving edges, quoted labels and unrelated comments',()=>{
 const source='flowchart LR\n%% keep B in this comment\n A[First] --> B{Middle} --> C[Last] --> D[End]\n X["B remains in label"] --> Y[Other]';
 const next=exports_.deleteFlowNodes(source,['B']);assert.ok(next.includes('A[First]'));assert.ok(next.includes('C[Last] --> D[End]'));assert.ok(next.includes('X["B remains in label"] --> Y[Other]'));assert.ok(next.includes('%% keep B'));assert.ok(!next.includes('B{'));
 const multi=exports_.deleteFlowNodes(source,['B','D']);assert.ok(multi.includes('C[Last]'));assert.ok(!multi.includes('D[End]'));assert.throws(()=>exports_.deleteFlowNode(source+'\n linkStyle 0 stroke:red','B'));
});

test('shared positions replace only their own annotation, validate limits and remain portable comments',()=>{
 const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/lib/mermaid-position.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:out});
 const source='flowchart LR\n A[Keep] --> B[Keep too]\n%% unrelated annotation';const once=out.positionNode(source,'A',400.4,300.6),twice=out.positionNode(once,'A',800,600);assert.ok(twice.startsWith(source));assert.equal(twice.split('collab-position A').length,2);assert.equal(out.nodePositions(twice).A.x,800);assert.equal(out.nodePositions(twice).A.y,600);assert.equal(out.removeNodePositions(twice,new Set(['A'])),source);for(const x of [-1,Infinity,9000])assert.throws(()=>out.positionNode(source,'A',x,100));assert.throws(()=>out.positionNode(source,'A;B',100,100));
});

test('layout refuses subgraphs, custom edges, self loops and parallel edges without source mutation',()=>{
 const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/lib/mermaid-position.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:out});
 for(const source of ['flowchart LR\n A[One] --> A','flowchart LR\n A[One] --> B[Two]\n A --> B','flowchart LR\n A e1@--> B','flowchart LR\nsubgraph Team\n A[One]\nend'])assert.throws(()=>out.positionNode(source,'A',200,300));assert.doesNotThrow(()=>out.positionNode('flowchart LR\n A[One] --> B[Two] --> C[Three]','A',200,300));
});

test('canvas connection styles preserve position annotations and unsafe labels never mutate the source',()=>{
 const source='flowchart LR\n A[Start]\n B[Finish]\n%% collab-position A 150 150\n%% collab-position B 450 300';
 for(const [kind,op] of Object.entries({arrow:'-->',line:'---',dashed:'-.->',bold:'==>',both:'<-->'})){
  const connected=connectFlowNodes(source,'A','B',kind,'Approved');assert.ok(connected.startsWith(source));assert.ok(connected.endsWith(`A ${op}|Approved| B`));assert.equal(connectFlowNodes(connected,'A','B',kind,'Approved'),connected);
 }
 for(const label of ['line\nbreak','bad|edge','<script>','"bad"'])assert.throws(()=>connectFlowNodes(source,'A','B','arrow',label));
 assert.equal(source.split('collab-position').length,3);
});
