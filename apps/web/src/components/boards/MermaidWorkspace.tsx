"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as Y from "yjs";
import type { DocumentProvider } from "@/lib/document-provider";
import {from64,to64} from '@/lib/document-provider';
import MermaidComposer from './MermaidComposer';

const origin = "collabspace:mermaid:local";
export const examples = {
  流程图: "flowchart LR\n  A[需求] --> B{评审通过?}\n  B -->|是| C[交付]\n  B -->|否| A",
  思维导图: "mindmap\n  root((远程协作))\n    文档\n      实时编辑\n      评论\n    团队\n      在线状态",
  时序图: "sequenceDiagram\n  participant A as 编辑者\n  participant S as 服务端\n  participant B as 协作者\n  A->>S: 提交更新\n  S-->>A: 持久化确认\n  S-->>B: 广播已提交更新",
  类图: "classDiagram\n  class Document {\n    +String title\n    +save()\n  }\n  class Member\n  Member --> Document : edits",
  状态图: "stateDiagram-v2\n  [*] --> Draft\n  Draft --> Review\n  Review --> Published\n  Review --> Draft",
  ER图: "erDiagram\n  ORGANIZATION ||--o{ DOCUMENT : owns\n  DOCUMENT ||--o{ COMMENT : contains",
};
import {MermaidPreview} from './MermaidPreview';
export {MermaidPreview} from './MermaidPreview';
import {MarkdownPreview} from '../documents/MarkdownPreview';

export default function MermaidWorkspace({ provider, format = "mermaid",onSelection,fileName }: { provider: DocumentProvider;format?:"mermaid"|"markdown";onSelection?:(value:any)=>void;fileName?:string }) {
  const markdown=format==='markdown';
  const limit=markdown?64000:32000;
  const text = provider.doc.getText(format);
  const [source, setSource] = useState(text.toString());
  const [view, setView] = useState<"split" | "source" | "graph">("split");
  const [imeDraft, setImeDraft] = useState("");
  const [, render] = useState(0);
  const undo = useRef<Y.UndoManager>();
  const composing = useRef(false);
  const pendingRemote = useRef(false);
  const compositionConflict = useRef<string>();
  const baseline = useRef(source);
  const editor = useRef<HTMLTextAreaElement>(null);
  const selection = useRef<{start: Y.RelativePosition; end: Y.RelativePosition}>();
  const restoredSelection = useRef<{start:number;end:number}>();
  useLayoutEffect(() => {
    const range = restoredSelection.current;
    if (range && editor.current === document.activeElement) editor.current?.setSelectionRange(range.start, range.end);
    restoredSelection.current = undefined;
  }, [source]);
  useEffect(() => {
    const before = (transaction:Y.Transaction) => {
      selection.current = undefined;
      const el = editor.current;
      if (transaction.origin !== origin && el === document.activeElement && !composing.current && el) {
        selection.current = {start:Y.createRelativePositionFromTypeIndex(text,el.selectionStart),end:Y.createRelativePositionFromTypeIndex(text,el.selectionEnd)};
      }
    };
    const update = () => {
      if (composing.current) { pendingRemote.current = true; return; }
      if (selection.current) {
        const a=Y.createAbsolutePositionFromRelativePosition(selection.current.start,provider.doc),b=Y.createAbsolutePositionFromRelativePosition(selection.current.end,provider.doc);
        if(a && b) restoredSelection.current={start:a.index,end:b.index};
      }
      baseline.current = text.toString(); setSource(text.toString()); render(n => n + 1);
    };
    provider.doc.on("beforeTransaction",before);
    text.observe(update);
    undo.current = new Y.UndoManager(text, { trackedOrigins: new Set([origin]) });
    return () => { provider.doc.off("beforeTransaction",before); text.unobserve(update); undo.current?.destroy(); };
  }, [text, provider.doc]);
  const edit = (next: string) => {
    if (!provider.writable || next.length > limit) return;
    // A fresh native input already supplies its current caret. A remote range
    // queued before this local input must not be restored over the new keystroke.
    restoredSelection.current = undefined;
    const old = baseline.current;
    let start = 0, end = 0;
    while (start < old.length && start < next.length && old[start] === next[start]) start++;
    while (end < old.length - start && end < next.length - start && old[old.length - 1 - end] === next[next.length - 1 - end]) end++;
    // Relative positions preserve the edited range if remote text arrived during IME.
    const from = Y.createRelativePositionFromTypeIndex(text, start);
    const to = Y.createRelativePositionFromTypeIndex(text, old.length - end);
    provider.doc.transact(() => {
      const a = Y.createAbsolutePositionFromRelativePosition(from, provider.doc)?.index ?? start;
      const b = Y.createAbsolutePositionFromRelativePosition(to, provider.doc)?.index ?? old.length - end;
      if (b > a) text.delete(a, b - a);
      text.insert(a, next.slice(start, next.length - end));
    }, origin);
    baseline.current = text.toString(); setSource(text.toString());
  };
  return <section aria-label={markdown?"Markdown 工作区":"Mermaid 工作区"} className="rounded border bg-slate-50 p-3">
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <strong className="mr-2">{markdown?"Markdown 文档":"Mermaid 图表"}</strong>
      {([ ["graph", "图形视图"], ["source", "源码视图"], ["split", "分屏视图"] ] as const).map(([key,label]) =>
        <button key={key} aria-pressed={view === key} onClick={() => setView(key)} className={`rounded border px-3 py-1 text-sm ${view === key ? "bg-blue-600 text-white" : "bg-white"}`}>{label}</button>)}
      <button disabled={!provider.writable || !undo.current?.canUndo()} onClick={() => undo.current?.undo()} className="rounded border px-2 py-1 disabled:opacity-40">撤销源码</button>
      <button disabled={!provider.writable || !undo.current?.canRedo()} onClick={() => undo.current?.redo()} className="rounded border px-2 py-1 disabled:opacity-40">重做源码</button>
      <button className="rounded border px-2 py-1" onClick={() => {
        const url = URL.createObjectURL(new Blob([source], {type:"text/plain;charset=utf-8"}));
        const a = document.createElement("a"); a.href=url; a.download=markdown?(fileName?.replace(/[\\/]/g,'_').replace(/\.md$/i,'')||'collabspace-document')+'.md':"collabspace-diagram.mmd"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>{markdown?"下载 .md":"下载 .mmd"}</button>
    </div>
    {!markdown && !source && provider.writable && <div className="mb-3 flex flex-wrap gap-2">{Object.entries(examples).map(([name,value]) =>
      <button key={name} className="rounded border bg-white px-3 py-1 text-sm" onClick={() => { if (!text.length) edit(value); }}>{name}模板</button>)}</div>}
    <p className="mb-3 text-xs text-slate-600">{markdown?'原生 Markdown 源码为内容标准，自动协作保存；支持GFM与Mermaid代码块，外部图片和原始HTML不执行。':'Mermaid 源码是图表的唯一内容标准，自动同步并保存。可拖入流程图元、拖动节点建立关系；语法错误也会保存草稿并显示诊断。'}</p>
    {!markdown && <MermaidComposer source={source} writable={provider.writable} commit={(before,after)=>{if(text.toString()!==before)throw Error('收到远端修改，请基于最新图表重试。');edit(after);}} />}
    <div className="flex flex-col gap-3 lg:flex-row">
      {view !== "graph" && <textarea ref={editor} aria-label={markdown?"协作 Markdown 源码":"协作 Mermaid 源码"} spellCheck={false} readOnly={!provider.writable} maxLength={limit} value={source}
        onSelect={e=>{const el=e.currentTarget,a=to64(Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(text,el.selectionStart))),b=to64(Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(text,el.selectionEnd)));provider.selection({anchor:a,head:b});onSelection?.(el.selectionStart===el.selectionEnd?null:{quote:text.toString().slice(el.selectionStart,el.selectionEnd).slice(0,1000),anchor:{start:a,end:b}});}}
        onBlur={()=>provider.selection(null)}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={e => { composing.current = false; const value=e.currentTarget.value; if (pendingRemote.current) { pendingRemote.current=false; compositionConflict.current=value; setImeDraft(value); baseline.current=text.toString(); setSource(text.toString()); } else edit(value); }}
        onChange={e => {
          const value=e.target.value;
          // Some browsers emit a final input after compositionend. Never replay
          // that stale full value over remote edits retained by the recovery UI.
          if (compositionConflict.current === value) { compositionConflict.current=undefined; setSource(text.toString()); return; }
          compositionConflict.current=undefined;
          if (composing.current) setSource(value); else edit(value);
        }}
        className="min-h-[640px] min-w-0 flex-1 rounded border p-4 font-mono text-sm" />}
      {view !== "source" && (markdown?<MarkdownPreview source={source}/>:<MermaidPreview source={source} />)}
    </div>
    {markdown&&<div aria-label="协作者源码位置" className="my-2 flex flex-wrap gap-2 text-xs text-slate-500">{provider.members.filter(m=>m.selection).map(m=>{try{const at=Y.createAbsolutePositionFromRelativePosition(Y.decodeRelativePosition(from64(m.selection!.anchor)),provider.doc);if(!at||at.type!==text)return null;const before=source.slice(0,at.index),line=before.split('\n').length,column=at.index-before.lastIndexOf('\n');return <span key={m.sessionId}>{m.name} · {line}行{column}列</span>;}catch{return null;}})}</div>}
    {imeDraft && <div role="alert" className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm">
      输入法输入期间收到远端修改。已保留你的完整输入草稿，请复制需要的文字合并到上方最新源码。
      <textarea aria-label="输入法待合并草稿" readOnly value={imeDraft} className="mt-2 h-32 w-full border p-2 font-mono" />
      <button className="mt-2 underline" onClick={() => setImeDraft("")}>已处理，关闭草稿</button>
    </div>}
    <p className="mt-2 text-xs text-slate-500">{source.length} / {limit} 字符 · {provider.writable ? "可编辑" : "只读"} · 禁用源码配置指令和外部交互</p>
  </section>;
}
