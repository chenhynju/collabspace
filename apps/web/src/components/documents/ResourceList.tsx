"use client";
import { useEffect, useState } from "react";
import { FileText, Network, ArrowUpRight } from "lucide-react";
import {displayDate} from "@/lib/display-date";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
export default function ResourceList({
  params,
  kind = "DOCUMENT",
}: {
  params: { id: string };
  kind?: "DOCUMENT" | "BOARD";
}) {
  const org = useAuthStore((s) => s.currentOrgId);
  const [docs, setDocs] = useState<any[]>([]),
    [title, setTitle] = useState(""),
    [error, setError] = useState("");
  const [format,setFormat]=useState('DOCUMENT');
  useEffect(() => {
    let active = true;
    setDocs([]);
    api
      .get("/documents", { params: { projectId: params.id } })
      .then((r) => {
        if (active)
          setDocs(r.data.filter((d: any) => kind==='BOARD'?d.kind==='BOARD':['DOCUMENT','MARKDOWN'].includes(d.kind)));
      })
      .catch(() => {
        if (active) setError("文档加载失败，请检查项目权限。");
      });
    return () => {
      active = false;
    };
  }, [params.id, org, kind]);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data } = await api.post("/documents", {
        projectId: params.id,
        title,
        kind:kind==='BOARD'?'BOARD':format,
      });
      setDocs((d) => [data, ...d]);
      setTitle("");
      setError("");
    } catch (e: any) {
      setError(e.response?.data?.message || "创建失败");
    }
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
      <Link className="text-sm text-blue-600" href={`/projects/${params.id}`}>
        ← 返回项目
      </Link>
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-8 text-white shadow-lg">
        <p className="text-xs uppercase tracking-widest text-indigo-300">
          CollabSpace / Creative workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          {kind === "BOARD"
            ? "设计空间"
            : "团队文档"}
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-slate-300">
          {kind === "BOARD"
            ? "用图形、便签与箭头梳理想法，多人光标、离线草稿和版本历史保持同步。"
            : "需求、技术决策与交付记录，和团队保持同一份上下文。"}
        </p>
      </div>
      <form onSubmit={create} className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          aria-label={kind === "BOARD" ? "新白板标题" : "新文档标题"}
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="例如：客户门户 · 交付说明"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button className="rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700">
          {kind === "BOARD" ? "创建白板" : "创建文档"}
        </button>
      </form>
      {kind!=='BOARD'&&<div className="flex flex-wrap items-center gap-3 text-sm">
        <label>文档格式 <select aria-label="文档格式" value={format} onChange={e=>setFormat(e.target.value)} className="rounded border p-2"><option value="DOCUMENT">富文本</option><option value="MARKDOWN">Markdown (.md)</option></select></label>
        <label className="rounded border p-2">导入 .md<input aria-label="导入 Markdown 文件" className="ml-2" type="file" accept=".md,text/markdown" onChange={async e=>{
          const file=e.target.files?.[0];e.target.value='';if(!file)return;
          try{
            if(!/\.md$/i.test(file.name)||file.size>200000)throw Error('请选择200KB以内的UTF-8 .md文件。');
            const source=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()).replace(/\r\n?/g,'\n');
            if(source.length>64000||source.includes('\0'))throw Error('源码最多64000字符，不能包含二进制内容。');
            const r=await api.post('/documents',{projectId:params.id,title:file.name.slice(0,160),kind:'MARKDOWN',source});setDocs(d=>[r.data,...d]);setError('');
          }catch(err:any){setError(err.response?.data?.message||err.message||'导入失败，请检查编码和权限。');}
        }}/></label><span className="text-slate-500">UTF-8 · 去除BOM · 换行统一为LF · 原文件不覆盖</span>
      </div>}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!docs.length && (
          <p className="p-8 text-slate-500">
            还没有你可访问的文档。创建第一份，或请负责人授予访问权限。
          </p>
        )}
        {docs.map((d) => (
          <Link
            href={`/projects/${params.id}/documents/${d.id}`}
            key={d.id}
            className="group flex min-h-44 items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
          >
            <div>
              <span className="mb-4 inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-600">{d.kind==='BOARD'?<Network size={23}/>:<FileText size={23}/>}</span><h2 className="break-all font-semibold text-slate-900">{d.title}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {d.kind==='MARKDOWN'?'Markdown · ':''}{d.role} · {d.status === "ARCHIVED" ? "已归档" : "可协作"}
              </p><p className="mt-2 text-xs text-slate-400">更新于 {displayDate(d.updated_at)}</p>
            </div>
            <ArrowUpRight className="shrink-0 text-slate-300 group-hover:text-indigo-600" size={20}/>
          </Link>
        ))}
      </div>
    </div>
  );
}
