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
import { Card, Badge } from "@/components/ui";
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
    { href: "/im", label: "消息", hint: "团队沟通与会议", icon: MessageSquare, perm: "im:view" },
    {
      href: "/files",
      label: "附件",
      hint: "项目文件、版本与共享",
      icon: Files,
      perm: "file:manage",
    },
  ].filter((action) => !action.perm || hasPerm(action.perm));

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white px-6 py-7 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.4)] md:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-100 via-violet-100 to-transparent blur-2xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              {org?.name ?? "当前组织"} · {org?.plan?.name ?? "套餐"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 md:text-[2.1rem]">
              你好，{user?.name ?? ""}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              今天可以从一个项目、一个工作区或一句指令开始。导航已收进菜单，常用能力集中在项目空间与
              AI 助理。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasPerm("project:add") ? (
              <Link
                href="/projects?new=project"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                <Plus size={15} /> 新建项目
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("collabspace:open-agent"))}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50"
            >
              <Sparkles size={15} className="text-indigo-500" /> 问问 AI 助理
            </button>
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-2xl font-semibold tracking-tight text-slate-900">{stat.value}</p>
            <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">最近项目</h2>
                <p className="mt-0.5 text-xs text-slate-400">按最近更新排序，点击进入项目详情</p>
              </div>
              <Link
                href="/projects"
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-700"
              >
                全部项目 <ArrowUpRight size={13} />
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
                <p className="text-sm text-slate-500">还没有项目</p>
                {hasPerm("project:add") ? (
                  <Link
                    href="/projects?new=project"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                  >
                    创建第一个项目 <ArrowRight size={12} />
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recent.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="group -mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 group-hover:text-indigo-700">
                        {project.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {project.workspace?.name ?? "工作区"} · {project._count?.tasks ?? 0} 个任务
                        · {project._count?.files ?? 0} 个文件
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[project.status]}>{STATUS_LABEL[project.status]}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">开始创作</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  文档、白板与 Office 文件在协作空间统一创建
                </p>
              </div>
              <Link
                href="/collaboration"
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-700"
              >
                协作空间 <ArrowUpRight size={13} />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                { label: "文档", icon: FileText, color: "bg-indigo-50 text-indigo-600" },
                { label: "白板", icon: Network, color: "bg-violet-50 text-violet-600" },
                { label: "Word", icon: FileText, color: "bg-blue-50 text-blue-600" },
                { label: "Excel", icon: FileSpreadsheet, color: "bg-emerald-50 text-emerald-600" },
                { label: "PowerPoint", icon: Presentation, color: "bg-orange-50 text-orange-600" },
              ].map((type) => {
                const Icon = type.icon;
                return (
                  <Link
                    key={type.label}
                    href="/collaboration"
                    className="group rounded-xl border border-slate-100 px-3 py-3 transition hover:border-indigo-100 hover:bg-indigo-50/40"
                  >
                    <span className={`grid h-8 w-8 place-items-center rounded-lg ${type.color}`}>
                      <Icon size={15} />
                    </span>
                    <span className="mt-2 block text-xs font-medium text-slate-700">
                      {type.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-800">快捷入口</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 transition hover:border-indigo-100 hover:bg-indigo-50/40"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-indigo-600">
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-700">
                        {action.label}
                      </span>
                      <span className="block truncate text-[11px] text-slate-400">
                        {action.hint}
                      </span>
                    </span>
                    <ArrowRight size={13} className="text-slate-300 group-hover:text-indigo-500" />
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">AI 助手额度</h2>
              <span className="text-[11px] text-slate-400">{aiPct}%</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              已用 {aiUsed.toLocaleString()} / {aiTotal.toLocaleString()} tokens
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                style={{ width: `${Math.min(aiPct, 100)}%` }}
              />
            </div>
            <div className="mt-4 space-y-1.5 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>项目上限</span>
                <span className="font-medium text-slate-700">
                  {org?.entitlement?.maxProjects ?? "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>存储空间</span>
                <span className="font-medium text-slate-700">
                  {org?.entitlement?.storageGb ?? "-"} GB
                </span>
              </div>
              <div className="flex justify-between">
                <span>有效成员</span>
                <span className="font-medium text-slate-700">{org?._count?.memberships ?? 0}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
