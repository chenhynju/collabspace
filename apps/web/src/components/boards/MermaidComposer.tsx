"use client";
import {useState} from 'react';
import {flowNodes,addFlowNode,connectFlowNodes,mindNodes,addMindNode,moveMindBranch} from '@/lib/mermaid-edit';
export default function MermaidComposer({source,writable,commit}:{source:string;writable:boolean;commit:(before:string,after:string)=>void}) {
  const [label,setLabel]=useState('新节点'),[error,setError]=useState(''),[from,setFrom]=useState('');
  const mind=source.trimStart().startsWith('mindmap'),nodes=mind?mindNodes(source):flowNodes(source),supported=mind?nodes.length>0:!source.trim()||/^\s*(?:flowchart|graph)\s+(?:LR|RL|TB|TD|BT)\b/.test(source);
  const run=(fn:()=>string)=>{try{commit(source,fn());setError('');}catch(e){setError((e as Error).message);}};
  const add=(kind:'process'|'decision'|'start')=>run(()=>mind?addMindNode(source,label,from):addFlowNode(source,label,kind,'N'+crypto.randomUUID().replaceAll('-','').slice(0,12)));
  const connect=(start:string,end:string)=>run(()=>mind?moveMindBranch(source,start,end):connectFlowNodes(source,start,end));
  return <div aria-label="Mermaid 拖拽编辑" className="mb-3 rounded border bg-white p-3">
    <p className="mb-2 text-sm">拖入图元生成 Mermaid；流程节点互拖建立箭头；思维导图主题互拖改变父主题。图形自动重新布局。</p>
    {!supported?<p className="text-sm text-slate-500">当前类型请通过源码编辑；拖拽操作支持流程图及基础思维导图，已有源码保持完整。</p>:<>
      <label className="text-sm">新节点名称 <input aria-label="新节点名称" value={label} maxLength={100} disabled={!writable} onChange={e=>setLabel(e.target.value)} className="rounded border p-1"/></label>
      <div className="my-2 flex gap-2">{([['process','处理'],['decision','判断'],['start','起止']] as const).map(([kind,name])=><button key={kind} disabled={!writable||(mind&&kind!=='process')} draggable={writable&&(!mind||kind==='process')} onDragStart={e=>e.dataTransfer.setData('application/x-collab-mermaid',kind)} onClick={()=>add(kind)} className="rounded border px-3 py-2 disabled:opacity-40">{mind&&kind==='process'?'子主题':name+'图元'}</button>)}</div>
      <div aria-label="Mermaid 图元放置区" className="flex min-h-20 flex-wrap gap-3 rounded border-2 border-dashed p-3" onDragOver={e=>{if(writable)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(!writable)return;const kind=e.dataTransfer.getData('application/x-collab-mermaid');if(['process','decision','start'].includes(kind))add(kind as 'process');}}>
        {!nodes.length&&<span className="text-sm text-slate-500">把图元拖到这里，或点击上方图元添加</span>}
        {nodes.map(n=><button key={n.id} disabled={!writable} draggable={writable} aria-label={`${mind?'思维主题':'流程节点'} ${n.label}`} onDragStart={e=>{e.stopPropagation();e.dataTransfer.setData('application/x-collab-node',n.id);}} onDragOver={e=>{if(writable)e.preventDefault();}} onDrop={e=>{e.preventDefault();e.stopPropagation();if(!writable)return;const start=e.dataTransfer.getData('application/x-collab-node');if(start)connect(start,n.id);}} onClick={()=>{if(from){connect(from,n.id);setFrom('');}else setFrom(n.id);}} className={`rounded border px-4 py-2 ${from===n.id?'bg-blue-100':'bg-slate-50'}`}>{n.label}<span className="block text-xs text-slate-400">{n.id}</span></button>)}
      </div><p className="mt-1 text-xs text-slate-500">也可依次点击两个节点连接；只读者不能修改。节点位置由 Mermaid 布局决定。</p>
    </>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
