"use client";
import { useEffect } from "react";
import type { ReactNode } from "react";
import {
  Clock3,
  Download,
  FileCog,
  History,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { Badge, Button, Select } from "@/components/ui";
import { displayDate } from "@/lib/display-date";

export type OfficePanelTab = "history" | "access" | "files";
export type OfficeVersion = { id: string; revision: number | null; created_at?: string };

const GRANT_LABEL: Record<string, string> = {
  OWNER: "所有者",
  EDITOR: "可编辑",
  VIEWER: "只读",
};
const GRANT_TONE: Record<string, "violet" | "green" | "blue" | "slate"> = {
  OWNER: "violet",
  EDITOR: "green",
  VIEWER: "blue",
};
const TAB_TITLE: Record<OfficePanelTab, string> = {
  history: "版本历史",
  access: "访问权限",
  files: "文件工具",
};

export function OfficeDetailsPanel({
  open,
  tab,
  onTab,
  onClose,
  role,
  revision,
  phase,
  versions,
  members,
  grants,
  target,
  grantRole,
  onTarget,
  onGrantRole,
  onGrant,
  grantBusy,
  onDownloadVersion,
  onRestore,
  children,
}: {
  open: boolean;
  tab: OfficePanelTab;
  onTab: (tab: OfficePanelTab) => void;
  onClose: () => void;
  role?: string;
  revision?: number;
  phase?: string;
  versions: OfficeVersion[];
  members: any[];
  grants: any[];
  target: string;
  grantRole: string;
  onTarget: (value: string) => void;
  onGrantRole: (value: string) => void;
  onGrant: () => void;
  grantBusy: boolean;
  onDownloadVersion: (versionId?: string) => void;
  onRestore: (version: OfficeVersion) => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [open, onClose]);

  const owner = role === "OWNER";
  const editable = owner || role === "EDITOR";
  const confirmed = versions
    .filter((version) => version.revision)
    .sort((a, b) => Number(b.revision) - Number(a.revision));
  const candidates = versions.filter((version) => !version.revision);
  const tabs: { key: OfficePanelTab; label: string; icon: typeof History; shown: boolean }[] = [
    { key: "history", label: "版本", icon: History, shown: true },
    { key: "access", label: "权限", icon: ShieldCheck, shown: owner },
    { key: "files", label: "文件", icon: FileCog, shown: true },
  ];
  const ActiveIcon = tabs.find((item) => item.key === tab)?.icon ?? History;

  return (
    <div
      className={
        open
          ? "absolute inset-0 z-30 flex lg:static lg:z-auto lg:w-[22rem] lg:shrink-0"
          : "hidden"
      }
    >
      <button
        type="button"
        aria-label="关闭文件详情"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/25 backdrop-blur-[1px] lg:hidden"
      />
      <aside
        role="dialog"
        aria-label="文件详情"
        aria-modal="false"
        id="office-details-panel"
        className="office-panel-in relative z-10 ml-auto flex h-full w-full max-w-[26rem] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl lg:max-w-none lg:rounded-2xl lg:border lg:shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)]"
      >
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
              <ActiveIcon className="size-3.5" aria-hidden="true" />
            </span>
            <h2 className="truncate text-sm font-semibold text-slate-900">{TAB_TITLE[tab]}</h2>
          </div>
          <button
            type="button"
            aria-label="收起文件详情"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mx-3 flex gap-1 rounded-xl bg-slate-100 p-1">
          {tabs
            .filter((item) => item.shown)
            .map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onTab(item.key)}
                  className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[11px] font-medium transition ${
                    active
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <section className={tab === "history" ? "space-y-3" : "hidden"}>
            <div className="flex items-center justify-between px-0.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                已保存版本与恢复候选
              </h3>
              <span className="text-[11px] text-slate-400">{confirmed.length} 个版本</span>
            </div>
            {confirmed.length === 0 && candidates.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-xs text-slate-400">
                还没有已确认保存的版本。
              </p>
            )}
            <ul className="space-y-2">
              {confirmed.map((version) => (
                <li
                  key={version.id}
                  data-office-version={version.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 transition hover:border-indigo-200 hover:shadow-sm"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Clock3 className="size-3.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">版本 {version.revision}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        {displayDate(version.created_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`下载版本 ${version.revision}`}
                      onClick={() => onDownloadVersion(version.id)}
                      className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Download className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  {editable && (
                    <div className="mt-2 flex justify-end">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onRestore(version)}
                        className="gap-1.5"
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        恢复为私有副本
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {candidates.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                <p className="text-xs font-semibold text-amber-800">隔离恢复候选（未合并）</p>
                <p className="mt-1 text-[11px] leading-5 text-amber-700">
                  这些内容没有合并进当前文件，下载后人工核对；不会覆盖已确认版本。
                </p>
                <ul className="mt-2 space-y-1.5">
                  {candidates.map((version) => (
                    <li key={version.id} data-office-version={version.id}>
                      <button
                        type="button"
                        onClick={() => onDownloadVersion(version.id)}
                        className="inline-flex w-full items-center justify-between gap-2 rounded-lg bg-white/70 px-2.5 py-2 text-left text-[11px] text-amber-900 transition hover:bg-white"
                      >
                        <span>{displayDate(version.created_at) || "未合并内容"}</span>
                        <Download className="size-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className={tab === "access" ? "space-y-3" : "hidden"}>
            {owner ? (
              <>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-[11px] font-medium text-slate-500">添加或调整成员</p>
                  <Select
                    aria-label="Office 授权成员"
                    className="mt-2"
                    value={target}
                    onChange={(event) => onTarget(event.target.value)}
                  >
                    <option value="">选择成员</option>
                    {members.map((member: any) => (
                      <option key={member.id} value={member.userId}>
                        {member.user.name}
                      </option>
                    ))}
                  </Select>
                  <div className="mt-2 flex items-center gap-2">
                    <Select
                      aria-label="Office 成员权限"
                      className="flex-1"
                      value={grantRole}
                      onChange={(event) => onGrantRole(event.target.value)}
                    >
                      <option value="EDITOR">编辑</option>
                      <option value="VIEWER">只读</option>
                      <option value="REMOVE">撤销访问</option>
                    </Select>
                    <Button
                      size="sm"
                      onClick={onGrant}
                      disabled={!target || grantBusy}
                      className="shrink-0"
                    >
                      {grantBusy ? "更新中…" : "更新权限"}
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="px-0.5 text-[11px] font-medium text-slate-500">当前授权</p>
                  {grants.length === 0 ? (
                    <p className="mt-2 rounded-xl bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-400">
                      尚未单独授权。项目成员按项目角色访问。
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {grants.map((grant: any) => (
                        <li
                          key={grant.user_id}
                          className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2"
                        >
                          <span className="grid size-8 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                            {String(grant.name || "?").slice(0, 1)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                            {grant.name}
                          </span>
                          <Badge tone={GRANT_TONE[grant.role] ?? "slate"}>
                            {GRANT_LABEL[grant.role] ?? grant.role}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <p className="rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">
                  <ShieldCheck className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
                  同组织成员还需具备所属项目访问权；权限失效会冻结会话，阻止旧会话覆盖保存结果。
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500">只有文件所有者可以调整访问权限。</p>
            )}
          </section>

          <div className={tab === "files" ? "space-y-3" : "hidden"}>{children}</div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
          <span>服务器版本 v{revision || "—"}</span>
          <span>{phase || "正在连接"}</span>
        </div>
      </aside>
    </div>
  );
}
