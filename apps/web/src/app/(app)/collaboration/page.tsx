"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, FileText, Network, FolderOpen, Users, MessageSquare, History } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
export default function CollaborationHub() {
  const org = useAuthStore((s) => s.currentOrgId);
  const [projects, setProjects] = useState<any[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setProjects([]);
    setError("");
    api
      .get("/projects")
      .then((r) => {
        if (active)
          setProjects(Array.isArray(r.data) ? r.data : r.data.list || []);
      })
      .catch(() => {
        if (active) setError("项目加载失败，请检查权限后重试。");
      });
    return () => {
      active = false;
    };
  }, [org]);
  return (
    <div className="mx-auto max-w-6xl space-y-7 p-5 sm:p-8">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-7 text-white shadow-lg sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
        <p className="relative text-xs font-semibold uppercase tracking-[.2em] text-indigo-300">CollabSpace · Workspace</p>
        <h1 className="relative mt-4 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">好想法，在同一份画布上成形。</h1>
        <p className="relative mt-4 max-w-2xl leading-7 text-slate-300">从一段文字到一张流程图，让团队的讨论、修改与交付始终保持同步。</p>
        <div className="relative mt-7 flex flex-wrap gap-5 text-xs text-slate-300"><span className="flex items-center gap-2"><Users size={15}/>在线成员与光标</span><span className="flex items-center gap-2"><MessageSquare size={15}/>原文评论</span><span className="flex items-center gap-2"><History size={15}/>版本与离线恢复</span></div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-600"><FileText size={24}/></span><h2 className="mt-4 text-xl font-semibold text-slate-900">一起写，始终在同一页</h2><p className="mt-2 text-sm leading-6 text-slate-500">富文本与 Markdown，图文表达、共同编辑和原文评论。把想法写清楚，把讨论留在上下文里。</p></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="inline-flex rounded-xl bg-teal-50 p-3 text-teal-700"><Network size={24}/></span><h2 className="mt-4 text-xl font-semibold text-slate-900">一起画，让思路看得见</h2><p className="mt-2 text-sm leading-6 text-slate-500">以 Mermaid 源码驱动图表，在画布与代码间切换。用流程图与思维导图组织团队的下一步。</p></section>
      </div>
      <div className="flex items-end justify-between"><div><h2 className="text-lg font-semibold text-slate-900">项目协作空间</h2><p className="mt-1 text-sm text-slate-500">选择一个项目，继续团队的创作。</p></div><Link href="/files" className="flex items-center gap-1 text-sm font-medium text-indigo-600">Office 与文件<ArrowUpRight size={16}/></Link></div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!error && !projects.length && (
        <p className="text-slate-500">
          暂无可访问项目。先在“项目”创建项目或请负责人授予访问权限。
        </p>
      )}
      <div className="space-y-3">
        {projects.map((p) => (
          <div
            key={p.id}
            className="group flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
          >
            <div>
              <h3 className="flex items-center gap-3 font-semibold text-slate-900"><FolderOpen className="text-indigo-500" size={20}/>{p.name}</h3>
              <p className="text-xs text-slate-500">
                文档、图表与团队讨论的共享空间
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
                href={`/projects/${p.id}/documents`}
              >
                打开协作文档
              </Link>
              <Link
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                href={`/projects/${p.id}/boards`}
              >
                打开实时白板
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
