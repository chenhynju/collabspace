"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FileSpreadsheet,
  FileText,
  Files,
  FolderKanban,
  MessageSquare,
  Network,
  Plus,
  Presentation,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

const STATUS_TONE: Record<string, any> = {
  DRAFT: "slate",
  ACTIVE: "blue",
  DELIVERED: "green",
  ARCHIVED: "amber",
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  ACTIVE: "进行中",
  DELIVERED: "已交付",
  ARCHIVED: "已归档",
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const hasPerm = useAuthStore((s) => s.hasPerm);
  const orgId = useAuthStore((s) => s.currentOrgId);
  const [org, setOrg] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);

  const load = useCallback(() => {
    Promise.all([
      api.get("/organizations/current"),
      api.get("/projects").catch(() => ({ data: [] })),
    ]).then(([organization, projectList]) => {
      if (useAuthStore.getState().currentOrgId !== orgId) return;
      setOrg(organization.data);
      setProjects(Array.isArray(projectList.data) ? projectList.data : []);
    });
  }, [orgId]);

  useEffect(() => {
    load();
    const changed = () => load();
    window.addEventListener("collabspace:data-changed", changed);
    return () => window.removeEventListener("collabspace:data-changed", changed);
  }, [load]);

  const aiTotal = org?.entitlement?.aiCreditsTotal ?? 0;
  const aiUsed = org?.entitlement?.aiCreditsUsed ?? 0;
  const aiPct = aiTotal ? Math.round((aiUsed / aiTotal) * 100) : 0;
  const activeProjects = projects.filter((project) => project.status === "ACTIVE");
  const recent = projects.slice(0, 6);

  const stats = [
    { label: "进行中项目", value: activeProjects.length },
    { label: "组织成员", value: org?._count?.memberships ?? 0 },
    { label: "工作区", value: org?._count?.workspaces ?? 0 },
    { label: "已交付项目", value: projects.filter((p) => p.status === "DELIVERED").length },
  ];

  const quickActions = [
    {
      href: "/projects",
      label: "项目空间",
      hint: "工作区与项目统一管理",
      icon: FolderKanban,
      perm: "project:list",
    },
    {
      href: "/collaboration",
      label: "协作空间",
      hint: "文档、白板与实时协作",
      icon: BookOpen,
      perm: "project:list",
    },
    { href: "/im", label: "消息", hint: "单聊、群聊与文件消息", icon: MessageSquare, perm: "im:view" },
    {
      href: "/files",
      label: "附件",
      hint: "项目文件、版本与共享",
      icon: Files,
      perm: "file:manage",
    },
  ].filter((action) => !action.perm || hasPerm(action.perm));

  return (
    <div className="page-enter mx-auto max-w-[1440px] px-4 py-8 md:px-10 md:py-12">
      <header className="grid gap-8 border-b border-slate-300 pb-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span aria-hidden="true" className="h-2 w-2 bg-indigo-600" />
            <p className="eyebrow">
              {org?.name ?? "当前组织"} · {org?.plan?.name ?? "套餐"}
            </p>
            <span className="hidden h-px w-10 bg-slate-300 sm:block" />
            <p className="text-[11px] text-slate-400">
              {new Date().toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </p>
          </div>
          <h1 className="display-title mt-5 text-[2.6rem] leading-[1.05] text-slate-900 md:text-[3.6rem]">
            你好，{user?.name ?? ""}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-500">
            今天可以从一个项目、一个工作区或一句指令开始。常用能力集中在项目空间与 AI 助理。
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            {hasPerm("project:add") ? (
              <Link
                href="/projects?new=project"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-600"
              >
                <Plus size={15} /> 新建项目
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("collabspace:open-agent"))}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white/60 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-violet-700 hover:text-violet-800"
            >
              <Sparkles size={15} className="text-violet-700" /> 问问 AI 助理
            </button>
          </div>
        </div>
        <div className="hidden border-l-2 border-indigo-600 pl-6 lg:block">
          <p className="eyebrow">今日一句</p>
          <p className="display-title mt-3 text-[1.55rem] leading-[1.3] text-slate-800">
            先把一个项目
            <br />
            推进一格。
          </p>
          <div className="mt-6 space-y-2 text-xs text-slate-500">
            <p className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span>进行中项目</span>
              <span className="font-mono text-sm text-slate-900">{activeProjects.length}</span>
            </p>
            <p className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span>协作空间</span>
              <span className="font-mono text-sm text-slate-900">
                {org?._count?.workspaces ?? 0}
              </span>
            </p>
            <p className="flex items-center justify-between">
              <span>组织成员</span>
              <span className="font-mono text-sm text-slate-900">
                {org?._count?.memberships ?? 0}
              </span>
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 border-b border-slate-300 md:grid-cols-4">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`relative px-2 py-6 md:px-5 ${
              index ? "border-l border-slate-200" : ""
            }`}
          >
            <span className="absolute left-2 top-6 font-mono text-[10px] text-slate-300 md:left-5">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="display-title pl-6 text-[2.4rem] leading-none text-slate-900">
              {stat.value}
            </p>
            <p className="mt-2 pl-6 text-xs text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.8fr)]">
        <div className="space-y-10">
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">01 / 最近项目</p>
                <h2 className="display-title mt-2 text-2xl text-slate-900">正在发生的事</h2>
              </div>
              <Link
                href="/projects"
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline"
              >
                全部项目 <ArrowUpRight size={13} />
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="border-y border-slate-200 bg-white/40 px-6 py-12 text-center">
                <p className="display-title text-lg text-slate-500">还没有项目</p>
                {hasPerm("project:add") ? (
                  <Link
                    href="/projects?new=project"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline"
                  >
                    创建第一个项目 <ArrowRight size={12} />
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="border-t border-slate-300">
                {recent.map((project, index) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-200 py-4 transition hover:bg-white/70 md:grid-cols-[2.5rem_minmax(0,1fr)_8rem_auto]"
                  >
                    <span className="font-mono text-[11px] text-slate-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="display-title truncate text-[1.15rem] leading-tight text-slate-900 transition group-hover:text-indigo-700">
                        {project.name}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {project.workspace?.name ?? "工作区"} · {project._count?.tasks ?? 0} 个任务 ·{" "}
                        {project._count?.files ?? 0} 个文件
                      </p>
                    </div>
                    <div className="hidden text-right text-[11px] text-slate-400 md:block">
                      {new Date(project.updatedAt).toLocaleDateString("zh-CN")}
                    </div>
                    <Badge tone={STATUS_TONE[project.status]}>{STATUS_LABEL[project.status]}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">02 / 开始创作</p>
                <h2 className="display-title mt-2 text-2xl text-slate-900">从一张空白开始</h2>
              </div>
              <Link
                href="/collaboration"
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline"
              >
                协作空间 <ArrowUpRight size={13} />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden border border-slate-300 bg-slate-300 sm:grid-cols-5">
              {[
                { label: "文档", icon: FileText, hint: "DOC" },
                { label: "白板", icon: Network, hint: "CANVAS" },
                { label: "Word", icon: FileText, hint: "DOCX" },
                { label: "Excel", icon: FileSpreadsheet, hint: "XLSX" },
                { label: "PowerPoint", icon: Presentation, hint: "PPTX" },
              ].map((type) => {
                const Icon = type.icon;
                return (
                  <Link
                    key={type.label}
                    href="/collaboration"
                    className="group bg-[var(--paper-raised)] px-4 py-5 transition hover:bg-slate-900"
                  >
                    <span className="flex items-center justify-between">
                      <Icon size={18} className="text-slate-500 transition group-hover:text-white" />
                      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-300 group-hover:text-white/40">
                        {type.hint}
                      </span>
                    </span>
                    <span className="mt-8 block text-sm font-medium text-slate-800 transition group-hover:text-white">
                      {type.label}
                    </span>
                    <span className="mt-1 block text-[11px] text-slate-400 transition group-hover:text-white/50">
                      新建
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-8">
          <section>
            <p className="eyebrow">03 / 快捷入口</p>
            <div className="mt-3 border-t border-slate-300">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex items-center gap-3 border-b border-slate-200 py-3.5"
                  >
                    <span className="font-mono text-[10px] text-slate-300">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Icon size={16} className="text-slate-400 transition group-hover:text-indigo-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-800 transition group-hover:text-indigo-700">
                        {action.label}
                      </span>
                      <span className="block truncate text-[11px] text-slate-400">{action.hint}</span>
                    </span>
                    <ArrowRight
                      size={13}
                      className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600"
                    />
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="bg-[var(--ink)] p-6 text-[var(--paper)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/40">
                  AI 额度
                </p>
                <p className="display-title mt-2 text-[2.2rem] leading-none">{aiPct}%</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-sm bg-white/10 text-indigo-300">
                <Sparkles size={16} />
              </span>
            </div>
            <p className="mt-3 text-xs text-white/45">
              已用 {aiUsed.toLocaleString()} / {aiTotal.toLocaleString()} tokens
            </p>
            <div className="mt-3 h-1 overflow-hidden bg-white/15">
              <div
                className="h-full bg-indigo-500"
                style={{ width: `${Math.min(aiPct, 100)}%` }}
              />
            </div>
            <dl className="mt-6 space-y-2 text-xs text-white/50">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <dt>项目上限</dt>
                <dd className="font-mono text-white/80">{org?.entitlement?.maxProjects ?? "-"}</dd>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <dt>存储空间</dt>
                <dd className="font-mono text-white/80">
                  {org?.entitlement?.storageGb ?? "-"} GB
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>有效成员</dt>
                <dd className="font-mono text-white/80">{org?._count?.memberships ?? 0}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
