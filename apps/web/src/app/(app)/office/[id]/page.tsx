"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  Download,
  FileCog,
  FileSpreadsheet,
  FileText,
  History,
  Menu,
  Presentation,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Badge, Button } from "@/components/ui";
import { OfficeImagePreparation } from "@/components/office-image-preparation";
import { OfficeFileActions } from "@/components/office-file-actions";
import { OfficeDetailsPanel, type OfficePanelTab } from "@/components/office-details-panel";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "所有者",
  EDITOR: "可编辑",
  VIEWER: "只读",
};
const ROLE_TONE: Record<string, "violet" | "green" | "blue" | "slate"> = {
  OWNER: "violet",
  EDITOR: "green",
  VIEWER: "blue",
};
const PHASE_LABEL: Record<string, string> = {
  OPEN: "已连接",
  CLOSING: "正在保存",
  CLOSED: "已关闭",
  FROZEN: "已冻结",
};
const EXT_STYLE: Record<string, { label: string; tile: string; accent: string }> = {
  docx: {
    label: "Word",
    tile: "bg-blue-50 text-blue-600 ring-blue-100",
    accent: "text-blue-600",
  },
  xlsx: {
    label: "Excel",
    tile: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    accent: "text-emerald-600",
  },
  pptx: {
    label: "PowerPoint",
    tile: "bg-orange-50 text-orange-600 ring-orange-100",
    accent: "text-orange-600",
  },
};

function RailButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  active,
  primary,
  expanded,
}: {
  label: string;
  icon: typeof Save;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  primary?: boolean;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-10 shrink-0 place-items-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-40 ${
        primary
          ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700"
          : active
            ? "bg-slate-900 text-white shadow-sm"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <Icon className="size-[18px]" aria-hidden="true" />
    </button>
  );
}

export default function OfficePage({ params }: { params: { id: string } }) {
  const [panel, setPanel] = useState<OfficePanelTab | null>(null);
  const router = useRouter(),
    restoreIds = useRef<Record<string, string>>({});
  const org = useAuthStore((s) => s.currentOrgId),
    [state, setState] = useState<any>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [members, setMembers] = useState<any[]>([]),
    [grants, setGrants] = useState<any[]>([]),
    [target, setTarget] = useState(""),
    [role, setRole] = useState("EDITOR"),
    [grantBusy, setGrantBusy] = useState(false),
    [epoch, setEpoch] = useState(0);
  const editor = useRef<any>(null),
    alive = useRef(false),
    inFlight = useRef(false),
    base = "/office/" + params.id;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    alive.current = true;
    setReady(false);
    setState(null);
    setError("");
    setMessage("正在载入 Office 编辑服务…");
    setMembers([]);
    setGrants([]);
    const headers = { "x-organization-id": org };
    let sessionId: string | undefined,
      waitingClose = false;
    const stop = () => {
      editor.current?.destroyEditor();
      editor.current = null;
      if (active) setReady(false);
    };
    const poll = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const r = await api.get(base + "/state", { headers, params: { sessionId } });
        if (!active) return;
        setState(r.data);
        if (r.data.phase === "FROZEN") {
          stop();
          setError("会话已冻结：权限变更、连接过期或保存冲突。未确认的保存会保留为恢复候选。");
        } else if (r.data.phase === "CLOSING") {
          waitingClose = true;
          stop();
          setMessage("正在等待上一轮编辑的最终保存完成，请稍候。");
        } else if (r.data.phase === "CLOSED" && (sessionId || waitingClose)) {
          waitingClose = true;
          stop();
          setEpoch((v) => v + 1);
        } else if (waitingClose && !editor.current) {
          setEpoch((v) => v + 1);
        }
      } catch (e: any) {
        if (active) {
          if ([401, 403, 404].includes(e.response?.status)) {
            stop();
            setError("访问已撤销或登录已失效。");
          } else setMessage("网络中断，尚未确认服务器保存；请保留编辑器并重试。");
        }
      } finally {
        inFlight.current = false;
      }
    };
    void api
        .post(base + "/config", {}, { headers })
        .then(async (r) => {
          if (!active) return;
          sessionId = r.data.sessionId;
          if (!(window as any).DocsAPI)
            await new Promise<void>((resolve, reject) => {
              const s = document.createElement("script");
              s.src = r.data.publicUrl.replace(/\/$/, "") + "/web-apps/apps/api/documents/api.js";
              s.onload = () => resolve();
              s.onerror = () => reject(Error("编辑服务加载失败"));
              document.head.appendChild(s);
            });
          if (!active) return;
          editor.current = new (window as any).DocsAPI.DocEditor("office-editor", {
            ...r.data.config,
            events: {
              onDocumentReady: () => {
                if (active) {
                  setReady(true);
                  setMessage("编辑器已连接；“编辑器已保存”与服务器版本号分别核对。");
                }
              },
              onDocumentStateChange: (e: any) => {
                if (active && e.data) setMessage("正在编辑，等待服务器保存确认。");
              },
              onError: (e: any) => {
                if (active)
                  setMessage(
                    "编辑服务错误 " +
                      String(e.data?.errorCode ?? "UNKNOWN") +
                      "，请保留当前页面并检查保存状态。",
                  );
              },
            },
          });
          await poll();
          if (r.data.role === "OWNER") {
            const results = await Promise.all([
              api.get("/members", { headers }),
              api.get("/documents/" + params.id + "/grants", { headers }),
            ]);
            if (active) {
              setMembers(results[0].data);
              setGrants(results[1].data);
            }
          }
        })
        .catch((e: any) => {
          if (active) {
            if (e.response?.data?.code === "OFFICE_CLOSING") {
              waitingClose = true;
              setMessage("正在等待上一轮编辑的最终保存完成，请稍候。");
            } else
              setError(
                e.response?.data?.code === "OFFICE_NOT_CONFIGURED"
                  ? "Office 编辑服务尚未配置：请启动 ONLYOFFICE DocumentServer，并在服务端配置 OFFICE_PUBLIC_URL、OFFICE_INTERNAL_URL、OFFICE_JWT_SECRET、OFFICE_CAPABILITY_SECRET。"
                  : e.response?.data?.code === "OFFICE_RECOVERY_REQUIRED"
                    ? "会话需要所有者确认恢复。"
                    : e.message || "无法打开 Office 文件。",
              );
          }
          void poll();
        });
    const timer = setInterval(() => {
      void poll();
    }, 2000);
    return () => {
      active = false;
      alive.current = false;
      clearInterval(timer);
      stop();
    };
  }, [base, org, epoch, params.id]);

  const download = async (version?: string) => {
    try {
      const r = await api.get(base + "/download", { params: { version }, responseType: "blob" });
      const url = URL.createObjectURL(r.data),
        a = document.createElement("a");
      a.href = url;
      a.download = state?.title || "document";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage("下载失败，请检查权限或网络。");
    }
  };
  const save = async () => {
    try {
      const r = await api.post(base + "/save");
      setMessage(
        r.data.error === 0
          ? "已请求检查点；请等待服务器版本号更新。"
          : r.data.error === 4
            ? "引擎没有新增更改。"
            : "检查点请求失败。",
      );
    } catch {
      setMessage("保存请求失败，内容未确认持久化。");
    }
  };
  const updateGrant = async () => {
    if (!target) return;
    setGrantBusy(true);
    try {
      await api.put("/documents/" + params.id + "/grants", { userId: target, role });
      setGrants((await api.get("/documents/" + params.id + "/grants")).data);
      setMessage("权限已更新，活动会话会重新校验。");
    } catch {
      setMessage("权限更新失败。");
    } finally {
      setGrantBusy(false);
    }
  };
  const restore = async (version: { id: string; revision: number | null }) => {
    try {
      const requestId =
        restoreIds.current[version.id] || (restoreIds.current[version.id] = crypto.randomUUID());
      const r = await api.post(base + "/restore", { versionId: version.id, requestId });
      router.push("/office/" + r.data.id);
    } catch {
      setMessage("恢复副本失败，请检查权限后重试；原文件不受影响。");
    }
  };
  const restart = async () => {
    try {
      await api.post(base + "/restart", { generation: state.generation });
      setEpoch((v) => v + 1);
    } catch {
      setMessage("恢复失败，请重新核对会话状态。");
    }
  };

  const extension = String(state?.extension || "").toLowerCase();
  const fileStyle = EXT_STYLE[extension];
  const FileIcon =
    extension === "xlsx" ? FileSpreadsheet : extension === "pptx" ? Presentation : FileText;
  const editable = ["OWNER", "EDITOR"].includes(state?.role);
  const phase = state?.phase || "";
  const statusTone =
    phase === "OPEN" && ready
      ? "bg-emerald-500"
      : phase === "FROZEN"
        ? "bg-red-500"
        : phase === "CLOSING"
          ? "bg-amber-500"
          : "bg-slate-300";
  const users = Array.isArray(state?.users) ? state.users.slice(0, 4) : [];
  const userCount = Array.isArray(state?.users) ? state.users.length : 0;
  const openPanel = (next: OfficePanelTab) => setPanel(next);
  const actions = (
    <>
      <RailButton
        label="保存到服务器"
        icon={Save}
        primary
        disabled={!editable || phase !== "OPEN"}
        onClick={save}
      />
      <RailButton label="下载最新保存版本" icon={Download} onClick={() => download()} />
      <span className="my-1 h-px w-6 bg-slate-200" />
      <RailButton
        label="历史版本"
        icon={History}
        active={panel === "history"}
        expanded={panel === "history"}
        onClick={() => openPanel("history")}
      />
      {state?.role === "OWNER" && (
        <RailButton
          label="共享权限"
          icon={ShieldCheck}
          active={panel === "access"}
          expanded={panel === "access"}
          onClick={() => openPanel("access")}
        />
      )}
      <RailButton
        label="文件"
        icon={FileCog}
        active={panel === "files"}
        expanded={panel === "files"}
        onClick={() => openPanel("files")}
      />
      <span className="my-1 h-px w-6 bg-slate-200" />
      <RailButton
        label="打开 AI 工作助理"
        icon={Sparkles}
        onClick={() => window.dispatchEvent(new Event("collabspace:open-agent"))}
      />
      <RailButton
        label="打开导航"
        icon={Menu}
        onClick={() => window.dispatchEvent(new Event("collabspace:open-nav"))}
      />
    </>
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--paper)] text-slate-900">
      <header className="flex flex-none items-center gap-2 border-b border-slate-300 bg-[color-mix(in_srgb,var(--paper-raised)_95%,transparent)] px-2.5 py-2 backdrop-blur-md lg:gap-3 lg:px-4">
        <Link
          aria-label="返回协作空间"
          href={state?.projectId ? "/projects/" + state.projectId + "/content" : "/collaboration"}
          className="grid size-9 shrink-0 place-items-center rounded-sm text-slate-500 transition hover:bg-slate-900 hover:text-white"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Link>
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-sm ring-1 ring-inset ${
            fileStyle?.tile ?? "bg-slate-100 text-slate-500 ring-slate-200"
          }`}
        >
          <FileIcon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow hidden sm:block">Office Studio</p>
          <h1 className="display-title truncate text-lg leading-tight text-slate-900 lg:text-xl">
            {state?.title || "Office 协作文件"}
          </h1>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-slate-500">
            {state?.role && (
              <Badge tone={ROLE_TONE[state.role] ?? "slate"}>
                {ROLE_LABEL[state.role] ?? state.role}
              </Badge>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className={`size-1.5 ${statusTone}`} />
              {PHASE_LABEL[phase] ?? "正在连接"}
            </span>
            {state && <span className="hidden font-mono text-[10px] text-slate-400 sm:inline">v{state.revision ?? "—"}</span>}
            {fileStyle && (
              <span className={`hidden md:inline ${fileStyle.accent}`}>{fileStyle.label}</span>
            )}
            {userCount > 0 && (
              <span
                className="ml-0.5 hidden items-center -space-x-1 sm:inline-flex"
                aria-label="在线参与者"
              >
                {users.map((user: any) => (
                  <span
                    key={user.id}
                    title={user.name}
                    className="grid size-5 place-items-center rounded-sm bg-indigo-600 text-[9px] font-semibold text-white ring-2 ring-[var(--paper-raised)]"
                  >
                    {String(user.name || "?").slice(0, 1)}
                  </span>
                ))}
                {userCount > users.length && (
                  <span className="grid size-5 place-items-center rounded-sm bg-slate-300 text-[9px] font-semibold text-slate-700 ring-2 ring-[var(--paper-raised)]">
                    +{userCount - users.length}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-none items-center gap-1 overflow-x-auto border-b border-slate-300 bg-[color-mix(in_srgb,var(--paper-raised)_70%,transparent)] px-2 py-1.5 lg:hidden">
        {actions}
      </div>

      {error && (
        <div
          role="alert"
          className="mx-2 mt-2 flex flex-none flex-wrap items-center gap-2 border-l-2 border-indigo-600 bg-indigo-50 px-3 py-2 text-xs text-indigo-800 lg:mx-3"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{error}</span>
          {phase === "FROZEN" && state?.role === "OWNER" && (
            <Button size="sm" variant="danger" onClick={restart}>
              确认从最后保存版本重新打开
            </Button>
          )}
        </div>
      )}
      {state?.error && phase !== "FROZEN" && (
        <div className="mx-2 mt-2 flex flex-none flex-wrap items-center gap-2 border-l-2 border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900 lg:mx-3">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            有未合并的保存结果，当前版本号仅代表已确认保存。
          </span>
          <Button size="sm" variant="secondary" onClick={() => setPanel("history")}>
            查看恢复候选
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-2 p-2 lg:gap-3 lg:p-3">
        <nav
          aria-label="文件操作"
          className="hidden w-14 shrink-0 flex-col items-center gap-1 rounded-sm border border-slate-300 bg-[var(--paper-raised)] p-2 lg:flex"
        >
          {actions}
        </nav>

        <main className="relative flex min-w-0 flex-1 flex-col gap-2">
          <section
            data-office-ready={ready}
            className="relative min-h-[360px] min-w-0 flex-1 overflow-hidden rounded-sm border border-slate-300 bg-white"
          >
            {!ready && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-white/90 backdrop-blur-[2px]">
                <div className="text-center">
                  <span className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-slate-50 text-slate-400">
                    <FileIcon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="mx-auto mb-3 block size-7 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
                  <p className="text-sm text-slate-500">
                    {error ? "编辑服务未连接" : "正在连接 Office 编辑服务…"}
                  </p>
                </div>
              </div>
            )}
            <div id="office-editor" className="h-full w-full" />
          </section>
        </main>

        <OfficeDetailsPanel
          open={!!panel}
          tab={panel ?? "history"}
          onTab={setPanel}
          onClose={() => setPanel(null)}
          role={state?.role}
          revision={state?.revision}
          phase={PHASE_LABEL[phase] ?? phase}
          versions={state?.versions || []}
          members={members}
          grants={grants}
          target={target}
          grantRole={role}
          onTarget={setTarget}
          onGrantRole={setRole}
          onGrant={updateGrant}
          grantBusy={grantBusy}
          onDownloadVersion={(versionId) => void download(versionId)}
          onRestore={(version) => void restore(version)}
        >
          {state && (
            <OfficeFileActions
              key={"file-actions:" + org + ":" + params.id}
              documentId={params.id}
              title={state.title}
              role={state.role}
              versions={state.versions || []}
              onRenamed={(title) => setState((s: any) => ({ ...s, title }))}
              onCopy={(id) => router.push("/office/" + id)}
            />
          )}
          {ready && editable && (
            <OfficeImagePreparation key={"image-preparation:" + org + ":" + params.id} />
          )}
          <details className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-slate-700">
              编辑工具在哪里？工作表、函数、图片与图形
            </summary>
            <div className="mt-2 space-y-2 leading-5">
              <p>
                <strong className="font-medium text-slate-700">表格 · .xlsx</strong>
                ：底部工作表标签旁的 ＋ 新建工作表；选中单元格后在公式栏输入
                =VLOOKUP(...)，也可从“公式”选项卡插入函数。
              </p>
              <p>
                <strong className="font-medium text-slate-700">幻灯片 · .pptx</strong>
                ：顶部“插入”可选形状、图片或文本框；选中对象后拖动位置与控制点调整样式。
              </p>
              <p>
                <strong className="font-medium text-slate-700">文档 · .docx</strong>
                ：“开始”调整文字与段落；“插入”添加图片、表格和链接。只读成员无法使用编辑工具。
              </p>
              <p className="text-slate-400">
                工具栏若被折叠，双击“开始 / 插入”等选项卡展开；原生编辑器的保存提示与服务器版本号分别核对。
              </p>
            </div>
          </details>
        </OfficeDetailsPanel>
      </div>

      <footer className="flex flex-none items-center gap-3 border-t border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-500 lg:px-4">
        <span className={`size-1.5 shrink-0 rounded-full ${statusTone}`} />
        <span role="status" className="min-w-0 flex-1 truncate">
          {message || "就绪"}
        </span>
        {state && (
          <span className="hidden shrink-0 sm:inline">
            服务器 v{state.revision ?? "—"} · {PHASE_LABEL[phase] ?? phase}
          </span>
        )}
        <span className="hidden shrink-0 md:inline">{fileStyle?.label ?? "Office"}</span>
      </footer>
    </div>
  );
}
