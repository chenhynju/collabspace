"use client";
import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { compileBoardPlan } from "@/lib/board-agent-plan";
import { type BoardShape } from "@collabspace/protocol";
import { api } from "@/lib/api";
import { Button, inputCls } from "@/components/ui";
import { type DocumentProvider } from "@/lib/document-provider";
import { DictationInput } from "@/components/voice/DictationInput";

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
    if (request.current || !provider.saved || !provider.writable || !draft.trim()) return;
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
          snapshot !== JSON.stringify(shapes.toJSON())) throw Error("Snapshot changed");
      setPreview({ ...compileBoardPlan(data.text, initial, ids), snapshot });
    } catch {
      if (!controller.signal.aborted) setError("未生成有效提案。请检查模型配置，或等待白板同步后重试。");
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
        if (existing) existing.set("geometry", value.geometry);
        else shapes.set(id, new Y.Map(Object.entries(value)));
      }
    }, origin);
    stopUndo();
    setPreview(undefined);
    setPending(true);
  }

  if (!provider.writable) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
      <Button type="button" variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>白板 Agent</Button>
      {open && (
        <section aria-label="白板 Agent" className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3">
          <label className="block text-sm">白板修改要求
            <textarea className={inputCls + " mt-1 w-full"} maxLength={700} value={draft}
              onChange={(event) => setDraft(event.target.value)} />
          </label>
          <DictationInput projectId={projectId} onBusyChange={setRecording}
            onTranscript={(text) => setDraft((value) => [value, text].filter(Boolean).join("\n").slice(0, 700))} />
          <p className="text-[11px] leading-5 text-slate-500">选中图形时只修改该图形；未选中时使用最多 20 个图元。生成后先预览，确认才写入。</p>
          <Button type="button" disabled={busy || recording || !provider.saved || !draft.trim()} onClick={generate}>生成白板预览</Button>
          {preview && <div className="space-y-2">
            <ul className="list-disc pl-5 text-sm">{preview.labels.map((label, i) => <li key={i}>{label}</li>)}</ul>
            <Button type="button" disabled={!provider.saved} onClick={apply}>确认应用到白板</Button>
          </div>}
          {pending && <p role="status">{provider.saved ? "白板修改已保存到服务器" : `等待服务器确认 · ${provider.status}`}</p>}
          {error && <p role="alert">{error}</p>}
        </section>
      )}
    </div>
  );
}
