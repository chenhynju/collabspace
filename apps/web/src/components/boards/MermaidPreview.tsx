"use client";
import {exportDiagram} from '@/lib/diagram-export';
import {useEffect,useState} from "react";
let renderQueue: Promise<unknown> = Promise.resolve();
let serial = 0;
// All diagrams, including historical snapshots, go through one pinned official
// renderer. Never attach untrusted SVG or bind Mermaid click handlers in the app.
export function MermaidPreview({ source }: { source: string }) {
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
          const { svg } = await mermaid.render(`collabMermaid${++serial}`, source, host);
          if (alive) {setRendered({source,svg});setHtml(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"><style>body{margin:16px;font-family:system-ui}svg{max-width:100%;height:auto}a{pointer-events:none}</style></head><body>${svg}</body></html>`);}
        } catch (e) {
          if (alive) { setHtml(""); setError(e instanceof Error ? e.message.slice(0, 1000) : "图表语法无法解析"); }
        } finally { host.remove(); }
      }).catch(() => { if (alive) setError("图表渲染器加载失败，请重试或重新打开页面。"); });
    }, 350);
    return () => { alive = false; clearTimeout(timer); };
  }, [source]);
  return <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Mermaid 图形预览">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 p-2 text-xs"><span className="font-medium text-slate-600">画布预览</span><div className="flex flex-wrap gap-2"><button className="rounded border bg-white px-2 py-1" disabled={zoom<=50} onClick={()=>setZoom(z=>Math.max(50,z-25))}>缩小</button><button className="rounded border bg-white px-2 py-1" onClick={()=>setZoom(100)}>{zoom}% · 适应画布</button><button className="rounded border bg-white px-2 py-1" disabled={zoom>=200} onClick={()=>setZoom(z=>Math.min(200,z+25))}>放大</button>{(['svg','png'] as const).map(format=><button key={format} disabled={!rendered||rendered.source!==source||exporting} className="rounded border bg-white px-2 py-1 disabled:opacity-40" onClick={async()=>{if(!rendered||rendered.source!==source)return;setExporting(true);setExportError('');try{await exportDiagram(rendered.svg,format)}catch(e){setExportError((e as Error).message)}finally{setExporting(false)}}}>导出 {format.toUpperCase()}</button>)}</div></div>
    {exportError&&<p role="alert" className="p-2 text-sm text-red-700">{exportError}</p>}
    {error ? <pre role="alert" className="whitespace-pre-wrap break-words p-4 text-sm text-red-700">{error}</pre> :
      html && rendered?.source===source ? <div className="h-[640px] overflow-auto"><iframe title="Mermaid 图表" sandbox="" referrerPolicy="no-referrer" srcDoc={html} style={{width:`${zoom}%`,minWidth:300,height:640*zoom/100}} className="border-0" /></div> :
      <p className="p-6 text-sm text-slate-500">{source.trim() ? "正在渲染 Mermaid…" : "输入 Mermaid 源码或选择模板，即可生成图表。"}</p>}
  </div>;
}
