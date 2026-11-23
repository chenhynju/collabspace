"use client";
import { exportDiagram } from "@/lib/diagram-export";
import { flowSvgLayout, type CanvasNode } from "@/lib/mermaid-svg-layout";
import {
  addFlowNode,
  connectFlowNodes,
  deleteFlowNodes,
  renameFlowEdge,
  renameFlowNode,
  type FlowEdge,
  isFlowSource,
} from "@/lib/mermaid-edit";
import {
  positionNode,
  removeNodePositions,
  nodePositions,
  assertPositionable,
} from "@/lib/mermaid-position";
import type { DiagramShape } from "@/lib/diagram-catalog";
import { useEffect, useState, useRef } from "react";
let renderQueue: Promise<unknown> = Promise.resolve();
let serial = 0;
function explainMermaidError(message: string) {
  const raw = message.slice(0, 1000);
  if (/No diagram type detected/i.test(raw))
    return {
      title: "首行需要写图表类型：flowchart LR（流程图）或 mindmap（思维导图）。",
      detail: raw,
    };
  if (/Parse error|Lexical error|Expecting|got '/i.test(raw)) {
    const line = raw.match(/(?:line|Line)\s+(\d+)/)?.[1];
    return {
      title: `图表语法不完整${line ? `（第 ${line} 行附近）` : ""}。请检查括号、引号是否成对，或切到源码视图修正。`,
      detail: raw,
    };
  }
  return { title: raw, detail: "" };
}
// All diagrams, including historical snapshots, go through one pinned official
// renderer. Never attach untrusted SVG or bind Mermaid click handlers in the app.
export function MermaidPreview({
  source,
  writable = false,
  commit,
  selectedIds = [],
  onSelect,
}: {
  source: string;
  writable?: boolean;
  commit?: (before: string, after: string) => void;
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
}) {
  const [canvas, setCanvas] = useState<{
      edges: ReturnType<typeof flowSvgLayout>["edges"];
      nodes: CanvasNode[];
      width: number;
      height: number;
    }>({
      edges: [],
      nodes: [],
      width: 1000,
      height: 800,
    }),
    [actionError, setActionError] = useState("");
  const viewport = useRef<HTMLDivElement>(null),
    drag = useRef<{
      id: string;
      x: number;
      y: number;
      px: number;
      py: number;
      source: string;
      left: number;
      top: number;
    }>();
  const [edgeKind, setEdgeKind] = useState<"arrow" | "line" | "dashed" | "bold" | "both">("arrow"),
    [edgeLabel, setEdgeLabel] = useState("");
  const [connectStart, setConnectStart] = useState<string | null>(null);
  type TextTarget = { node: string } | { edge: FlowEdge };
  const [editor, setEditor] = useState<{
    target: TextTarget;
    before: string;
    value: string;
    x: number;
    y: number;
  } | null>(null);
  const openNode = (n: CanvasNode) =>
    setEditor({ target: { node: n.id }, before: source, value: n.label, x: n.x, y: n.y });
  const finishText = () => {
    if (!editor) return;
    try {
      const { target, before, value } = editor;
      const next =
        "node" in target
          ? renameFlowNode(before, target.node, value)
          : renameFlowEdge(before, target.edge, value);
      if (mutate(before, next)) setEditor(null);
    } catch (err) {
      setActionError((err as Error).message);
    }
  };
  const [wire, setWire] = useState<{
    from: string;
    x: number;
    y: number;
    sx: number;
    sy: number;
    source: string;
  } | null>(null);
  const wireRef = useRef<typeof wire>(null);
  const cancelWire = () => {
    wireRef.current = null;
    setWire(null);
  };
  const interactive = !!commit && (!source.trim() || isFlowSource(source));
  const mutate = (before: string, next: string) => {
    try {
      if (!writable) throw Error("当前文档只读。");
      commit?.(before, next);
      setActionError("");
      return true;
    } catch (e) {
      setActionError((e as Error).message);
      return false;
    }
  };
  const remove = () => {
    try {
      const next = deleteFlowNodes(source, selectedIds);
      mutate(source, next);
      onSelect?.([]);
    } catch (e) {
      setActionError((e as Error).message);
    }
  };
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [rendered, setRendered] = useState<{ source: string; svg: string } | null>(null),
    [zoom, setZoom] = useState(100),
    [exportError, setExportError] = useState(""),
    [exporting, setExporting] = useState(false);
  useEffect(() => {
    let alive = true;
    cancelWire();
    setConnectStart(null);
    setHtml("");
    setRendered(null);
    setExportError("");
    setCanvas((c) => ({ ...c, nodes: [] }));
    setError("");
    setErrorDetail("");
    const timer = setTimeout(() => {
      renderQueue = renderQueue
        .catch(() => {})
        .then(async () => {
          if (!alive || !source.trim()) return;
          // Configuration is application-owned. Source directives cannot relax it.
          if (
            source.length > 32000 ||
            /%%\s*\{|^\s*---\s*$|https?:|data:|javascript:|\/\/|\bimg\s*:|url\s*\(|!\[|<\/?[a-z!]/im.test(
              source,
            )
          ) {
            if (alive)
              setError(
                "源码超过限制，或包含禁用的配置指令、外部地址 / HTML。请只输入 Mermaid 图表语法。",
              );
            return;
          }
          const { default: mermaid } = await import("mermaid");
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            htmlLabels: false,
            maxTextSize: 32000,
            maxEdges: 500,
            suppressErrorRendering: true,
            secure: [
              "securityLevel",
              "startOnLoad",
              "maxTextSize",
              "maxEdges",
              "htmlLabels",
              "secure",
            ],
          });
          const host = document.createElement("div");
          host.style.cssText = "position:fixed;left:-100000px;top:0;width:1200px;visibility:hidden";
          document.body.appendChild(host);
          try {
            await mermaid.parse(source);
            const { svg: rawSvg } = await mermaid.render(`collabMermaid${++serial}`, source, host);
            const layout = flowSvgLayout(source, rawSvg),
              svg = layout.svg;
            if (alive) {
              setCanvas(layout);
              setRendered({ source, svg });
              setHtml(
                `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"><style>body{margin:0;font-family:system-ui}svg{max-width:100%;height:auto}a{pointer-events:none}</style></head><body>${svg}</body></html>`,
              );
            }
          } catch (e) {
            if (alive) {
              setHtml("");
              const explained = explainMermaidError(
                e instanceof Error ? e.message : "图表语法无法解析",
              );
              setError(explained.title);
              setErrorDetail(explained.detail);
            }
          } finally {
            host.remove();
          }
        })
        .catch(() => {
          if (alive) setError("图表渲染器加载失败，请重试或重新打开页面。");
        });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [source]);
  return (
    <div
      className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white"
      aria-label="Mermaid 图形预览"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 p-2 text-xs">
        <span className="font-medium text-slate-600">{interactive ? "图形画布" : "画布预览"}</span>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded border bg-white px-2 py-1"
            disabled={zoom <= 50}
            onClick={() => setZoom((z) => Math.max(50, z - 25))}
          >
            缩小
          </button>
          <button
            className="rounded border bg-white px-2 py-1"
            onClick={() =>
              setZoom(
                Math.max(
                  25,
                  Math.min(
                    100,
                    Math.floor(
                      ((viewport.current?.clientWidth || canvas.width) / canvas.width) * 100,
                    ),
                  ),
                ),
              )
            }
          >
            {zoom}% · 适应画布
          </button>
          <button
            className="rounded border bg-white px-2 py-1"
            disabled={zoom >= 200}
            onClick={() => setZoom((z) => Math.min(200, z + 25))}
          >
            放大
          </button>
          {(["svg", "png", "pdf", "html"] as const).map((format) => (
            <button
              key={format}
              disabled={!rendered || rendered.source !== source || exporting}
              className="rounded border bg-white px-2 py-1 disabled:opacity-40"
              onClick={async () => {
                if (!rendered || rendered.source !== source) return;
                setExporting(true);
                setExportError("");
                try {
                  await exportDiagram(rendered.svg, format);
                } catch (e) {
                  setExportError((e as Error).message);
                } finally {
                  setExporting(false);
                }
              }}
            >
              导出 {format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {interactive && (
        <div className="flex flex-wrap gap-2 border-b p-2 text-xs">
          <button
            type="button"
            disabled={!writable || !selectedIds.length}
            className="rounded border px-3 py-2 disabled:opacity-40"
            onClick={remove}
          >
            删除选中图元
          </button>
          <button type="button" className="rounded border px-3 py-2" onClick={() => onSelect?.([])}>
            取消选择
          </button>
          <button
            type="button"
            disabled={!writable || !source.includes("%% collab-position ")}
            className="rounded border px-3 py-2 disabled:opacity-40"
            onClick={() =>
              mutate(
                source,
                removeNodePositions(source, new Set(Object.keys(nodePositions(source)))),
              )
            }
          >
            恢复自动布局
          </button>
          <span>已选 {selectedIds.length} 个</span>
          <details className="text-slate-400">
            <summary className="cursor-pointer text-slate-500">画布操作说明</summary>
            <div className="mt-1 max-w-xl leading-5">
              从左侧拖入形状；拖动形状移动位置；Shift 点选可多选；Delete 删除；双击形状或按 F2
              改字。拖动蓝色连接点连线，点击线条编辑文字。
            </div>
          </details>
        </div>
      )}
      {interactive && (
        <div className="flex flex-wrap items-center gap-2 border-b p-2 text-xs">
          <button
            type="button"
            disabled={!writable}
            aria-pressed={connectStart !== null}
            className="rounded border px-3 py-2 aria-pressed:bg-indigo-100"
            onClick={() => setConnectStart(connectStart === null ? "" : null)}
          >
            依次点选连线
          </button>
          {connectStart !== null && (
            <span role="status">{connectStart ? "请选择终点" : "请选择起点"}</span>
          )}
          <label>
            连线样式{" "}
            <select
              aria-label="画布连线样式"
              disabled={!writable}
              value={edgeKind}
              onChange={(e) => setEdgeKind(e.target.value as typeof edgeKind)}
              className="rounded border p-1"
            >
              <option value="arrow">单向箭头</option>
              <option value="line">无箭头</option>
              <option value="dashed">虚线箭头</option>
              <option value="bold">粗线箭头</option>
              <option value="both">双向箭头</option>
            </select>
          </label>
          <label>
            连线文字{" "}
            <input
              aria-label="画布连线文字"
              disabled={!writable}
              maxLength={80}
              value={edgeLabel}
              onChange={(e) => setEdgeLabel(e.target.value)}
              className="rounded border p-1"
            />
          </label>
          {wire && <span role="status">拖到目标图元后松开；Esc取消</span>}
        </div>
      )}
      {actionError && (
        <p role="alert" className="p-2 text-sm text-red-700">
          {actionError}
        </p>
      )}
      {exportError && (
        <p role="alert" className="p-2 text-sm text-red-700">
          {exportError}
        </p>
      )}
      {error ? (
        <div role="alert" className="m-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
          <p className="font-medium leading-6 text-red-800">{error}</p>
          {errorDetail ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-red-600">查看原始错误</summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white/70 p-2 text-[11px] leading-5 text-red-700">
                {errorDetail}
              </pre>
            </details>
          ) : null}
        </div>
      ) : (html && rendered?.source === source) || (interactive && !source.trim()) ? (
        <div ref={viewport} className="h-[640px] overflow-auto">
          <div
            aria-label="Mermaid 图形画布"
            tabIndex={interactive ? 0 : undefined}
            className="relative outline-none"
            style={
              interactive
                ? { width: (canvas.width * zoom) / 100, height: (canvas.height * zoom) / 100 }
                : { width: `${zoom}%`, minWidth: 300, height: (640 * zoom) / 100 }
            }
            onKeyDown={(e) => {
              if (e.key === "Escape") cancelWire();
              if (
                interactive &&
                writable &&
                selectedIds.length &&
                (e.key === "Delete" || e.key === "Backspace") &&
                e.target === e.currentTarget
              ) {
                e.preventDefault();
                remove();
              }
            }}
            onDragOver={(e) => {
              if (interactive && writable) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (!interactive || !writable) return;
              const kind = e.dataTransfer.getData("application/x-collab-mermaid");
              if (!kind) return;
              const box = e.currentTarget.getBoundingClientRect(),
                id = "N" + crypto.randomUUID().replaceAll("-", "").slice(0, 12);
              try {
                const added = addFlowNode(
                  source,
                  e.dataTransfer.getData("application/x-collab-label") || "新节点",
                  kind as DiagramShape,
                  id,
                );
                mutate(
                  source,
                  positionNode(
                    added,
                    id,
                    Math.max(20, ((e.clientX - box.left) * 100) / zoom),
                    Math.max(20, ((e.clientY - box.top) * 100) / zoom),
                  ),
                );
                onSelect?.([id]);
              } catch (err) {
                setActionError((err as Error).message);
              }
            }}
          >
            <iframe
              title="Mermaid 图表"
              sandbox=""
              referrerPolicy="no-referrer"
              srcDoc={html}
              style={{
                width: "100%",
                height: "100%",
                pointerEvents: interactive ? "none" : undefined,
              }}
              className="border-0"
            />
            {interactive && writable && (
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${canvas.width} ${canvas.height}`}
                className="pointer-events-none absolute inset-0"
                aria-label="画布连线"
              >
                {canvas.edges.map(({ edge, d, x, y, labelAt }) => {
                  const edit = (path: SVGPathElement) => {
                    const point = path.getPointAtLength(path.getTotalLength() / 2);
                    setEditor({
                      target: { edge },
                      before: source,
                      value: edge.label,
                      x: point.x + x,
                      y: point.y + y,
                    });
                  };
                  return (
                    <g key={edge.start}>
                      <path
                        d={d}
                        transform={`translate(${x} ${y})`}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={16}
                        pointerEvents="stroke"
                        role="button"
                        tabIndex={0}
                        aria-label={`编辑连线 ${edge.from} 到 ${edge.to} ${edge.label}`.trim()}
                        className="cursor-text hover:stroke-indigo-300/50 focus:stroke-indigo-300/50"
                        onClick={(e) => edit(e.currentTarget)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "F2") {
                            e.preventDefault();
                            edit(e.currentTarget);
                          }
                        }}
                      />
                      {labelAt && (
                        <rect
                          x={labelAt.x}
                          y={labelAt.y - 10}
                          width={Math.max(20, edge.label.length * 14)}
                          height={20}
                          transform={`translate(${-Math.max(20, edge.label.length * 14) / 2} 0)`}
                          fill="transparent"
                          pointerEvents="all"
                          className="cursor-text"
                          onClick={() =>
                            setEditor({
                              target: { edge },
                              before: source,
                              value: edge.label,
                              ...labelAt,
                            })
                          }
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
            {interactive &&
              canvas.nodes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  aria-label={"画布图元 " + n.label}
                  aria-pressed={selectedIds.includes(n.id)}
                  disabled={!writable}
                  className={
                    "absolute -translate-x-1/2 -translate-y-1/2 rounded border-2 bg-transparent focus-visible:outline-indigo-500 " +
                    (selectedIds.includes(n.id)
                      ? "border-indigo-500"
                      : "border-transparent hover:border-indigo-300")
                  }
                  style={{
                    left: (n.x * zoom) / 100,
                    top: (n.y * zoom) / 100,
                    width: (n.width * zoom) / 100,
                    height: (n.height * zoom) / 100,
                    touchAction: "none",
                    cursor: "move",
                  }}
                  title="双击或按 F2 编辑文字"
                  onDoubleClick={() => {
                    if (writable && connectStart === null) openNode(n);
                  }}
                  onClick={(e) => {
                    if (connectStart !== null) {
                      if (!connectStart) setConnectStart(n.id);
                      else {
                        try {
                          if (
                            mutate(
                              source,
                              connectFlowNodes(source, connectStart, n.id, edgeKind, edgeLabel),
                            )
                          )
                            setConnectStart(null);
                        } catch (err) {
                          setActionError((err as Error).message);
                        }
                      }
                      return;
                    }
                    if (e.shiftKey)
                      onSelect?.(
                        selectedIds.includes(n.id)
                          ? selectedIds.filter((id) => id !== n.id)
                          : [...selectedIds, n.id],
                      );
                    else onSelect?.([n.id]);
                  }}
                  onKeyDown={(e) => {
                    if (writable && e.key === "F2") {
                      e.preventDefault();
                      openNode(n);
                      return;
                    }
                    if (writable && (e.key === "Delete" || e.key === "Backspace")) {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        mutate(
                          source,
                          deleteFlowNodes(
                            source,
                            selectedIds.includes(n.id) ? selectedIds : [n.id],
                          ),
                        );
                        onSelect?.([]);
                      } catch (err) {
                        setActionError((err as Error).message);
                      }
                    }
                  }}
                  onPointerDown={(e) => {
                    if (!writable || connectStart !== null) return;
                    if (!e.shiftKey && !selectedIds.includes(n.id)) onSelect?.([n.id]);
                    const box = e.currentTarget.parentElement!.getBoundingClientRect();
                    drag.current = {
                      id: n.id,
                      x: n.x,
                      y: n.y,
                      px: e.clientX,
                      py: e.clientY,
                      source,
                      left: box.left,
                      top: box.top,
                    };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const d = drag.current;
                    if (!d || d.id !== n.id) return;
                    e.currentTarget.style.left = `${(d.x * zoom) / 100 + e.clientX - d.px}px`;
                    e.currentTarget.style.top = `${(d.y * zoom) / 100 + e.clientY - d.py}px`;
                  }}
                  onPointerCancel={(e) => {
                    drag.current = undefined;
                    e.currentTarget.style.left = `${(n.x * zoom) / 100}px`;
                    e.currentTarget.style.top = `${(n.y * zoom) / 100}px`;
                  }}
                  onPointerUp={(e) => {
                    const d = drag.current;
                    drag.current = undefined;
                    if (!d || Math.hypot(e.clientX - d.px, e.clientY - d.py) < 4) return;
                    try {
                      mutate(
                        d.source,
                        positionNode(
                          d.source,
                          d.id,
                          Math.max(20, d.x + ((e.clientX - d.px) * 100) / zoom),
                          Math.max(20, d.y + ((e.clientY - d.py) * 100) / zoom),
                        ),
                      );
                    } catch (err) {
                      e.currentTarget.style.left = `${(n.x * zoom) / 100}px`;
                      e.currentTarget.style.top = `${(n.y * zoom) / 100}px`;
                      setActionError((err as Error).message);
                    }
                  }}
                />
              ))}
            {wire && (
              <svg
                aria-label="连线拖动预览"
                className="pointer-events-none absolute inset-0"
                width="100%"
                height="100%"
              >
                <line
                  x1={(wire.sx * zoom) / 100}
                  y1={(wire.sy * zoom) / 100}
                  x2={(wire.x * zoom) / 100}
                  y2={(wire.y * zoom) / 100}
                  stroke="#4f46e5"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                />
              </svg>
            )}
            {interactive &&
              writable &&
              canvas.nodes.map((n) => (
                <button
                  key={"port-" + n.id}
                  type="button"
                  aria-label={"从 " + n.label + " 拖动连线"}
                  className="absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-indigo-600 shadow focus-visible:outline-indigo-500"
                  style={{
                    left: ((n.x + n.width / 2) * zoom) / 100,
                    top: (n.y * zoom) / 100,
                    touchAction: "none",
                    cursor: "crosshair",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") cancelWire();
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.focus({ preventScroll: true });
                    const next = {
                      from: n.id,
                      sx: n.x + n.width / 2,
                      sy: n.y,
                      x: n.x + n.width / 2,
                      y: n.y,
                      source,
                    };
                    wireRef.current = next;
                    setWire(next);
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const d = wireRef.current;
                    if (!d) return;
                    const box = e.currentTarget.parentElement!.getBoundingClientRect();
                    const next = {
                      ...d,
                      x: ((e.clientX - box.left) * 100) / zoom,
                      y: ((e.clientY - box.top) * 100) / zoom,
                    };
                    wireRef.current = next;
                    setWire(next);
                  }}
                  onPointerCancel={cancelWire}
                  onLostPointerCapture={cancelWire}
                  onPointerUp={(e) => {
                    const d = wireRef.current;
                    cancelWire();
                    if (!d) return;
                    const box = e.currentTarget.parentElement!.getBoundingClientRect(),
                      x = ((e.clientX - box.left) * 100) / zoom,
                      y = ((e.clientY - box.top) * 100) / zoom;
                    const target = canvas.nodes.find(
                      (t) =>
                        Math.abs(t.x - x) <= t.width / 2 + 10 &&
                        Math.abs(t.y - y) <= t.height / 2 + 10,
                    );
                    if (!target) return;
                    try {
                      let next = connectFlowNodes(d.source, d.from, target.id, edgeKind, edgeLabel);
                      assertPositionable(next);
                      if (next !== d.source) {
                        for (const node of canvas.nodes)
                          next = positionNode(
                            next,
                            node.id,
                            Math.max(20, node.x),
                            Math.max(20, node.y),
                          );
                        mutate(d.source, next);
                      }
                    } catch (err) {
                      setActionError((err as Error).message);
                    }
                  }}
                />
              ))}
            {editor && writable && (
              <form
                className="absolute z-20 flex rounded border border-indigo-500 bg-white p-1 shadow"
                style={{
                  left: Math.max(
                    0,
                    Math.min((canvas.width * zoom) / 100 - 210, (editor.x * zoom) / 100 - 90),
                  ),
                  top: Math.max(0, (editor.y * zoom) / 100 - 18),
                }}
                onSubmit={(e) => {
                  e.preventDefault();
                  finishText();
                }}
              >
                <input
                  key={
                    editor.before +
                    ("node" in editor.target ? editor.target.node : editor.target.edge.start)
                  }
                  autoFocus
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label={"node" in editor.target ? "图元文字" : "连线文字"}
                  className="w-32 px-1 text-sm"
                  value={editor.value}
                  maxLength={"node" in editor.target ? 100 : 80}
                  onChange={(e) => setEditor({ ...editor, value: e.target.value })}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.nativeEvent.isComposing && e.key === "Enter") e.preventDefault();
                    if (e.key === "Escape") setEditor(null);
                  }}
                />
                <button type="submit" className="px-1 text-xs">
                  保存
                </button>
                <button type="button" className="px-1 text-xs" onClick={() => setEditor(null)}>
                  取消
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <p className="p-6 text-sm text-slate-500">
          {source.trim() ? "正在渲染 Mermaid…" : "输入 Mermaid 源码或选择模板，即可生成图表。"}
        </p>
      )}
    </div>
  );
}
