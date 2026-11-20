"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, Check, Loader2, Mic, ShieldAlert, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

type Risk = "low" | "medium" | "high";
type AgentAction = {
  id: string;
  tool: string;
  label: string;
  detail: string;
  method: "POST" | "PATCH" | "DELETE" | "NAVIGATE";
  path: string;
  body?: Record<string, unknown>;
  permission?: string;
  risk?: Risk;
};
type AgentReply = {
  reply: string;
  source: "rules" | "model";
  actions?: AgentAction[];
  data?: unknown;
};
type ActionState = "idle" | "running" | "done" | "error";
type Message = {
  id: string;
  role: "user" | "agent";
  text: string;
  source?: "rules" | "model";
  actions?: AgentAction[];
  actionState?: Record<string, ActionState>;
  actionError?: Record<string, string>;
  pending?: boolean;
};

const SUGGESTIONS = [
  { label: "看看有哪些项目", prompt: "列出所有项目" },
  { label: "新建工作区", prompt: "新建工作区「」" },
  { label: "新建项目", prompt: "新建项目「」到工作区「」" },
  { label: "给项目加任务", prompt: "给项目「」添加任务「」" },
  { label: "画一个流程图", prompt: "给项目「」画一个三步审批流程图" },
];

const RISK_LABEL: Record<Risk, string> = { low: "低风险", medium: "需确认", high: "高风险" };

export default function AgentDock({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const hasPerm = useAuthStore((s) => s.hasPerm);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const dictation = useRef<any>(null);
  const dictationBase = useRef("");

  useEffect(() => {
    const scope = window as any;
    setSpeechSupported(Boolean(scope.SpeechRecognition || scope.webkitSpeechRecognition));
    return () => {
      dictation.current?.abort?.();
      dictation.current = null;
    };
  }, []);

  useEffect(() => {
    setMessages([]);
    setInput("");
    setVoiceError("");
    dictation.current?.abort?.();
    dictation.current = null;
    setListening(false);
  }, [currentOrgId]);

  useEffect(() => {
    if (!open) {
      dictation.current?.abort?.();
      dictation.current = null;
      setListening(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    composer.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab") {
        const nodes = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),textarea:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]',
          ) || [],
        ).filter((node) => node.getClientRects().length);
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (!first) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, [open, onClose]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  if (!open) return null;

  const stopDictation = () => {
    dictation.current?.stop?.();
    dictation.current = null;
    setListening(false);
  };

  const toggleDictation = () => {
    if (busy) return;
    const scope = window as any;
    const Recognition = scope.SpeechRecognition || scope.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceError("当前浏览器不支持语音输入，请使用最新版 Edge 或 Chrome。");
      return;
    }
    if (listening) {
      stopDictation();
      return;
    }
    setVoiceError("");
    dictationBase.current = input;
    const recognition = new Recognition();
    dictation.current = recognition;
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1)
        transcript += event.results[i][0].transcript;
      const base = dictationBase.current.trim();
      setInput(((base ? base + " " : "") + transcript.trim()).slice(0, 500));
    };
    recognition.onerror = (event: any) => {
      if (event.error !== "aborted") {
        setVoiceError(
          event.error === "not-allowed"
            ? "麦克风权限被拒绝，请在浏览器地址栏允许麦克风后重试。"
            : event.error === "no-speech"
              ? "没有识别到语音，请靠近麦克风后重试。"
              : event.error === "network"
                ? "浏览器语音服务不可用，请检查网络或改用键盘输入。"
                : "语音输入失败，请重试或改用键盘输入。",
        );
      }
      dictation.current = null;
      setListening(false);
    };
    recognition.onend = () => {
      dictation.current = null;
      setListening(false);
    };
    try {
      recognition.start();
      setListening(true);
    } catch {
      dictation.current = null;
      setListening(false);
      setVoiceError("无法启动语音输入，请检查麦克风权限。");
    }
  };

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    if (listening) stopDictation();
    setBusy(true);
    setInput("");
    const userMessage: Message = { id: "u" + Date.now(), role: "user", text };
    const pending: Message = {
      id: "a" + Date.now(),
      role: "agent",
      text: "正在理解你的指令…",
      pending: true,
    };
    setMessages((list) => [...list, userMessage, pending]);
    try {
      const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
      const { data } = await api.post<AgentReply>("/agent/chat", {
        message: text,
        ...(projectMatch ? { projectId: projectMatch[1] } : {}),
      });
      setMessages((list) =>
        list.map((item) =>
          item.id === pending.id
            ? {
                ...item,
                text: data.reply,
                source: data.source,
                actions: data.actions ?? [],
                actionState: Object.fromEntries((data.actions ?? []).map((a) => [a.id, "idle"])),
                pending: false,
              }
            : item,
        ),
      );
    } catch (e: any) {
      const message =
        e.response?.data?.message ??
        e.response?.data?.code ??
        "助理暂时不可用，请稍后重试；页面数据和权限没有变化。";
      setMessages((list) =>
        list.map((item) =>
          item.id === pending.id
            ? { ...item, text: String(message), pending: false, source: "rules" }
            : item,
        ),
      );
    } finally {
      setBusy(false);
      composer.current?.focus();
    }
  };

  const execute = async (messageId: string, action: AgentAction) => {
    if (action.permission && !hasPerm(action.permission)) {
      setMessages((list) =>
        list.map((item) =>
          item.id === messageId
            ? {
                ...item,
                actionState: { ...item.actionState, [action.id]: "error" },
                actionError: { ...item.actionError, [action.id]: "当前角色缺少此操作权限。" },
              }
            : item,
        ),
      );
      return;
    }
    if (action.method === "NAVIGATE") {
      onClose();
      router.push(action.path);
      return;
    }
    if (action.tool === "draw_diagram") {
      try {
        const { data } = await api.post("/documents/agent/draw", action.body);
        onClose();
        router.push(`/projects/${data.projectId}/documents/${data.id}`);
        return;
      } catch (e: any) {
        const detail =
          e.response?.data?.message ??
          e.response?.data?.code ??
          "图表生成失败，请检查模型配置后重试。";
        setMessages((list) =>
          list.map((item) =>
            item.id === messageId
              ? {
                  ...item,
                  actionState: { ...item.actionState, [action.id]: "error" },
                  actionError: { ...item.actionError, [action.id]: String(detail) },
                }
              : item,
          ),
        );
        return;
      }
    }
    setMessages((list) =>
      list.map((item) =>
        item.id === messageId
          ? { ...item, actionState: { ...item.actionState, [action.id]: "running" } }
          : item,
      ),
    );
    try {
      const response = await api.request({
        method: action.method,
        url: action.path,
        data: action.body,
      });
      if (action.tool === "create_content" && response.data?.id && action.body?.projectId) {
        onClose();
        router.push(`/projects/${String(action.body.projectId)}/documents/${response.data.id}`);
        return;
      }
      setMessages((list) =>
        list.map((item) =>
          item.id === messageId
            ? {
                ...item,
                actionState: { ...item.actionState, [action.id]: "done" },
                actionError: { ...item.actionError, [action.id]: "" },
              }
            : item,
        ),
      );
      window.dispatchEvent(new Event("collabspace:data-changed"));
      router.refresh();
    } catch (e: any) {
      const detail =
        e.response?.data?.message ?? e.response?.data?.code ?? "执行失败，请检查权限或稍后重试。";
      setMessages((list) =>
        list.map((item) =>
          item.id === messageId
            ? {
                ...item,
                actionState: { ...item.actionState, [action.id]: "error" },
                actionError: { ...item.actionError, [action.id]: String(detail) },
              }
            : item,
        ),
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        aria-label="关闭 AI 助理遮罩"
        className="absolute inset-0 bg-slate-950/25 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="AI 工作助理"
        className="absolute inset-y-0 right-0 flex w-[440px] max-w-[96vw] flex-col border-l border-slate-200/80 bg-[#fbfbfd] shadow-[0_24px_80px_-24px_rgba(15,23,42,0.45)] animate-[agent-dock-in_200ms_cubic-bezier(.2,.8,.2,1)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200/70 bg-white px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/30">
              <Sparkles size={17} />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">AI 工作助理</h2>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                读取当前组织数据；写操作先出计划，确认后执行。
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭 AI 助理"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </header>

        <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                <p className="text-sm font-medium text-indigo-950">可以直接用自然语言安排工作</p>
                <p className="mt-1 text-xs leading-5 text-indigo-900/70">
                  例如「列出项目」「在工作区『顾问』下新建项目『官网改版』」「给项目『官网改版』画一个三步审批流程图」。
                  写操作和画图都会先生成计划，再由你确认执行。
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setInput(item.prompt);
                      composer.current?.focus();
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/50"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] leading-5 text-slate-500">
                可操作范围：工作区与项目、任务、邀请、成员状态、文档/白板创建、文件与项目数据查询。权限仍由服务端逐次校验，
                助理不会绕过组织边界。
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="space-y-2">
                {message.role === "user" ? (
                  <div className="flex justify-end">
                    <p className="max-w-[88%] rounded-2xl rounded-br-md bg-slate-900 px-3.5 py-2.5 text-sm leading-6 text-white">
                      {message.text}
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-2.5">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 ring-1 ring-slate-200">
                      <Sparkles size={13} />
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-[0_2px_10px_-6px_rgba(15,23,42,0.15)]">
                        {message.pending ? (
                          <p className="flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 size={14} className="animate-spin" /> {message.text}
                          </p>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                            {message.text}
                          </p>
                        )}
                        {message.source ? (
                          <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-slate-400">
                            {message.source === "model" ? "模型规划" : "本地规则规划"}
                          </p>
                        ) : null}
                      </div>
                      {message.actions?.map((action) => {
                        const state = message.actionState?.[action.id] ?? "idle";
                        const blocked =
                          !!action.permission && !hasPerm(action.permission)
                            ? "当前角色无权限"
                            : "";
                        return (
                          <div
                            key={action.id}
                            className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_6px_-4px_rgba(15,23,42,0.2)]"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800">
                                  {action.label}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                  {action.detail}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  action.risk === "high"
                                    ? "bg-red-50 text-red-700"
                                    : action.risk === "medium"
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {RISK_LABEL[action.risk ?? "medium"]}
                              </span>
                            </div>
                            {message.actionError?.[action.id] ? (
                              <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-5 text-red-600">
                                <ShieldAlert size={12} className="mt-0.5 shrink-0" />
                                {message.actionError[action.id]}
                              </p>
                            ) : null}
                            <div className="mt-2.5 flex items-center justify-between gap-2">
                              <span className="text-[10px] text-slate-400">
                                {blocked ||
                                  (state === "done"
                                    ? "已完成"
                                    : state === "error"
                                      ? "未执行"
                                      : "需要你确认后才会写入")}
                              </span>
                              <button
                                type="button"
                                disabled={state === "running" || state === "done" || !!blocked}
                                onClick={() => execute(message.id, action)}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                  action.risk === "high"
                                    ? "bg-red-600 text-white hover:bg-red-700"
                                    : "bg-slate-900 text-white hover:bg-slate-800"
                                }`}
                              >
                                {state === "running" ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : state === "done" ? (
                                  <Check size={12} />
                                ) : null}
                                {state === "done" ? "已执行" : "确认执行"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-slate-200/70 bg-white px-4 py-3">
          <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500/10">
            <textarea
              ref={composer}
              aria-label="给 AI 助理的消息"
              rows={2}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="描述你要完成的工作，例如：列出所有项目"
              className="max-h-28 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="button"
              aria-label={listening ? "停止语音输入" : "语音输入"}
              aria-pressed={listening}
              title={
                !speechSupported
                  ? "当前浏览器不支持语音输入，请使用最新版 Edge 或 Chrome"
                  : listening
                    ? "停止语音输入"
                    : "用麦克风说出指令"
              }
              disabled={busy || !speechSupported}
              onClick={toggleDictation}
              className={`mb-0.5 grid h-9 w-9 place-items-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-40 ${
                listening
                  ? "animate-pulse bg-red-50 text-red-600"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              }`}
            >
              <Mic size={16} />
            </button>
            <button
              type="button"
              aria-label="发送"
              disabled={busy || !input.trim()}
              onClick={() => void send()}
              className="mb-0.5 grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:bg-slate-300"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          </div>
          <p
            className={`mt-2 text-[10px] leading-4 ${voiceError ? "text-red-600" : "text-slate-400"}`}
          >
            {voiceError ||
              (listening
                ? "正在听… 再次点击麦克风停止；识别结果会写入输入框，确认后再发送。"
                : !speechSupported
                  ? "当前浏览器不支持语音输入，请使用最新版 Edge 或 Chrome；仍可键盘输入。"
                  : "Enter 发送 · Shift+Enter 换行 · 麦克风使用浏览器语音识别，写操作仍需确认。")}
          </p>
        </div>
      </div>
    </div>
  );
}
