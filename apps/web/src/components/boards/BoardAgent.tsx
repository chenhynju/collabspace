"use client";
import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { compileBoardPlan } from "@/lib/board-agent-plan";
import { type BoardShape } from "@collabspace/protocol";
import { api } from "@/lib/api";
import { Button, inputCls } from "@/components/ui";
import { type DocumentProvider } from "@/lib/document-provider";
import { DictationInput } from "@/components/voice/DictationInput";

function messageOf(error: unknown) {
  const data = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data;
  const message = data?.message;
  if (Array.isArray(message)) return message.join("；");
  if (typeof message === "string" && message.trim()) return message;
  return "未生成有效提案。请检查模型配置，或等待白板同步后重试。";
}

export function BoardAgent({ provider, projectId, selected, origin, stopUndo }: {
  provider: DocumentProvider; projectId: string; selected: string; origin: string; stopUndo: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<(ReturnType<typeof compileBoardPlan> & { snapshot: string })>();
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const shapes = provider.doc.getMap<Y.Map<unknown>>("shapes");

  async function generate() {
    if (request.current) return;
    if (!provider.writable) {
      setError("当前为只读，不能生成修改提案。");
      return;
    }
    if (!provider.saved) {
      setError("白板还在同步，请等待“已保存到服务器”后再生成。");
      return;
    }
    if (!draft.trim()) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setPreview(undefined);
    setPending(false);
    try {
      const initial = shapes.toJSON() as Record<string, BoardShape>;
      const snapshot = JSON.stringify(initial);
      const ids = Object.keys(initial).filter((id) => initial[id].type !== "connector" && (!selected || id === selected)).slice(0, 20);
      const { data } = await api.post(`/documents/${provider.docId}/agent/plan`,
        { instruction: draft, ids }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const context = ids.map((id, index) => {
        const { type, text, geometry } = initial[id];
        return { ref: "s" + (index + 1), type, text: text.slice(0, 80), geometry };
      });
      if (JSON.stringify(data.shapes) !== JSON.stringify(context) ||
          snapshot !== JSON.stringify(shapes.toJSON())) throw Error("白板在生成期间发生变化，请重新生成。");
      setPreview({ ...compileBoardPlan(data.text, initial, ids), snapshot });
    } catch (e) {
      if (!controller.signal.aborted) setError(messageOf(e));
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function apply() {
    if (!preview || !provider.saved || !provider.writable) return;
    if (preview.snapshot !== JSON.stringify(shapes.toJSON())) {
      setError("白板已变化，请重新生成预览。");
      setPreview(undefined);
      return;
    }
    stopUndo();
    provider.doc.transact(() => {
      for (const [id, value] of preview.changes) {
        const existing = shapes.get(id);
        if (existing) {
          for (const key of ["type", "geometry", "text", "fill", "binding", "order"] as const) {
            if (value[key] !== undefined) existing.set(key, value[key]);
          }
        } else {
          shapes.set(id, new Y.Map(Object.entries(value)));
        }
      }
    }, origin);
    stopUndo();
    setPreview(undefined);
    setPending(true);
  }

  if (!provider.writable) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-[var(--paper-raised)] p-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "收起白板 Agent" : "白板 Agent"}
        </Button>
        <span className="text-[11px] text-slate-500">
          {selected ? "只修改当前选中图元" : "未选中时可在空白处新增图元"} · 生成后先预览
        </span>
        {!provider.saved && <span className="text-[11px] text-amber-700">等待白板同步…</span>}
      </div>
      {open && (
        <section aria-label="白板 Agent" className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">
          <label className="block text-xs font-medium text-slate-700">
            白板修改要求
            <textarea
              className={inputCls + " mt-1 w-full"}
              maxLength={700}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="例如：把这三个节点整理成“开始 → 处理 → 验收 → 交付”的流程图，并补上连接线。"
            />
          </label>
          <DictationInput projectId={projectId} onBusyChange={setRecording}
            onTranscript={(text) => setDraft((value) => [value, text].filter(Boolean).join("\n").slice(0, 700))} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={busy || recording || !provider.saved || !draft.trim()} onClick={generate}>
              {busy ? "生成中…" : "生成预览"}
            </Button>
            <span className="text-[11px] text-slate-500">支持新增矩形/椭圆/菱形/便签/文字/主题、改字、移动和连线</span>
          </div>
          {preview && (
            <div className="space-y-2 rounded-lg border border-indigo-200 bg-white p-2">
              <p className="text-xs font-medium text-slate-800">
                将执行 {preview.changes.size} 项变更
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-600">
                {preview.labels.map((label, i) => <li key={i}>{label}</li>)}
              </ul>
              <Button type="button" size="sm" disabled={!provider.saved} onClick={apply}>
                确认应用到白板
              </Button>
            </div>
          )}
          {pending && (
            <p role="status" className="text-xs text-slate-600">
              {provider.saved ? "白板修改已保存到服务器" : `等待服务器确认 · ${provider.status}`}
            </p>
          )}
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
        </section>
      )}
    </div>
  );
}
