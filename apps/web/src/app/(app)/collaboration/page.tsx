"use client";
import { useEffect, useState } from "react";
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
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <p className="text-sm text-blue-700">
        CollabSpace / Real-time collaboration
      </p>
      <h1 className="text-3xl font-semibold">让团队始终编辑同一份文档。</h1>
      <p className="max-w-3xl text-slate-500">
        多人共同编辑、在线状态与光标、原文评论和冲突合并。选择项目，打开同一份文档，通过共享权限邀请组织成员；断线重连后继续同步。
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-xl font-semibold">协作文档</h2>
          <p className="mt-2 text-sm text-slate-500">
            富文本、多人选区与光标、原文评论、版本和离线恢复。
          </p>
        </section>
        <section className="rounded-xl border bg-white p-6">
          <h2 className="text-xl font-semibold">白板扩展</h2>
          <p className="mt-2 text-sm text-slate-500">
            流程图、绑定连接线、思维导图与 Mermaid 基础源码；多人光标、各自撤销、版本和离线重连。
          </p>
        </section>
      </div>
      <h2 className="text-lg font-semibold">选择协作项目</h2>
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
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-5"
          >
            <div>
              <h3 className="font-medium">{p.name}</h3>
              <p className="text-xs text-slate-500">
                项目权限与协作空间权限分别校验
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
                href={`/projects/${p.id}/documents`}
              >
                打开协作文档
              </Link>
              <Link
                className="rounded border px-4 py-2 text-sm"
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
