"use client";
import { useEffect, useState } from "react";
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
          setDocs(r.data.filter((d: any) => kind==='BOARD'?d.kind==='BOARD':d.kind!=='BOARD'));
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
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <Link className="text-sm text-blue-600" href={`/projects/${params.id}`}>
        ← 返回项目
      </Link>
      <div>
        <p className="text-sm text-slate-500">
          CollabSpace / Project documents
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          {kind === "BOARD"
            ? "一起画清楚，再开始交付。"
            : "一起写清楚，再开始交付。"}
        </h1>
        <p className="mt-2 text-slate-500">
          {kind === "BOARD"
            ? "用图形、便签与箭头梳理想法，多人光标、离线草稿和版本历史保持同步。"
            : "需求、技术决策与交付记录，和团队保持同一份上下文。"}
        </p>
      </div>
      <form onSubmit={create} className="flex gap-3">
        <input
          aria-label={kind === "BOARD" ? "新白板标题" : "新文档标题"}
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="例如：客户门户 · 交付说明"
          className="flex-1 rounded-lg border p-3"
        />
        <button className="rounded-lg bg-slate-900 px-5 text-white">
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
      <div className="divide-y rounded-xl border bg-white">
        {!docs.length && (
          <p className="p-8 text-slate-500">
            还没有你可访问的文档。创建第一份，或请负责人授予访问权限。
          </p>
        )}
        {docs.map((d) => (
          <Link
            href={`/projects/${params.id}/documents/${d.id}`}
            key={d.id}
            className="flex items-center justify-between p-5 hover:bg-slate-50"
          >
            <div>
              <h2 className="font-medium">{d.title}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {d.kind==='MARKDOWN'?'Markdown · ':''}{d.role} · {d.status === "ARCHIVED" ? "已归档" : "可协作"}
              </p>
            </div>
            <span className="text-slate-400">打开 →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
