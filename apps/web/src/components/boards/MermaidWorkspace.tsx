"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as Y from "yjs";
import type { DocumentProvider } from "@/lib/document-provider";
import {from64,to64} from '@/lib/document-provider';
import MermaidComposer from './MermaidComposer';

const origin = "collabspace:mermaid:local";
import {diagramTemplates} from '@/lib/diagram-catalog';
export const examples=Object.fromEntries(diagramTemplates.map(t=>[t.name,t.source]));
import {MermaidPreview} from './MermaidPreview';
export {MermaidPreview} from './MermaidPreview';
import {MarkdownPreview} from '../documents/MarkdownPreview';

export default function MermaidWorkspace({ provider, format = "mermaid",onSelection,fileName }: { provider: DocumentProvider;format?:"mermaid"|"markdown";onSelection?:(value:any)=>void;fileName?:string }) {
  const [templateOpen,setTemplateOpen]=useState(false),[templateSearch,setTemplateSearch]=useState(''),[pendingTemplate,setPendingTemplate]=useState<{before:string;after:string;name:string}|null>(null),[templateError,setTemplateError]=useState('');
  const markdown=format==='markdown';
  const limit=markdown?64000:32000;
  const text = provider.doc.getText(format);
  const [canvasSelection,setCanvasSelection]=useState<string[]>([]);
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
  return <section aria-label={markdown?"Markdown 工作区":"Mermaid 工作区"} className={markdown?"rounded-xl border bg-slate-50 p-3":"mermaid-workspace overflow-hidden rounded-xl border border-slate-200 bg-white"}>
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white p-3">
      <strong className="mr-2">{markdown?"Markdown 文档":"Mermaid 图表"}</strong>
      {([ ["graph", "图形视图"], ["source", "源码视图"], ["split", "分屏视图"] ] as const).map(([key,label]) =>
        <button key={key} aria-pressed={view === key} onClick={() => setView(key)} className={`rounded border px-3 py-1 text-sm ${view === key ? "bg-indigo-600 text-white" : "bg-white"}`}>{label}</button>)}
      <button disabled={!provider.writable || !undo.current?.canUndo()} onClick={() => undo.current?.undo()} className="rounded border px-2 py-1 disabled:opacity-40">撤销源码</button>
      <button disabled={!provider.writable || !undo.current?.canRedo()} onClick={() => undo.current?.redo()} className="rounded border px-2 py-1 disabled:opacity-40">重做源码</button>
      <button className="rounded border px-2 py-1" onClick={() => {
        const url = URL.createObjectURL(new Blob([source], {type:"text/plain;charset=utf-8"}));
        const a = document.createElement("a"); a.href=url; a.download=markdown?(fileName?.replace(/[\\/]/g,'_').replace(/\.md$/i,'')||'collabspace-document')+'.md':"collabspace-diagram.mmd"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>{markdown?"下载 .md":"下载 .mmd"}</button>
    </div>
    {!markdown&&provider.writable&&<label className="m-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-xs">导入 .mmd<input aria-label="导入 Mermaid 文件" className="sr-only" type="file" accept=".mmd,.mermaid,text/plain" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;const before=text.toString();try{if(!/\.(mmd|mermaid)$/i.test(file.name)||file.size>128000)throw Error('请选择128KB以内的 .mmd 或 .mermaid 文件。');const next=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()).replace(/\r\n?/g,'\n');if(next.length>32000||next.includes('\0'))throw Error('源码最多32000字符，不能包含二进制内容。');if(text.toString()!==before)throw Error('读取文件期间收到远端修改，请重新导入并核对。');if(!before)edit(next);else setPendingTemplate({before,after:next,name:file.name});setTemplateError('');}catch(err){setTemplateError((err as Error).message);}}}/></label>}
    {!markdown && provider.writable && <div className="mermaid-template-panel mx-3 mb-3 inline-block rounded-lg border border-slate-200 bg-slate-50/50 p-2 align-top">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">业务图表模板库</h2><p className="text-xs text-slate-500">{diagramTemplates.length} 个业务场景</p></div><button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>setTemplateOpen(v=>!v)}>{templateOpen?'收起模板':'浏览模板'}</button></div>
      {(templateOpen||!source)&&<><input aria-label="搜索图表模板" placeholder="搜索场景，例如：审批、架构、排期" value={templateSearch} onChange={e=>setTemplateSearch(e.target.value)} className="my-3 w-full rounded-lg border p-2 text-sm"/><div className="grid gap-2 sm:grid-cols-3">{diagramTemplates.filter(t=>(t.name+t.category).includes(templateSearch)).slice(0,templateOpen?diagramTemplates.length:6).map(t=><button key={t.name} aria-label={t.name+'模板'} className="rounded-xl border border-slate-200 p-3 text-left hover:border-indigo-300 hover:bg-indigo-50" onClick={()=>{if(!text.length){edit(t.source);setTemplateError('');}else setPendingTemplate({before:text.toString(),after:t.source,name:t.name});}}><span className="block font-medium">{t.name}模板</span><span className="text-xs text-slate-500">{t.category}</span></button>)}</div></>}
      {pendingTemplate&&<div role="dialog" aria-label="确认替换图表" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"><p>将当前源码替换为“{pendingTemplate.name}”模板？已有内容会被替换，可使用撤销恢复。</p><div className="mt-2 flex gap-3"><button className="rounded border bg-white px-3 py-1" onClick={()=>{if(text.toString()!==pendingTemplate.before){setTemplateError('收到其他成员修改，请重新选择模板并核对最新内容。');setPendingTemplate(null);return;}edit(pendingTemplate.after);setPendingTemplate(null);setTemplateError('');}}>确认替换</button><button onClick={()=>setPendingTemplate(null)}>取消</button></div></div>}{templateError&&<p role="alert" className="mt-2 text-sm text-red-700">{templateError}</p>}
    </div>}
    <p className="px-3 pb-3 text-xs leading-5 text-slate-500">{markdown?'原生 Markdown 源码为内容标准，自动协作保存；支持GFM与Mermaid代码块，外部图片和原始HTML不执行。':'Mermaid 源码是图表的唯一内容标准，自动同步并保存。可拖入流程图元、拖动节点建立关系；语法错误也会保存草稿并显示诊断。'}</p>
    <div className={markdown?"":"grid min-w-0 items-start lg:grid-cols-[224px_minmax(0,1fr)]"}>
    {!markdown && <MermaidComposer selectedId={canvasSelection[0]||''} onSelect={id=>setCanvasSelection([id])} source={source} writable={provider.writable} commit={(before,after)=>{if(text.toString()!==before)throw Error('收到远端修改，请基于最新图表重试。');edit(after);}} />}
    <div className="flex min-w-0 flex-col gap-3 bg-[#f5f6fa] p-3 xl:flex-row">
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
        className="min-h-[640px] w-full min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />}
      {view !== "source" && (markdown?<MarkdownPreview source={source}/>:<MermaidPreview source={source} writable={provider.writable} selectedIds={canvasSelection} onSelect={setCanvasSelection} commit={(before,after)=>{if(text.toString()!==before)throw Error('收到远端修改，请基于最新图表重试。');edit(after);}} />)}
    </div>
    </div>
    {markdown&&<div aria-label="协作者源码位置" className="my-2 flex flex-wrap gap-2 text-xs text-slate-500">{provider.members.filter(m=>m.selection).map(m=>{try{const at=Y.createAbsolutePositionFromRelativePosition(Y.decodeRelativePosition(from64(m.selection!.anchor)),provider.doc);if(!at||at.type!==text)return null;const before=source.slice(0,at.index),line=before.split('\n').length,column=at.index-before.lastIndexOf('\n');return <span key={m.sessionId}>{m.name} · {line}行{column}列</span>;}catch{return null;}})}</div>}
    {imeDraft && <div role="alert" className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm">
      输入法输入期间收到远端修改。已保留你的完整输入草稿，请复制需要的文字合并到上方最新源码。
      <textarea aria-label="输入法待合并草稿" readOnly value={imeDraft} className="mt-2 h-32 w-full border p-2 font-mono" />
      <button className="mt-2 underline" onClick={() => setImeDraft("")}>已处理，关闭草稿</button>
    </div>}
    <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">{source.length} / {limit} 字符 · {provider.writable ? "可编辑" : "只读"} · 禁用源码配置指令和外部交互</p>
  </section>;
}
