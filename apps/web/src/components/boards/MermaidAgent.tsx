"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Mic, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";

export default function MermaidAgent({
  docId,
  source,
  writable,
  onApply,
}: {
  docId: string;
  source: string;
  writable: boolean;
  onApply: (next: string, before: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ text: string; before: string } | null>(null);
  const recognition = useRef<any>(null);
  const baseDraft = useRef("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const scope = window as any;
    setSpeechSupported(Boolean(scope.SpeechRecognition || scope.webkitSpeechRecognition));
    return () => recognition.current?.abort?.();
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  if (!writable) return null;

  const stop = () => {
    recognition.current?.stop?.();
    recognition.current = null;
    setListening(false);
  };

  const dictate = () => {
    const scope = window as any;
    const Recognition = scope.SpeechRecognition || scope.webkitSpeechRecognition;
    if (!Recognition) {
      setError("当前浏览器不支持语音输入，请使用最新版 Edge 或 Chrome。");
      return;
    }
    if (listening) {
      stop();
      return;
    }
    setError("");
    baseDraft.current = draft;
    const next = new Recognition();
    recognition.current = next;
    next.lang = "zh-CN";
    next.interimResults = true;
    next.continuous = false;
    next.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1)
        transcript += event.results[i][0].transcript;
      const base = baseDraft.current.trim();
      setDraft(((base ? base + " " : "") + transcript.trim()).slice(0, 700));
    };
    next.onerror = (event: any) => {
      if (event.error !== "aborted")
        setError(
          event.error === "not-allowed"
            ? "麦克风权限被拒绝，请允许后重试。"
            : "语音识别失败，请改用键盘输入。",
        );
      recognition.current = null;
      setListening(false);
    };
    next.onend = () => {
      recognition.current = null;
      setListening(false);
    };
    try {
      next.start();
      setListening(true);
    } catch {
      setError("无法启动语音输入，请检查麦克风权限。");
    }
  };

  const generate = async () => {
    if (!draft.trim() || busy) return;
    if (listening) stop();
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const { data } = await api.post(`/documents/${docId}/agent/mermaid`, {
        instruction: draft.trim(),
      });
      setPreview({ text: data.text, before: data.before });
    } catch (e: any) {
      setError(e.response?.data?.message || "没有生成可用图表，请补充要求后重试。");
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!preview) return;
    try {
      onApply(preview.text, preview.before);
      setPreview(null);
      setOpen(false);
      setDraft("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="border-b border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          <Sparkles size={13} className="text-indigo-300" /> AI 生成图表
        </button>
      </div>
      {open ? (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-1.5">
            <input
              ref={input}
              aria-label="图表修改要求"
              value={draft}
              maxLength={700}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void generate();
                }
                if (event.key === "Escape") setOpen(false);
              }}
              placeholder="例如：画一个三步审批流程，通过后进入发布"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
            <button
              type="button"
              aria-label={listening ? "停止语音输入" : "语音输入图表要求"}
              aria-pressed={listening}
              disabled={busy || !speechSupported}
              title={speechSupported ? "语音输入" : "当前浏览器不支持语音输入"}
              onClick={dictate}
              className={`grid h-8 w-8 place-items-center rounded-lg disabled:opacity-40 ${
                listening ? "animate-pulse bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
              }`}
            >
              <Mic size={14} />
            </button>
            <button
              type="button"
              disabled={busy || !draft.trim()}
              onClick={() => void generate()}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:bg-indigo-300"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : null}
              {busy ? "生成中" : "生成"}
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-[11px] leading-5 text-red-600">
              {error}
            </p>
          ) : null}
          {preview ? (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-2">
              <p className="text-[11px] font-medium text-indigo-950">
                预览：确认后才会替换当前图表
              </p>
              <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-[10px] leading-4 text-slate-600">
                {preview.text.length > 1200 ? preview.text.slice(0, 1200) + "\n…" : preview.text}
              </pre>
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={apply}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white"
                >
                  <Check size={12} /> 应用到图表
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-slate-500"
                >
                  <X size={12} /> 放弃
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
