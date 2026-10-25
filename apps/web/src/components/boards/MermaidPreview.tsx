"use client";
import {exportDiagram} from '@/lib/diagram-export';
import {flowSvgLayout,type CanvasNode} from '@/lib/mermaid-svg-layout';
import {addFlowNode,deleteFlowNodes,isFlowSource} from '@/lib/mermaid-edit';
import {positionNode} from '@/lib/mermaid-position';
import type {DiagramShape} from '@/lib/diagram-catalog';
import {useEffect,useState,useRef} from "react";
let renderQueue: Promise<unknown> = Promise.resolve();
let serial = 0;
// All diagrams, including historical snapshots, go through one pinned official
// renderer. Never attach untrusted SVG or bind Mermaid click handlers in the app.
export function MermaidPreview({source,writable=false,commit,selectedIds=[],onSelect}:{source:string;writable?:boolean;commit?:(before:string,after:string)=>void;selectedIds?:string[];onSelect?:(ids:string[])=>void}) {
 const [canvas,setCanvas]=useState<{nodes:CanvasNode[];width:number;height:number}>({nodes:[],width:1000,height:800}),[actionError,setActionError]=useState('');
 const viewport=useRef<HTMLDivElement>(null),drag=useRef<{id:string;x:number;y:number;px:number;py:number;source:string;left:number;top:number}>();
 const interactive=!!commit&&(!source.trim()||isFlowSource(source));
 const mutate=(before:string,next:string)=>{try{if(!writable)throw Error('当前文档只读。');commit?.(before,next);setActionError('');}catch(e){setActionError((e as Error).message);}};
 const remove=()=>{try{const next=deleteFlowNodes(source,selectedIds);mutate(source,next);onSelect?.([]);}catch(e){setActionError((e as Error).message);}};
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [rendered,setRendered]=useState<{source:string;svg:string}|null>(null),[zoom,setZoom]=useState(100),[exportError,setExportError]=useState(""),[exporting,setExporting]=useState(false);
  useEffect(() => {
    let alive = true;
    setHtml("");setRendered(null);setExportError("");
    setError("");
    const timer = setTimeout(() => {
      renderQueue = renderQueue.catch(() => {}).then(async () => {
        if (!alive || !source.trim()) return;
        // Configuration is application-owned. Source directives cannot relax it.
        if (source.length > 32000 || /%%\s*\{|^\s*---\s*$|https?:|data:|javascript:|\/\/|\bimg\s*:|url\s*\(|!\[|<\/?[a-z!]/im.test(source)) {
          if (alive) setError("源码超过限制，或包含禁用的配置指令、外部地址 / HTML。请只输入 Mermaid 图表语法。");
          return;
        }
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", htmlLabels: false,
          maxTextSize: 32000, maxEdges: 500, suppressErrorRendering: true,
          secure: ["securityLevel", "startOnLoad", "maxTextSize", "maxEdges", "htmlLabels", "secure"],
        });
        const host = document.createElement("div");
        host.style.cssText = "position:fixed;left:-100000px;top:0;width:1200px;visibility:hidden";
        document.body.appendChild(host);
        try {
          await mermaid.parse(source);
          const { svg:rawSvg } = await mermaid.render(`collabMermaid${++serial}`, source, host);
          const layout=flowSvgLayout(source,rawSvg),svg=layout.svg;
          if (alive) {setCanvas(layout);setRendered({source,svg});setHtml(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"><style>body{margin:0;font-family:system-ui}svg{max-width:100%;height:auto}a{pointer-events:none}</style></head><body>${svg}</body></html>`);}
        } catch (e) {
          if (alive) { setHtml(""); setError(e instanceof Error ? e.message.slice(0, 1000) : "图表语法无法解析"); }
        } finally { host.remove(); }
      }).catch(() => { if (alive) setError("图表渲染器加载失败，请重试或重新打开页面。"); });
    }, 350);
    return () => { alive = false; clearTimeout(timer); };
  }, [source]);
  return <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Mermaid 图形预览">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 p-2 text-xs"><span className="font-medium text-slate-600">{interactive?'图形画布':'画布预览'}</span><div className="flex flex-wrap gap-2"><button className="rounded border bg-white px-2 py-1" disabled={zoom<=50} onClick={()=>setZoom(z=>Math.max(50,z-25))}>缩小</button><button className="rounded border bg-white px-2 py-1" onClick={()=>setZoom(Math.max(25,Math.min(100,Math.floor((viewport.current?.clientWidth||canvas.width)/canvas.width*100))))}>{zoom}% · 适应画布</button><button className="rounded border bg-white px-2 py-1" disabled={zoom>=200} onClick={()=>setZoom(z=>Math.min(200,z+25))}>放大</button>{(['svg','png'] as const).map(format=><button key={format} disabled={!rendered||rendered.source!==source||exporting} className="rounded border bg-white px-2 py-1 disabled:opacity-40" onClick={async()=>{if(!rendered||rendered.source!==source)return;setExporting(true);setExportError('');try{await exportDiagram(rendered.svg,format)}catch(e){setExportError((e as Error).message)}finally{setExporting(false)}}}>导出 {format.toUpperCase()}</button>)}</div></div>
    {interactive&&<div className="flex flex-wrap gap-2 border-b p-2 text-xs"><button type="button" disabled={!writable||!selectedIds.length} className="rounded border px-3 py-2 disabled:opacity-40" onClick={remove}>删除选中图元</button><button type="button" className="rounded border px-3 py-2" onClick={()=>onSelect?.([])}>取消选择</button><span>拖入图元到此画布；拖动图元移动，Shift点选可多选，Delete删除。</span></div>}
    {actionError&&<p role="alert" className="p-2 text-sm text-red-700">{actionError}</p>}
    {exportError&&<p role="alert" className="p-2 text-sm text-red-700">{exportError}</p>}
    {error ? <pre role="alert" className="whitespace-pre-wrap break-words p-4 text-sm text-red-700">{error}</pre> :
      ((html && rendered?.source===source)||(interactive&&!source.trim())) ? <div ref={viewport} className="h-[640px] overflow-auto"><div aria-label="Mermaid 图形画布" tabIndex={interactive?0:undefined} className="relative outline-none" style={interactive?{width:canvas.width*zoom/100,height:canvas.height*zoom/100}:{width:`${zoom}%`,minWidth:300,height:640*zoom/100}} onKeyDown={e=>{if(interactive&&writable&&selectedIds.length&&(e.key==='Delete'||e.key==='Backspace')&&e.target===e.currentTarget){e.preventDefault();remove();}}} onDragOver={e=>{if(interactive&&writable)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(!interactive||!writable)return;const kind=e.dataTransfer.getData('application/x-collab-mermaid');if(!kind)return;const box=e.currentTarget.getBoundingClientRect(),id='N'+crypto.randomUUID().replaceAll('-','').slice(0,12);try{const added=addFlowNode(source,e.dataTransfer.getData('application/x-collab-label')||'新节点',kind as DiagramShape,id);mutate(source,positionNode(added,id,Math.max(20,(e.clientX-box.left)*100/zoom),Math.max(20,(e.clientY-box.top)*100/zoom)));onSelect?.([id]);}catch(err){setActionError((err as Error).message);}}}>
       <iframe title="Mermaid 图表" sandbox="" referrerPolicy="no-referrer" srcDoc={html} style={{width:'100%',height:'100%',pointerEvents:interactive?'none':undefined}} className="border-0" />
       {interactive&&canvas.nodes.map(n=><button key={n.id} type="button" aria-label={'画布图元 '+n.label} aria-pressed={selectedIds.includes(n.id)} disabled={!writable} className={'absolute -translate-x-1/2 -translate-y-1/2 rounded border-2 bg-transparent focus-visible:outline-indigo-500 '+(selectedIds.includes(n.id)?'border-indigo-500':'border-transparent hover:border-indigo-300')} style={{left:n.x*zoom/100,top:n.y*zoom/100,width:n.width*zoom/100,height:n.height*zoom/100,touchAction:'none',cursor:'move'}} onClick={e=>{if(e.shiftKey)onSelect?.(selectedIds.includes(n.id)?selectedIds.filter(id=>id!==n.id):[...selectedIds,n.id]);else onSelect?.([n.id]);}} onKeyDown={e=>{if(writable&&(e.key==='Delete'||e.key==='Backspace')){e.preventDefault();e.stopPropagation();try{mutate(source,deleteFlowNodes(source,selectedIds.includes(n.id)?selectedIds:[n.id]));onSelect?.([]);}catch(err){setActionError((err as Error).message);}}}} onPointerDown={e=>{if(!writable)return;if(!e.shiftKey&&!selectedIds.includes(n.id))onSelect?.([n.id]);const box=e.currentTarget.parentElement!.getBoundingClientRect();drag.current={id:n.id,x:n.x,y:n.y,px:e.clientX,py:e.clientY,source,left:box.left,top:box.top};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const d=drag.current;if(!d||d.id!==n.id)return;e.currentTarget.style.left=`${d.x*zoom/100+e.clientX-d.px}px`;e.currentTarget.style.top=`${d.y*zoom/100+e.clientY-d.py}px`;}} onPointerCancel={()=>{drag.current=undefined;}} onPointerUp={e=>{const d=drag.current;drag.current=undefined;if(!d||Math.hypot(e.clientX-d.px,e.clientY-d.py)<4)return;try{mutate(d.source,positionNode(d.source,d.id,Math.max(20,d.x+(e.clientX-d.px)*100/zoom),Math.max(20,d.y+(e.clientY-d.py)*100/zoom)));}catch(err){setActionError((err as Error).message);}}}/>)}
      </div></div> :
      <p className="p-6 text-sm text-slate-500">{source.trim() ? "正在渲染 Mermaid…" : "输入 Mermaid 源码或选择模板，即可生成图表。"}</p>}
  </div>;
}
