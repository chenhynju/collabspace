"use client";
import { useEffect, useRef, useState, useId } from "react";
import * as Y from "yjs";
import {
  type BoardShape,
  boardShape,
  type Member,
} from "@collabspace/protocol";
import { DocumentProvider, from64 } from "@/lib/document-provider";

type Item = BoardShape & { id: string };
const tools = [
  ["select", "选择 / 移动"],
  ["pan", "平移画布"],
  ["rect", "矩形"],
  ["ellipse", "椭圆"],
  ["note", "便签"],
  ["text", "文字"],
  ["arrow", "箭头"],
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
export function BoardDrawing({
  items,
  selected,
  marker,
  onSelect,
}: {
  items: Item[];
  selected?: string;
  marker: string;
  onSelect?: (e: React.PointerEvent<SVGGElement>, item: Item) => void;
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
      {items.map((item) => {
        const { x, y, w, h } = item.geometry;
        return (
          <g
            key={item.id}
            data-testid="board-shape"
            data-shape-id={item.id}
            role="button"
            aria-label={`${item.type}: ${item.text || "未命名图形"}`}
            tabIndex={onSelect ? 0 : undefined}
            onPointerDown={(e) => onSelect?.(e, item)}
          >
            {item.type === "ellipse" ? (
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
                rx={item.type === "note" ? 2 : 10}
                fill={item.type === "text" ? "transparent" : item.fill}
                stroke={item.type === "text" ? "none" : "#64748b"}
              />
            )}
            <foreignObject
              x={x + 10}
              y={y + 8}
              width={Math.max(10, w - 20)}
              height={Math.max(10, h - 16)}
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
  return (
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
  const [, render] = useState(0);
  const svg = useRef<SVGSVGElement>(null),
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
    marker = useId().replace(/:/g, "");
  const shapes = provider.doc.getMap<Y.Map<unknown>>("shapes");
  const active = items.find((s) => s.id === selected);
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
  const point = (e: React.PointerEvent) => {
    const p = svg.current!.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const result = p.matrixTransform(svg.current!.getScreenCTM()!.inverse());
    return {
      x: Math.max(-10000, Math.min(10000, result.x)),
      y: Math.max(-10000, Math.min(10000, result.y)),
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
  const create = (type: BoardShape["type"], p: { x: number; y: number }) => {
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
      geometry: { x: p.x, y: p.y, w: 180, h: 120 },
      text: type === "note" ? "双击选中后，在属性中编辑便签" : "",
      fill: type === "note" ? "#fef3c7" : "#dbeafe",
      order: Date.now(),
    };
    for (const [key, value] of Object.entries(data)) shape.set(key, value);
    provider.doc.transact(() => shapes.set(id, shape), origin);
    undo.current?.stopCapturing();
    setSelected(id);
    setTool("select");
  };
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = point(e);
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
    setSelected(item.id);
    if (!provider.writable) return;
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
      provider.doc.transact(() => shapes.delete(selected), origin);
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
        {tools.map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tool === key}
            disabled={!provider.writable && !["select", "pan"].includes(key)}
            onClick={() => setTool(key)}
            className={`rounded border px-2 py-1 text-sm disabled:opacity-40 ${tool === key ? "bg-blue-600 text-white" : ""}`}
          >
            {label}
          </button>
        ))}
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
          onClick={() =>
            setView((v) => ({ ...v, zoom: Math.min(3, v.zoom + 0.25) }))
          }
          aria-label="放大白板"
        >
          ＋
        </button>
        <button
          onClick={() =>
            setView((v) => ({ ...v, zoom: Math.max(0.25, v.zoom - 0.25) }))
          }
          aria-label="缩小白板"
        >
          −
        </button>
        <button onClick={() => setView({ x: 0, y: 0, zoom: 1 })}>
          复位 {Math.round(view.zoom * 100)}%
        </button>
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
      <p className="px-3 py-2 text-xs text-slate-500">
        点击工具后在画布放置图形；选择后拖动，拖动右下角调整大小。光标实时显示，拖动结果在松开时同步。每人撤销仅作用于自己的操作。
      </p>
      {error && (
        <p role="alert" className="px-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <svg
        ref={svg}
        data-testid="whiteboard-canvas"
        aria-label="协作白板画布"
        viewBox={`${view.x} ${view.y} ${1200 / view.zoom} ${800 / view.zoom}`}
        className="min-h-[480px] w-full touch-none bg-slate-50"
        onPointerDown={down}
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
        <BoardDrawing
          items={items}
          selected={selected}
          marker={marker}
          onSelect={select}
        />
        {active && provider.writable && (
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
          <label className="flex-1 text-xs">
            文字
            <textarea
              aria-label="图形文字"
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
    <Canvas provider={provider} />
  ) : (
    <p className="p-6">正在读取白板…</p>
  );
}
