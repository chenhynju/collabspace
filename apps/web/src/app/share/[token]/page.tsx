"use client";
import { useEffect, useId, useState } from "react";
import dynamic from "next/dynamic";
const BoardDrawing = dynamic(
  () => import("@/components/boards/Whiteboard").then((m) => m.BoardDrawing),
  { ssr: false },
);
const MermaidPreview = dynamic(
  () => import("@/components/boards/MermaidPreview").then((m) => m.MermaidPreview),
  { ssr: false },
);
type Share = {
  title: string;
  kind: string;
  snapshot: any;
  expiresAt: string | null;
  createdAt: string;
};
function SharedBoard({ items }: { items: any[] }) {
  const marker = useId().replace(/:/g, "");
  if (!items.length)
    return <p className="p-10 text-center text-sm text-slate-400">该快照没有可显示的图元。</p>;
  const xs = items.flatMap((s) =>
    s.points ? [s.points.x1, s.points.x2] : [s.geometry.x, s.geometry.x + s.geometry.w],
  );
  const ys = items.flatMap((s) =>
    s.points ? [s.points.y1, s.points.y2] : [s.geometry.y, s.geometry.y + s.geometry.h],
  );
  const x = Math.min(0, ...xs) - 40,
    y = Math.min(0, ...ys) - 40;
  const w = Math.max(900, ...xs) - x + 40,
    h = Math.max(600, ...ys) - y + 40;
  return (
    <svg
      aria-label="公开只读白板"
      viewBox={`${x} ${y} ${w} ${h}`}
      className="min-h-[70vh] w-full bg-white"
    >
      <BoardDrawing items={items} marker={marker} />
    </svg>
  );
}
export default function SharePage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<Share | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";
    fetch(`${base}/shares/${encodeURIComponent(params.token)}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(
            r.status === 410 || body?.code === "SHARE_REVOKED" || body?.code === "SHARE_EXPIRED"
              ? "该分享链接已过期或被撤销。"
              : r.status === 404
                ? "该分享链接不存在。"
                : "分享内容加载失败，请稍后重试。",
          );
        }
        return r.json();
      })
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [params.token]);
  if (error)
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="eyebrow">Read only share</p>
        <h1 className="display-title mt-2 text-2xl text-slate-900">无法打开分享</h1>
        <p className="mt-3 text-sm text-slate-500">{error}</p>
      </main>
    );
  if (!data)
    return (
      <main className="p-10 text-sm text-slate-500" role="status">
        正在加载只读快照…
      </main>
    );
  const snapshot = data.snapshot;
  return (
    <div className="min-h-[100dvh] bg-[var(--paper)]">
      <header className="border-b border-slate-300 bg-[var(--paper-raised)] px-5 py-4 md:px-10">
        <p className="eyebrow">Read only share</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="display-title text-2xl text-slate-900">{data.title}</h1>
          <span className="rounded-sm border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
            只读
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {data.expiresAt
            ? `链接有效期至 ${new Date(data.expiresAt).toLocaleString("zh-CN")}`
            : "链接长期有效，可由分享者随时撤销"}
          {" · 外部快照，不包含组织内其他内容"}
        </p>
      </header>
      <main className="p-3 md:p-6">
        {data.kind === "BOARD" && snapshot?.view === "mermaid" ? (
          <MermaidPreview source={String(snapshot.source || "")} />
        ) : data.kind === "BOARD" && Array.isArray(snapshot?.items) ? (
          <SharedBoard items={snapshot.items} />
        ) : typeof snapshot === "string" ? (
          <article className="collab-editor whitespace-pre-wrap rounded-sm border border-slate-300 bg-white p-6 text-sm leading-7 text-slate-800">
            {snapshot}
          </article>
        ) : (
          <pre className="overflow-auto rounded-sm border border-slate-300 bg-white p-6 text-xs text-slate-700">
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        )}
      </main>
    </div>
  );
}
