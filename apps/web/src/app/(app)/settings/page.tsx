"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search, Shield, UserCog } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card, Empty, Input } from "@/components/ui";
import { SETTINGS_NAV, canSee } from "@/components/navigation";
import { useAuthStore } from "@/store/auth";

const HINTS: Record<string, string> = {
  "/members": "成员状态、角色与组织归属",
  "/invitations": "邀请、撤回与过期处理",
  "/depts": "部门树、岗位与数据范围",
  "/roles": "角色权限矩阵与菜单授权",
  "/audit": "操作审计与 trace_id 追溯",
  "/notices": "组织公告与已读范围",
  "/system/menus": "菜单与按钮权限标识",
  "/system/dicts": "业务字典与选项维护",
  "/system/configs": "运行参数与开关",
  "/system/login-logs": "登录记录与异常排查",
  "/monitor/online": "当前在线会话",
  "/monitor/server": "服务与资源状态",
  "/monitor/cache": "缓存命中与容量",
  "/monitor/jobs": "定时任务与执行记录",
  "/monitor/database": "数据库会话与慢查询",
};

export default function SettingsPage() {
  const hasPerm = useAuthStore((s) => s.hasPerm);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    return SETTINGS_NAV.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          canSee(hasPerm, item) &&
          (!term ||
            item.label.toLowerCase().includes(term) ||
            (HINTS[item.href] ?? "").toLowerCase().includes(term) ||
            group.label.toLowerCase().includes(term)),
      ),
    })).filter((group) => group.items.length);
  }, [query, hasPerm]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="设置"
        description="成员、权限、审计与系统能力集中在这里；日常协作仍留在项目空间与协作空间。"
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索设置项"
            aria-label="搜索设置项"
            className="pl-9"
          />
        </div>
        <Link
          href="/account/security"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          <Shield size={15} className="text-slate-400" />
          账号安全
          <ArrowUpRight size={13} className="text-slate-300" />
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="space-y-6">
          <Empty
            text={
              query
                ? "没有匹配的设置项"
                : "当前角色没有可管理的组织或系统设置；日常项目协作仍可正常使用。"
            }
          />
          <PersonalSection />
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {group.label}
                </h2>
                <span className="h-px flex-1 bg-slate-200/70" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className="group block">
                      <Card className="flex h-full items-start gap-3 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_14px_34px_-22px_rgba(15,23,42,0.35)]">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-indigo-50 group-hover:text-indigo-600">
                          <Icon size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-800">{item.label}</span>
                            <ArrowUpRight
                              size={13}
                              className="shrink-0 text-slate-300 transition group-hover:text-indigo-500"
                            />
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">
                            {HINTS[item.href] ?? item.hint ?? "组织与系统设置"}
                          </span>
                        </span>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          <PersonalSection />
        </div>
      )}
    </div>
  );
}

function PersonalSection() {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">个人</h2>
        <span className="h-px flex-1 bg-slate-200/70" />
      </div>
      <Link href="/account/security" className="group block">
        <Card className="flex items-start gap-3 p-4 transition hover:border-slate-300">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600">
            <UserCog size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-sm font-medium text-slate-800">账号与安全</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">
              修改密码、登录状态与账号信息
            </span>
          </span>
        </Card>
      </Link>
    </section>
  );
}
