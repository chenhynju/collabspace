"use client";
import { useEffect, useRef, useState, useId } from "react";
import * as Y from "yjs";
import {
  type BoardShape,
  boardShape,
  connectorPath,
  layoutMindmap,
  parseMermaid,
  exportMermaid,
  shapeCatalog,
  type Member,
} from "@collabspace/protocol";
import { DocumentProvider, from64 } from "@/lib/document-provider";
import ShapeGlyph from "./ShapeGlyph";
import {Button} from "@/components/ui";
import MermaidWorkspace, { MermaidPreview } from "./MermaidWorkspace";

type Item = BoardShape & { id: string };
const tools = [
  ["select", "选择 / 移动"],
  ["pan", "平移画布"],
  ["rect", "矩形"],
  ["ellipse", "椭圆"],
  ["note", "便签"],
  ["text", "文字"],
  ["arrow", "箭头"],
  ["diamond", "判断菱形"],
  ["mind", "思维主题"],
  ["connect", "连接节点"],
] as const;
const colors: BoardShape["fill"][] = [
  "#fef3c7",
  "#dbeafe",
  "#dcfce7",
  "#fce7f3",
  "#ffffff",
];
const origin = "collabspace:whiteboard:local";
const colorFor = (id: string) =>
  `hsl(${[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 360} 65% 42%)`;
function read(doc: Y.Doc): Item[] {
  return [...doc.getMap<Y.Map<unknown>>("shapes")]
    .flatMap(([id, m]) => {
      const parsed = boardShape.safeParse(
        m instanceof Y.Map ? m.toJSON() : null,
      );
      return parsed.success ? [{ ...parsed.data, id } as Item] : [];
    })
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
function fitItems(items: Item[]) {
  const nodes = items.filter((s) => s.type !== "connector");
  if (!nodes.length) return { x: 0, y: 0, zoom: 1 };
  const x = Math.min(...nodes.map((s) => s.geometry.x)) - 50,
    y = Math.min(...nodes.map((s) => s.geometry.y)) - 50;
  const w = Math.max(...nodes.map((s) => s.geometry.x + s.geometry.w)) - x + 50,
    h = Math.max(...nodes.map((s) => s.geometry.y + s.geometry.h)) - y + 50;
  return { x, y, zoom: Math.max(0.03, Math.min(1.5, 1200 / w, 800 / h)) };
}
export function BoardDrawing({
  items,
  selected,
  marker,
  onSelect,
  onEdit,
}: {
  items: Item[];
  selected?: string;
  marker: string;
  onSelect?: (e: React.PointerEvent<SVGGElement>, item: Item) => void;
  onEdit?: (item: Item) => void;
}) {
  return (
    <>
      <defs>
        <marker
          id={marker}
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#334155" />
        </marker>
      </defs>
      {items
        .filter((s) => s.type === "mind" && s.parent)
        .map((s) => {
          const parent = items.find(
            (p) => p.id === s.parent && p.type === "mind",
          );
          return parent ? (
            <path
              key={`mind-${s.id}`}
              data-testid="mind-branch"
              d={connectorPath(parent.geometry, s.geometry, "curve")}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
              pointerEvents="none"
            />
          ) : null;
        })}
      {items.map((item) => {
        const { x, y, w, h } = item.geometry;
        if (item.type === "connector") {
          const a = items.find((s) => s.id === item.binding?.from),
            b = items.find((s) => s.id === item.binding?.to);
          if (!a || !b) return null;
          const d = connectorPath(
            { ...a.geometry, type: a.type },
            { ...b.geometry, type: b.type },
            item.binding?.style,
          );
          return (
            <g
              key={item.id}
              data-testid="board-shape"
              data-shape-id={item.id}
              role="button"
              aria-label={`connector: ${item.text || "连接线"}`}
              onPointerDown={(e) => onSelect?.(e, item)}
              onDoubleClick={() => onEdit?.(item)}
            >
              <path d={d} fill="none" stroke="transparent" strokeWidth="18" />
              <path
                data-testid="bound-connector"
                d={d}
                fill="none"
                stroke={selected === item.id ? "#2563eb" : "#334155"}
                strokeWidth="2"
                markerEnd={`url(#${marker})`}
                pointerEvents="none"
              />
              <text
                x={
                  (a.geometry.x +
                    a.geometry.w / 2 +
                    b.geometry.x +
                    b.geometry.w / 2) /
                  2
                }
                y={
                  (a.geometry.y +
                    a.geometry.h / 2 +
                    b.geometry.y +
                    b.geometry.h / 2) /
                    2 -
                  8
                }
                textAnchor="middle"
                fontSize="13"
                fill="#334155"
              >
                {item.text}
              </text>
            </g>
          );
        }
        return (
          <g
            key={item.id}
            data-testid="board-shape"
            data-shape-id={item.id}
            role="button"
            aria-label={`${item.type}: ${item.text || "未命名图形"}`}
            tabIndex={onSelect ? 0 : undefined}
            onPointerDown={(e) => onSelect?.(e, item)}
            onDoubleClick={() => onEdit?.(item)}
          >
            {shapeCatalog.some((s) => s.type === item.type) ? (
              <>
                <rect x={x} y={y} width={w} height={h} fill="transparent" />
                <svg x={x} y={y} width={w} height={h} overflow="visible">
                  <ShapeGlyph type={item.type} fill={item.fill} />
                </svg>
              </>
            ) : item.type === "diamond" ? (
              <polygon
                points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`}
                fill={item.fill}
                stroke="#64748b"
              />
            ) : item.type === "ellipse" ? (
              <ellipse
                cx={x + w / 2}
                cy={y + h / 2}
                rx={w / 2}
                ry={h / 2}
                fill={item.fill}
                stroke="#64748b"
              />
            ) : item.type === "arrow" ? (
              <>
                <rect x={x} y={y} width={w} height={h} fill="transparent" />
                <line
                  x1={x}
                  y1={y + h}
                  x2={x + w}
                  y2={y}
                  stroke="#334155"
                  strokeWidth="3"
                  markerEnd={`url(#${marker})`}
                />
              </>
            ) : (
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={item.type === "mind" ? 24 : item.type === "note" ? 2 : 10}
                fill={item.type === "text" ? "transparent" : item.fill}
                stroke={item.type === "text" ? "none" : "#64748b"}
              />
            )}
            <foreignObject
              x={
                x +
                (["diamond", "triangle", "parallelogram"].includes(item.type)
                  ? w * 0.23
                  : 10)
              }
              y={
                y +
                (item.type === "actor"
                  ? h * 0.84
                  : item.type === "triangle"
                    ? h * 0.48
                    : item.type === "diamond"
                      ? h * 0.23
                      : item.type === "database" || item.type === "cloud"
                        ? h * 0.32
                        : item.type === "server"
                          ? h * 0.37
                          : 8)
              }
              width={Math.max(
                10,
                ["diamond", "triangle", "parallelogram"].includes(item.type)
                  ? w * 0.54
                  : w - 20,
              )}
              height={Math.max(
                10,
                item.type === "actor"
                  ? h * 0.16
                  : item.type === "server"
                    ? h * 0.25
                    : item.type === "database" || item.type === "cloud"
                      ? h * 0.45
                      : ["diamond", "triangle"].includes(item.type)
                        ? h * 0.45
                        : h - 16,
              )}
              pointerEvents="none"
            >
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  overflow: "hidden",
                  overflowWrap: "anywhere",
                  height: "100%",
                  fontSize: 16,
                  color: "#0f172a",
                  display: "flex",
                  alignItems:
                    item.type === "note" || item.type === "text"
                      ? "flex-start"
                      : "center",
                  justifyContent:
                    item.type === "note" || item.type === "text"
                      ? "flex-start"
                      : "center",
                  textAlign:
                    item.type === "note" || item.type === "text"
                      ? "left"
                      : "center",
                }}
              >
                {item.text}
              </div>
            </foreignObject>
            {selected === item.id && (
              <rect
                x={x - 3}
                y={y - 3}
                width={w + 6}
                height={h + 6}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2"
                strokeDasharray="5 3"
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}
    </>
  );
}
export function BoardPreview({ state }: { state: string }) {
  const [mermaidSource] = useState(() => {
    const doc = new Y.Doc();
    try { Y.applyUpdate(doc, from64(state)); return doc.getText("mermaid").toString(); }
    finally { doc.destroy(); }
  });
  const [items] = useState(() => {
    const d = new Y.Doc();
    try {
      Y.applyUpdate(d, from64(state));
      return read(d);
    } finally {
      d.destroy();
    }
  });
  const marker = useId().replace(/:/g, "");
  const minX = Math.min(0, ...items.map((s) => s.geometry.x)) - 30,
    minY = Math.min(0, ...items.map((s) => s.geometry.y)) - 30;
  const w =
      Math.max(900, ...items.map((s) => s.geometry.x + s.geometry.w)) -
      minX +
      30,
    h =
      Math.max(600, ...items.map((s) => s.geometry.y + s.geometry.h)) -
      minY +
      30;
  return mermaidSource ? <MermaidPreview source={mermaidSource} /> : (
    <svg
      aria-label="白板历史只读预览"
      viewBox={`${minX} ${minY} ${w} ${h}`}
      className="w-full min-h-96 bg-slate-50"
    >
      <BoardDrawing items={items} marker={marker} />
    </svg>
  );
}
function Canvas({ provider }: { provider: DocumentProvider }) {
  const [items, setItems] = useState<Item[]>([]),
    [selected, setSelected] = useState(""),
    [tool, setTool] = useState<string>("select"),
    [view, setView] = useState({ x: 0, y: 0, zoom: 1 }),
    [members, setMembers] = useState<Member[]>([]),
    [error, setError] = useState("");
  const [connectFrom, setConnectFrom] = useState("");
  const [snap, setSnap] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false),
    [source, setSource] = useState(
      "flowchart LR\n  A[开始] --> B{验收通过？}\n  B -->|是| C[交付]",
    ),
    [preview, setPreview] = useState<Item[] | null>(null);
  const [, render] = useState(0);
  const svg = useRef<SVGSVGElement>(null),
    textEditor = useRef<HTMLTextAreaElement>(null),
    undo = useRef<Y.UndoManager>(),
    drag = useRef<{
      id?: string;
      mode: "move" | "resize" | "pan";
      start: { x: number; y: number };
      geometry?: Item["geometry"];
      latest?: Item["geometry"];
      client?: { x: number; y: number; scale: number };
      view: typeof view;
    }>();
  const sentAt = useRef(0),
    didFit = useRef(false),
    marker = useId().replace(/:/g, "");
  const shapes = provider.doc.getMap<Y.Map<unknown>>("shapes");
  const active = items.find((s) => s.id === selected);
  const previewView = fitItems(preview || []);
  useEffect(() => {
    if (items.length && !didFit.current) {
      didFit.current = true;
      setView(fitItems(items));
    }
  }, [items]);
  useEffect(() => {
    const update = () => {
      setItems(
        read(provider.doc).map((s) =>
          s.id === drag.current?.id && drag.current.latest
            ? { ...s, geometry: drag.current.latest }
            : s,
        ),
      );
      setMembers(provider.members);
      render((n) => n + 1);
    };
    undo.current = new Y.UndoManager(shapes, {
      trackedOrigins: new Set([origin]),
      captureTimeout: 500,
    });
    const dispose = provider.subscribe(update);
    shapes.observeDeep(update);
    update();
    return () => {
      dispose();
      shapes.unobserveDeep(update);
      undo.current?.destroy();
    };
  }, [provider, shapes]);
  const point = (e: { clientX: number; clientY: number }) => {
    const p = svg.current!.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const result = p.matrixTransform(svg.current!.getScreenCTM()!.inverse());
    return {
      x: Math.max(
        -10000,
        Math.min(10000, snap ? Math.round(result.x / 20) * 20 : result.x),
      ),
      y: Math.max(
        -10000,
        Math.min(10000, snap ? Math.round(result.y / 20) * 20 : result.y),
      ),
    };
  };
  const change = (id: string, patch: Partial<BoardShape>) => {
    if (!provider.writable) return;
    const shape = shapes.get(id);
    if (!shape) return;
    const parsed = boardShape.safeParse({ ...shape.toJSON(), ...patch });
    if (!parsed.success) {
      setError(
        "图形超出范围：画布坐标 ±10000，宽高 20–2000，文字最多 2000 字。",
      );
      return;
    }
    provider.doc.transact(() => {
      for (const [key, value] of Object.entries(patch)) shape.set(key, value);
    }, origin);
    setError("");
  };
  const create = (
    type: BoardShape["type"],
    p: { x: number; y: number },
    extra: Partial<BoardShape> = {},
  ) => {
    if (!provider.writable) return;
    if (shapes.size >= 500) {
      setError("当前白板最多 500 个图形。");
      return;
    }
    undo.current?.stopCapturing();
    const id = crypto.randomUUID(),
      shape = new Y.Map<unknown>();
    const data: BoardShape = {
      type,
      geometry: { x: p.x, y: p.y, w: 180, h: type === "mind" ? 60 : 120 },
      text:
        shapeCatalog.find((s) => s.type === type)?.label ||
        (type === "mind"
          ? "中心主题"
          : type === "note"
            ? "双击选中后，在属性中编辑便签"
            : ""),
      fill: type === "note" ? "#fef3c7" : "#dbeafe",
      order: Date.now(),
      ...extra,
    };
    for (const [key, value] of Object.entries(data)) shape.set(key, value);
    provider.doc.transact(() => shapes.set(id, shape), origin);
    undo.current?.stopCapturing();
    setSelected(id);
    setTool("select");
    return id;
  };
  const branch = (sibling = false) => {
    if (!active || active.type !== "mind") return;
    const parent = sibling ? active.parent : active.id;
    create(
      "mind",
      {
        x: Math.min(9800, active.geometry.x + (sibling ? 0 : 260)),
        y: Math.min(9800, active.geometry.y + 100),
      },
      { ...(parent ? { parent } : {}), text: sibling ? "同级主题" : "子主题" },
    );
  };
  const layout = () => {
    if (!provider.writable) return;
    let positions: ReturnType<typeof layoutMindmap>;
    try {
      positions = layoutMindmap(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "布局失败");
      return;
    }
    undo.current?.stopCapturing();
    provider.doc.transact(() => {
      for (const [id, geometry] of Object.entries(positions))
        shapes.get(id)?.set("geometry", geometry);
    }, origin);
    undo.current?.stopCapturing();
    setView(fitItems(read(provider.doc)));
  };
  const template = (mind: boolean) => {
    if (!provider.writable) return;
    if (shapes.size + (mind ? 4 : 7) > 500) {
      setError("模板超出白板500个图形上限。");
      return;
    }
    const offsetY = items.length
      ? Math.max(
          ...items
            .filter((s) => s.type !== "connector")
            .map((s) => s.geometry.y + s.geometry.h),
          0,
        ) + 120
      : 0;
    if (offsetY > 9000) {
      setError("模板放置空间不足，请先移动图形。");
      return;
    }
    const place = (
      type: BoardShape["type"],
      p: { x: number; y: number },
      extra: Partial<BoardShape> = {},
    ) =>
      create(
        type,
        { ...p, y: p.y + offsetY },
        {
          ...extra,
          ...(extra.geometry
            ? { geometry: { ...extra.geometry, y: extra.geometry.y + offsetY } }
            : {}),
        },
      );
    undo.current?.stopCapturing();
    provider.doc.transact(() => {
      if (mind) {
        const root = place("mind", { x: 80, y: 240 }, { text: "项目计划" })!;
        ["需求分析", "开发实施", "验证交付"].forEach((text, i) =>
          place(
            "mind",
            { x: 380, y: 100 + i * 140 },
            { parent: root, text, fill: colors[i] },
          ),
        );
      } else {
        const a = place(
          "ellipse",
          { x: 80, y: 200 },
          { text: "开始", geometry: { x: 80, y: 200, w: 140, h: 70 } },
        )!;
        const b = place("rect", { x: 310, y: 180 }, { text: "处理任务" })!;
        const c = place("diamond", { x: 600, y: 180 }, { text: "验收通过？" })!;
        const d = place(
          "ellipse",
          { x: 900, y: 200 },
          { text: "交付", geometry: { x: 900, y: 200, w: 140, h: 70 } },
        )!;
        [
          [a, b, ""],
          [b, c, ""],
          [c, d, "是"],
        ].forEach(([from, to, text]) =>
          place(
            "connector",
            { x: 0, y: 0 },
            { text, binding: { from, to, style: "elbow" } },
          ),
        );
      }
    }, origin);
    undo.current?.stopCapturing();
    setView(fitItems(read(provider.doc)));
  };
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = point(e);
    if (tool === "connect") {
      setConnectFrom("");
      setSelected("");
      return;
    }
    if (tool === "pan") {
      drag.current = {
        mode: "pan",
        start: p,
        view,
        client: {
          x: e.clientX,
          y: e.clientY,
          scale: 1 / svg.current!.getScreenCTM()!.a,
        },
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (tool !== "select") {
      create(tool as BoardShape["type"], p);
      return;
    }
    setSelected("");
  };
  const select = (e: React.PointerEvent<SVGGElement>, item: Item) => {
    if (tool === "pan") return;
    e.stopPropagation();
    svg.current?.focus({ preventScroll: true });
    if (tool === "connect") {
      if (!provider.writable || item.type === "connector") return;
      if (connectFrom && connectFrom !== item.id) {
        create(
          "connector",
          { x: 0, y: 0 },
          { binding: { from: connectFrom, to: item.id, style: "elbow" } },
        );
        setConnectFrom("");
      } else {
        setConnectFrom(item.id);
        setSelected(item.id);
      }
      return;
    }
    setSelected(item.id);
    if (!provider.writable) return;
    if (item.type === "connector") return;
    undo.current?.stopCapturing();
    drag.current = {
      id: item.id,
      mode: "move",
      start: point(e),
      geometry: item.geometry,
      view,
    };
    svg.current?.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = point(e),
      d = drag.current;
    if (Date.now() - sentAt.current >= 100) {
      provider.cursor(p);
      sentAt.current = Date.now();
    }
    if (!d) return;
    if (d.mode === "pan" && d.client) {
      setView({
        ...d.view,
        x: d.view.x - (e.clientX - d.client.x) * d.client.scale,
        y: d.view.y - (e.clientY - d.client.y) * d.client.scale,
      });
      return;
    }
    if (!d.geometry || !provider.writable) return;
    const g = { ...d.geometry };
    if (d.mode === "resize") {
      g.w = Math.max(20, Math.min(2000, g.w + p.x - d.start.x));
      g.h = Math.max(20, Math.min(2000, g.h + p.y - d.start.y));
    } else {
      g.x = Math.max(-10000, Math.min(10000, g.x + p.x - d.start.x));
      g.y = Math.max(-10000, Math.min(10000, g.y + p.y - d.start.y));
    }
    // Local drag preview is smooth; one atomic geometry update commits on release.
    d.latest = g;
    setItems((current) =>
      current.map((s) => (s.id === d.id ? { ...s, geometry: g } : s)),
    );
  };
  const finish = () => {
    const d = drag.current;
    drag.current = undefined;
    if (d?.id && d.latest) {
      change(d.id, { geometry: d.latest });
      undo.current?.stopCapturing();
    }
  };
  const remove = () => {
    if (provider.writable && selected) {
      undo.current?.stopCapturing();
      provider.doc.transact(() => {
        shapes.delete(selected);
        for (const [id, s] of shapes) {
          const b = s.get("binding") as BoardShape["binding"];
          if (b && (b.from === selected || b.to === selected))
            shapes.delete(id);
        }
      }, origin);
      undo.current?.stopCapturing();
      setSelected("");
    }
  };
  return (
    <section aria-label="实时白板" className="flex flex-col">
      <div
        className="flex flex-wrap items-center gap-2 border-b p-3"
        role="toolbar"
        aria-label="白板工具"
      >
        <label className="text-xs">
          <input
            type="checkbox"
            checked={snap}
            onChange={(e) => setSnap(e.target.checked)}
          />{" "}
          网格吸附
        </label>
        {tools.map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tool === key}
            disabled={!provider.writable && !["select", "pan"].includes(key)}
            onClick={() => {
              setTool(key);
              setConnectFrom("");
            }}
            className={`rounded border px-2 py-1 text-sm disabled:opacity-40 ${tool === key ? "bg-blue-600 text-white" : ""}`}
          >
            {label}
          </button>
        ))}
        <button
          disabled={!provider.writable}
          onClick={() => template(false)}
          className="rounded border px-2 py-1 text-sm disabled:opacity-40"
        >
          流程图模板
        </button>
        <button
          disabled={!provider.writable}
          onClick={() => template(true)}
          className="rounded border px-2 py-1 text-sm disabled:opacity-40"
        >
          思维导图模板
        </button>
        <button
          onClick={() => setSourceOpen((v) => !v)}
          className="rounded border px-2 py-1 text-sm"
        >
          Mermaid 源码
        </button>
        <button
          disabled={!provider.writable || !items.some((s) => s.type === "mind")}
          onClick={layout}
          className="rounded border px-2 py-1 text-sm disabled:opacity-40"
        >
          自动布局导图
        </button>
        <button
          disabled={!provider.writable || !undo.current?.canUndo()}
          onClick={() => undo.current?.undo()}
          className="rounded border px-2 py-1 text-sm disabled:opacity-40"
        >
          撤销
        </button>
        <button
          disabled={!provider.writable || !undo.current?.canRedo()}
          onClick={() => undo.current?.redo()}
          className="rounded border px-2 py-1 text-sm disabled:opacity-40"
        >
          重做
        </button>
        <button
          onClick={() => {
            const copy = svg.current?.cloneNode(true) as
              SVGSVGElement | undefined;
            if (!copy) return;
            copy
              .querySelectorAll(
                '[data-testid="board-resize"], [aria-label$="的白板光标"]',
              )
              .forEach((n) => n.remove());
            const nodes = items.filter((s) => s.type !== "connector");
            const x = Math.min(0, ...nodes.map((s) => s.geometry.x)) - 30,
              y = Math.min(0, ...nodes.map((s) => s.geometry.y)) - 30;
            const w =
                Math.max(
                  900,
                  ...nodes.map((s) => s.geometry.x + s.geometry.w),
                ) -
                x +
                30,
              h =
                Math.max(
                  600,
                  ...nodes.map((s) => s.geometry.y + s.geometry.h),
                ) -
                y +
                30;
            copy.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
            copy.setAttribute("width", String(w));
            copy.setAttribute("height", String(h));
            copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            const url = URL.createObjectURL(
              new Blob([new XMLSerializer().serializeToString(copy)], {
                type: "image/svg+xml",
              }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "collabspace-diagram.svg";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
          className="rounded border px-2 py-1 text-sm"
        >
          导出 SVG
        </button>
        <button
          onClick={() =>
            setView((v) => ({ ...v, zoom: Math.min(3, v.zoom + 0.25) }))
          }
          aria-label="放大白板"
        >
          ＋
        </button>
        <button
          onClick={() =>
            setView((v) => ({ ...v, zoom: Math.max(0.03, v.zoom - 0.25) }))
          }
          aria-label="缩小白板"
        >
          −
        </button>
        <button onClick={() => setView({ x: 0, y: 0, zoom: 1 })}>
          复位 {Math.round(view.zoom * 100)}%
        </button>
        <button onClick={() => setView(fitItems(items))}>适应全部</button>
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(shapes.toJSON(), null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "whiteboard-draft.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
          className="ml-auto text-sm text-blue-700"
        >
          导出本地白板草稿
        </button>
      </div>
      <details open className="border-b bg-white px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">
          图元库 · 拖到画布，或点击后放置
        </summary>
        <div
          className="mt-2 grid grid-cols-4 gap-2 lg:grid-cols-8"
          aria-label="图元库"
        >
          {shapeCatalog.map((s) => (
            <button
              key={s.type}
              draggable={provider.writable}
              disabled={!provider.writable}
              aria-label={`图元 ${s.label}`}
              aria-pressed={tool === s.type}
              onDragStart={(e) => {
                if (!provider.writable) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.setData(
                  "application/x-collabspace-shape",
                  s.type,
                );
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => setTool(s.type)}
              className={`rounded border p-2 text-xs disabled:opacity-40 ${tool === s.type ? "border-blue-600 bg-blue-50" : "hover:bg-slate-50"}`}
            >
              <span className="mx-auto mb-1 block h-9 w-14 pointer-events-none">
                <ShapeGlyph type={s.type} />
              </span>
              {s.label}
            </button>
          ))}
        </div>
      </details>
      <p className="px-3 py-2 text-xs text-slate-500">
        {tool === "connect"
          ? connectFrom
            ? "请选择终点节点；连接线会跟随节点移动。"
            : "依次点击两个节点建立连接。"
          : "放置并拖动节点；用连接工具建立流程图。选中思维主题后添加子主题（Tab）或同级主题（Enter），再自动布局。每人撤销仅作用于自己的操作。"}
      </p>
      {error && (
        <p role="alert" className="px-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {sourceOpen && (
        <section
          aria-label="Mermaid 基础语法"
          className="grid gap-3 border-y bg-white p-4 md:grid-cols-2"
        >
          <div className="space-y-2">
            <h3 className="font-medium">用文字创建可编辑图形</h3>
            <p className="text-xs text-slate-500">
              支持基础 flowchart LR/TD/TB：矩形、菱形、圆形、箭头及标签；mindmap
              使用空格缩进。不支持 subgraph、样式指令、链接或
              HTML。导入追加图形，不覆盖现有内容；导出保留文字和拓扑，图元类型、布局与配色可能简化。
            </p>
            <textarea
              aria-label="Mermaid 源码输入"
              value={source}
              maxLength={32000}
              onChange={(e) => {
                setSource(e.target.value);
                setPreview(null);
                setError("");
              }}
              rows={9}
              className="w-full rounded border p-2 font-mono text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded border px-2 py-1"
                onClick={() => {
                  try {
                    setPreview(parseMermaid(source));
                    setError("");
                  } catch (e) {
                    setPreview(null);
                    setError(e instanceof Error ? e.message : "源码无法解析");
                  }
                }}
              >
                解析预览
              </button>
              <button
                className="rounded bg-blue-600 px-2 py-1 text-white disabled:opacity-40"
                disabled={!provider.writable || !preview}
                onClick={() => {
                  if (!preview || !provider.writable) return;
                  if (shapes.size + preview.length > 500) {
                    setError("导入超出白板500个图形上限。");
                    return;
                  }
                  if (preview.some((s) => shapes.has(s.id))) {
                    setError("这些图形已经导入，请重新解析源码。");
                    return;
                  }
                  const offsetY = items.length
                    ? Math.max(
                        ...items
                          .filter((s) => s.type !== "connector")
                          .map((s) => s.geometry.y + s.geometry.h),
                        0,
                      ) + 120
                    : 0;
                  if (preview.some((s) => s.geometry.y + offsetY > 10000)) {
                    setError("追加区域超出画布范围，请先移动图形。");
                    return;
                  }
                  undo.current?.stopCapturing();
                  provider.doc.transact(() => {
                    for (const { id, ...data } of preview)
                      shapes.set(
                        id,
                        new Y.Map(
                          Object.entries({
                            ...data,
                            geometry: {
                              ...data.geometry,
                              y: data.geometry.y + offsetY,
                            },
                          }),
                        ),
                      );
                  }, origin);
                  undo.current?.stopCapturing();
                  setPreview(null);
                  setView(fitItems(read(provider.doc)));
                  setError("");
                }}
              >
                追加到白板
              </button>
              {[false, true].map((mind) => (
                <button
                  key={String(mind)}
                  className="rounded border px-2 py-1"
                  onClick={() => {
                    try {
                      setSource(exportMermaid(items, mind));
                      setPreview(null);
                      setError("");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "无法导出");
                    }
                  }}
                >
                  {mind ? "导出导图源码" : "导出流程图源码"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500">
              {preview
                ? `解析成功：${preview.filter((s) => s.type !== "connector").length} 个节点，${preview.filter((s) => s.type === "connector" || s.parent).length} 条连接；确认后追加。`
                : "先解析预览，语法错误不会修改共享白板。"}
            </p>
            {preview && (
              <svg
                aria-label="Mermaid 导入预览"
                viewBox={`${previewView.x} ${previewView.y} ${1200 / previewView.zoom} ${800 / previewView.zoom}`}
                className="w-full bg-slate-50"
              >
                <BoardDrawing items={preview} marker={`${marker}-preview`} />
              </svg>
            )}
          </div>
        </section>
      )}
      <svg
        ref={svg}
        data-testid="whiteboard-canvas"
        aria-label="协作白板画布"
        tabIndex={0}
        onKeyDown={(e) => {
          if (!provider.writable) return;
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
            e.preventDefault();
            if (e.shiftKey) undo.current?.redo();
            else undo.current?.undo();
            return;
          }
          if (
            active?.type === "mind" &&
            (e.key === "Tab" || e.key === "Enter")
          ) {
            e.preventDefault();
            branch(e.key === "Enter");
          }
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            remove();
          }
          if (e.key === "Escape") {
            setTool("select");
            setConnectFrom("");
            setSelected("");
          }
        }}
        viewBox={`${view.x} ${view.y} ${1200 / view.zoom} ${800 / view.zoom}`}
        className="min-h-[480px] w-full touch-none bg-slate-50"
        onPointerDown={down}
        onDragOver={(e) => {
          if (
            provider.writable &&
            e.dataTransfer.types.includes("application/x-collabspace-shape")
          ) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (!provider.writable) return;
          const type = e.dataTransfer.getData(
            "application/x-collabspace-shape",
          );
          const entry = shapeCatalog.find((s) => s.type === type);
          if (entry) create(entry.type, point(e));
        }}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={() => {
          drag.current = undefined;
          setItems(read(provider.doc));
        }}
        onPointerLeave={() => {
          if (!drag.current) provider.cursor(null);
        }}
      >
        <defs>
          <pattern
            id={`${marker}-grid`}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="#cbd5e1" />
          </pattern>
        </defs>
        <rect
          x={view.x}
          y={view.y}
          width={1200 / view.zoom}
          height={800 / view.zoom}
          fill={`url(#${marker}-grid)`}
          pointerEvents="none"
        />
        <BoardDrawing
          items={items}
          selected={selected}
          marker={marker}
          onSelect={select}
          onEdit={
            provider.writable
              ? (item) => {
                  setSelected(item.id);
                  requestAnimationFrame(() => textEditor.current?.focus());
                }
              : undefined
          }
        />
        {active && active.type !== "connector" && provider.writable && (
          <circle
            data-testid="board-resize"
            cx={active.geometry.x + active.geometry.w}
            cy={active.geometry.y + active.geometry.h}
            r={7 / view.zoom}
            fill="#2563eb"
            onPointerDown={(e) => {
              e.stopPropagation();
              undo.current?.stopCapturing();
              drag.current = {
                id: active.id,
                mode: "resize",
                start: point(e),
                geometry: active.geometry,
                view,
              };
              svg.current?.setPointerCapture(e.pointerId);
            }}
          />
        )}
        {members
          .filter((m) => m.cursor)
          .map((m) => (
            <g
              key={m.sessionId}
              transform={`translate(${m.cursor!.x},${m.cursor!.y})`}
              pointerEvents="none"
              aria-label={`${m.name} 的白板光标`}
            >
              <path
                d="M0 0 L0 18 L5 13 L10 22 L14 20 L9 12 L17 12 Z"
                fill={colorFor(m.userId)}
              />
              <text x="18" y="14" fill={colorFor(m.userId)} fontSize="14">
                {m.name}
              </text>
            </g>
          ))}
      </svg>
      {active && (
        <div
          className="flex flex-wrap gap-3 border-t p-3"
          aria-label="图形属性"
        >
          {!active.binding && (
            <>
              {active.type !== "mind" && (
                <label className="text-xs">
                  图元类型
                  <select
                    aria-label="图形类型"
                    value={active.type}
                    disabled={!provider.writable}
                    onChange={(e) =>
                      change(active.id, {
                        type: e.target.value as BoardShape["type"],
                      })
                    }
                    className="mt-1 block rounded border p-2"
                  >
                    <option value="rect">矩形</option>
                    <option value="ellipse">椭圆</option>
                    <option value="diamond">判断菱形</option>
                    <option value="note">便签</option>
                    <option value="text">文字</option>
                    <option value="arrow">箭头</option>
                    {shapeCatalog.map((s) => (
                      <option key={s.type} value={s.type}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(["x", "y", "w", "h"] as const).map((key, i) => (
                <label key={key} className="text-xs">
                  {["X", "Y", "宽度", "高度"][i]}
                  <input
                    key={`${active.id}:${key}:${active.geometry[key]}`}
                    type="number"
                    aria-label={`图形${["X", "Y", "宽度", "高度"][i]}`}
                    defaultValue={active.geometry[key]}
                    min={key === "x" || key === "y" ? -10000 : 20}
                    max={key === "x" || key === "y" ? 10000 : 2000}
                    disabled={!provider.writable}
                    onBlur={(e) => {
                      const value = e.currentTarget.valueAsNumber;
                      if (value !== active.geometry[key])
                        change(active.id, {
                          geometry: { ...active.geometry, [key]: value },
                        });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    className="mt-1 block w-20 rounded border p-2"
                  />
                </label>
              ))}
              <button
                disabled={!provider.writable}
                className="text-sm text-blue-700 disabled:opacity-40"
                onClick={() => {
                  const { id, ...copy } = active;
                  create(
                    active.type,
                    {
                      x: Math.min(10000, active.geometry.x + 40),
                      y: Math.min(10000, active.geometry.y + 40),
                    },
                    {
                      ...copy,
                      geometry: {
                        ...active.geometry,
                        x: Math.min(10000, active.geometry.x + 40),
                        y: Math.min(10000, active.geometry.y + 40),
                      },
                      order: Date.now(),
                    },
                  );
                }}
              >
                复制图形
              </button>
            </>
          )}
          {active.type === "mind" && (
            <div className="flex gap-2">
              <button disabled={!provider.writable} onClick={() => branch()}>
                添加子主题
              </button>
              <button
                disabled={!provider.writable}
                onClick={() => branch(true)}
              >
                添加同级主题
              </button>
            </div>
          )}
          {active.binding && (
            <label className="text-xs">
              线型
              <select
                aria-label="连接线样式"
                disabled={!provider.writable}
                value={active.binding.style}
                onChange={(e) =>
                  change(active.id, {
                    binding: {
                      ...active.binding!,
                      style: e.target.value as "straight" | "elbow" | "curve",
                    },
                  })
                }
                className="block rounded border p-2"
              >
                <option value="elbow">折线</option>
                <option value="straight">直线</option>
                <option value="curve">曲线</option>
              </select>
            </label>
          )}
          <label className="flex-1 text-xs">
            文字
            <textarea
              aria-label="图形文字"
              ref={textEditor}
              maxLength={2000}
              disabled={!provider.writable}
              value={active.text}
              onChange={(e) => change(active.id, { text: e.target.value })}
              className="mt-1 w-full rounded border p-2 text-sm"
            />
          </label>
          <label className="text-xs">
            颜色
            <select
              aria-label="图形颜色"
              disabled={!provider.writable}
              value={active.fill}
              onChange={(e) =>
                change(active.id, {
                  fill: e.target.value as BoardShape["fill"],
                })
              }
              className="mt-1 block rounded border p-2"
            >
              {colors.map((c, i) => (
                <option key={c} value={c}>
                  {["黄", "蓝", "绿", "粉", "白"][i]}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={!provider.writable}
            onClick={remove}
            className="text-sm text-red-700 disabled:opacity-40"
          >
            删除图形
          </button>
        </div>
      )}
    </section>
  );
}
function BoardWorkspace({ provider }: { provider: DocumentProvider }) {
  const [mode, setMode] = useState(() => provider.doc.getText("mermaid").length || !provider.doc.getMap("shapes").size ? "mermaid" : "canvas");
  return <div>
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <Button variant={mode === "mermaid" ? "primary" : "ghost"} aria-pressed={mode === "mermaid"} onClick={() => setMode("mermaid")}>Mermaid 图表工作区</Button>
      <Button variant={mode === "canvas" ? "primary" : "ghost"} aria-pressed={mode === "canvas"} onClick={() => setMode("canvas")}>自由画布</Button>
      <span className="text-xs text-slate-500">图表默认使用 Mermaid；自由画布内容独立保留。</span>
    </div>
    {mode === "mermaid" ? <MermaidWorkspace provider={provider} /> : <Canvas provider={provider} />}
  </div>;
}
export default function Whiteboard({
  docId,
  org,
  user,
  onReady,
}: {
  docId: string;
  org: string;
  user: string;
  onReady: (p: DocumentProvider) => void;
  onSelection?: unknown;
}) {
  const [provider, setProvider] = useState<DocumentProvider | null>(null),
    [error, setError] = useState("");
  const [, render] = useState(0);
  useEffect(() => {
    let alive = true;
    const p = new DocumentProvider(docId, org, user);
    const dispose = p.subscribe(() => {
      if (alive) {
        setProvider(p);
        render((n) => n + 1);
      }
    });
    void p
      .init()
      .then(() => {
        if (alive) {
          setProvider(p);
          onReady(p);
        }
      })
      .catch(() => setError("本地白板无法打开，请检查浏览器存储权限。"));
    return () => {
      alive = false;
      dispose();
      void p.destroy();
    };
  }, [docId, org, user, onReady]);
  return error ? (
    <p role="alert">{error}</p>
  ) : provider?.ready ? (
    <BoardWorkspace provider={provider} />
  ) : (
    <p className="p-6">正在读取白板…</p>
  );
}
