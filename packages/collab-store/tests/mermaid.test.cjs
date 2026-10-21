const { test } = require("node:test"), assert = require("node:assert/strict"), {randomUUID}=require("node:crypto");
const Y=require("yjs"), {Store,materialize,copyContent}=require("../index.cjs");
test("same-position source insertions converge without dropping either atomic insertion",()=>{
  const a=new Y.Doc();a.getText("mermaid").insert(0,"flowchart LR\n%% ");
  const b=materialize(Y.encodeStateAsUpdate(a)),at=a.getText("mermaid").length;
  a.getText("mermaid").insert(at,"LEFT");b.getText("mermaid").insert(at,"RIGHT");
  const ua=Y.encodeStateAsUpdate(a),ub=Y.encodeStateAsUpdate(b);Y.applyUpdate(a,ub);Y.applyUpdate(b,ua);
  assert.equal(a.getText("mermaid").toString(),b.getText("mermaid").toString());
  assert.match(a.getText("mermaid").toString(),/LEFT/);assert.match(a.getText("mermaid").toString(),/RIGHT/);
  a.destroy();b.destroy();
});
test("Mermaid source merges concurrent text, excludes remote undo and survives fresh history copy",()=>{
  const a=new Y.Doc(); a.getText("mermaid").insert(0,"flowchart LR\n  A[Start] --> B[End]");
  const b=materialize(Y.encodeStateAsUpdate(a)),origin={};
  const undo=new Y.UndoManager(a.getText("mermaid"),{trackedOrigins:new Set([origin])});
  a.transact(()=>a.getText("mermaid").insert(a.getText("mermaid").length,"\n  B --> C[Local]"),origin);
  b.getText("mermaid").insert(0,"%% Remote comment\n");
  const ua=Y.encodeStateAsUpdate(a),ub=Y.encodeStateAsUpdate(b);
  Y.applyUpdate(a,ub);Y.applyUpdate(b,ua);
  assert.equal(a.getText("mermaid").toString(),b.getText("mermaid").toString());
  undo.undo();assert.match(a.getText("mermaid").toString(),/Remote comment/);assert.doesNotMatch(a.getText("mermaid").toString(),/Local/);
  const c=materialize(copyContent(Y.encodeStateAsUpdate(b),"BOARD"));
  assert.equal(c.getText("mermaid").toString(),b.getText("mermaid").toString());
  assert.notDeepEqual(Y.encodeStateVector(c),Y.encodeStateVector(b));
  undo.destroy();for(const d of[a,b,c])d.destroy();
});
test("real PG Mermaid source obeys ACL, bounds and immutable restore-copy",{skip:!process.env.COLLAB_TEST_DATABASE_URL},async()=>{
  const s=new Store(process.env.COLLAB_TEST_DATABASE_URL),ctx={org:process.env.TEST_ORG,user:process.env.TEST_OWNER},peer={org:ctx.org,user:process.env.TEST_MEMBER};
  const d=new Y.Doc();d.getText("mermaid").insert(0,"sequenceDiagram\n  Alice->>Bob: Hello");
  const send=doc=>({updateId:randomUUID(),update:Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64")});
  try{
    const board=await s.create(ctx,process.env.TEST_PROJECT,{title:"Mermaid "+randomUUID(),kind:"BOARD"});
    await s.grant(ctx,board.id,{userId:peer.user,role:"VIEWER"});
    await assert.rejects(s.update(peer,board.id,send(d)),{code:"READ_ONLY"});
    await s.update(ctx,board.id,send(d));
    const id=randomUUID();await s.version(ctx,board.id,{id,name:"Mermaid source"});
    const copy=await s.restore(ctx,board.id,id,{id:randomUUID()});
    const saved=materialize(Buffer.from((await s.sync(ctx,copy.id,"AA==")).update,"base64"));
    assert.equal(saved.getText("mermaid").toString(),d.getText("mermaid").toString());saved.destroy();
    await assert.rejects(s.detail(peer,copy.id),{code:"NOT_FOUND"});
    const bad=materialize(Y.encodeStateAsUpdate(d));bad.getText("mermaid").insert(0,"x".repeat(32000));
    await assert.rejects(s.update(ctx,board.id,send(bad)),{code:"INVALID_BOARD"});bad.destroy();
    const embed=materialize(Y.encodeStateAsUpdate(d));embed.getText("mermaid").insertEmbed(0,{image:"https://invalid.test"});
    await assert.rejects(s.update(ctx,board.id,send(embed)),{code:"INVALID_BOARD"});embed.destroy();
  }finally{d.destroy();await s.close();}
});
