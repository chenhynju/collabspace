"use client";
import { useEffect, useRef, useState, useId } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  ChevronsDown,
  ChevronsUp,
  Circle,
  Copy,
  Diamond,
  Download,
  Eye,
  EyeOff,
  FileDown,
  FileImage,
  Frame,
  GitBranch,
  Group,
  Hand,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Link2,
  Lock,
  MapPin,
  MessageSquare,
  MousePointer2,
  Redo2,
  Search,
  Share2,
  Shapes,
  Spline,
  Square,
  StickyNote,
  Type,
  Undo2,
  Ungroup,
  Unlock,
  Upload,
} from "lucide-react";
import * as Y from "yjs";
import { api } from "@/lib/api";
import { exportBoard, exportBounds, type ExportShape } from "@/lib/board-export";
import { layoutFlow } from "@/lib/flow-layout";
import { downloadText, exportDrawio, parseDrawio } from "@/lib/drawio";
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
import { useParams } from "next/navigation";
import { BoardAgent } from "./BoardAgent";
import MermaidWorkspace, { MermaidPreview } from "./MermaidWorkspace";
import { Button } from "@/components/ui";

type Item = BoardShape & {
  id: string;
  group?: string;
  locked?: boolean;
  rotation?: number;
  frame?: boolean;
  layer?: string;
};
type BoardLayer = { id: string; name: string; visible: boolean; locked: boolean };
const defaultLayers: BoardLayer[] = [
  { id: "default", name: "默认图层", visible: true, locked: false },
];
function readLayers(doc: Y.Doc): BoardLayer[] {
  try {
    const raw = doc.getMap<unknown>("boardMeta").get("layers");
    if (typeof raw !== "string") return defaultLayers;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return defaultLayers;
    const layers = parsed.filter(
      (layer): layer is BoardLayer =>
        !!layer &&
        typeof layer.id === "string" &&
        typeof layer.name === "string" &&
        typeof layer.visible === "boolean" &&
        typeof layer.locked === "boolean",
    );
    return layers.length ? layers : defaultLayers;
  } catch {
    return defaultLayers;
  }
}
type BoardThread = {
  id: string;
  body: string;
  quote?: string;
  anchor?: { start?: string; end?: string } | null;
  resolved: boolean;
  revision: number;
  createdBy?: string;
  createdAt?: string;
  replies?: { id: string; body: string; createdBy?: string; createdAt?: string }[];
};
const shapeAnchor = (id: string) => ({ start: `shape:${id}`, end: `shape:${id}` });
const threadShapeId = (thread: BoardThread) =>
  typeof thread.anchor?.start === "string" && thread.anchor.start.startsWith("shape:")
    ? thread.anchor.start.slice(6)
    : "";
const tools = [
  ["select", "选择 / 移动"],
  ["pan", "平移画布"],
  ["rect", "矩形"],
  ["ellipse", "椭圆"],
  ["note", "便签"],
  ["text", "文字"],
  ["arrow", "箭头 / 连线"],
  ["diamond", "判断菱形"],
  ["mind", "思维主题"],
  ["connect", "连接节点"],
] as const;
const colors: BoardShape["fill"][] = ["#fef3c7", "#dbeafe", "#dcfce7", "#fce7f3", "#ffffff"];
const origin = "collabspace:whiteboard:local";
const colorFor = (id: string) =>
  `hsl(${[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 360} 65% 42%)`;
function read(doc: Y.Doc): Item[] {
  const meta = doc.getMap<unknown>("boardMeta");
  return [...doc.getMap<Y.Map<unknown>>("shapes")]
    .flatMap(([id, m]) => {
      const parsed = boardShape.safeParse(m instanceof Y.Map ? m.toJSON() : null);
      if (!parsed.success) return [];
      const group = meta.get(`group:${id}`),
        layer = meta.get(`layer:${id}`),
        rotation = Number(meta.get(`rotation:${id}`) || 0);
      return [
        {
          ...parsed.data,
          id,
          group: typeof group === "string" ? group : undefined,
          locked: Boolean(meta.get(`locked:${id}`)),
          rotation: Number.isFinite(rotation) ? Math.max(0, Math.min(359, rotation)) : 0,
          frame: Boolean(meta.get(`frame:${id}`)),
          layer: typeof layer === "string" ? layer : "default",
        } as Item,
      ];
    })
    .sort(
      (a, b) =>
        (a.type === "connector" ? 1 : 0) - (b.type === "connector" ? 1 : 0) ||
        a.order - b.order ||
        a.id.localeCompare(b.id),
    );
}
function findLinkTarget(items: Item[], x: number, y: number, exclude: string, tolerance: number) {
  return [...items]
    .reverse()
    .find(
      (item) =>
        item.id !== exclude &&
        item.type !== "connector" &&
        x >= item.geometry.x - tolerance &&
        x <= item.geometry.x + item.geometry.w + tolerance &&
        y >= item.geometry.y - tolerance &&
        y <= item.geometry.y + item.geometry.h + tolerance,
    );
}
function rotatePoint(cx: number, cy: number, x: number, y: number, degrees: number) {
  const angle = (degrees * Math.PI) / 180;
  return {
    x: cx + (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle),
    y: cy + (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle),
  };
}
function fitItems(items: Item[]) {
  const nodes = items.filter((s) => s.type !== "connector" || s.points);
  if (!nodes.length) return { x: 0, y: 0, zoom: 1 };
  const xs = nodes.flatMap((s) =>
      s.points ? [s.points.x1, s.points.x2] : [s.geometry.x, s.geometry.x + s.geometry.w],
    ),
    ys = nodes.flatMap((s) =>
      s.points ? [s.points.y1, s.points.y2] : [s.geometry.y, s.geometry.y + s.geometry.h],
    );
  const x = Math.min(...xs) - 50,
    y = Math.min(...ys) - 50;
  const w = Math.max(...xs) - x + 50,
    h = Math.max(...ys) - y + 50;
  return { x, y, zoom: Math.max(0.03, Math.min(1.5, 1200 / w, 800 / h)) };
}
export function BoardDrawing({
  items,
  selected,
  selectedIds,
  dimIds,
  marker,
  onSelect,
  onEdit,
}: {
  items: Item[];
  selected?: string;
  selectedIds?: Set<string>;
  dimIds?: Set<string>;
  marker: string;
  onSelect?: (e: React.PointerEvent<SVGGElement>, item: Item) => void;
  onEdit?: (item: Item) => void;
}) {
  const frames = items.filter((s) => s.frame && s.type !== "connector");
  const ordered = [...items].sort((a, b) => Number(b.frame) - Number(a.frame));
  const frameFor = (item: Item) =>
    item.type === "connector" || item.frame
      ? undefined
      : frames.find((frame) => {
          const cx = item.geometry.x + item.geometry.w / 2,
            cy = item.geometry.y + item.geometry.h / 2;
          return (
            cx > frame.geometry.x &&
            cx < frame.geometry.x + frame.geometry.w &&
            cy > frame.geometry.y &&
            cy < frame.geometry.y + frame.geometry.h
          );
        });
  return (
    <>
      <defs>
        <marker id={marker} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <path d="M0,0 L0,6 L9,3 z" fill="#334155" />
        </marker>
        {frames.map((frame) => (
          <clipPath key={`clip-${frame.id}`} id={`${marker}-frame-${frame.id}`}>
            <rect
              x={frame.geometry.x}
              y={frame.geometry.y}
              width={frame.geometry.w}
              height={frame.geometry.h}
            />
          </clipPath>
        ))}
      </defs>
      {items
        .filter((s) => s.type === "mind" && s.parent)
        .map((s) => {
          const parent = items.find((p) => p.id === s.parent && p.type === "mind");
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
      {ordered.map((item) => {
        const { x, y, w, h } = item.geometry;
        const isSelected = selected === item.id || selectedIds?.has(item.id);
        const clip = frameFor(item);
        if (item.type === "connector") {
          const a = items.find((s) => s.id === item.binding?.from),
            b = items.find((s) => s.id === item.binding?.to),
            points = item.points;
          if (!points && (!a || !b)) return null;
          const d = points
            ? `M ${points.x1} ${points.y1} L ${points.x2} ${points.y2}`
            : connectorPath(
                { ...a!.geometry, type: a!.type },
                { ...b!.geometry, type: b!.type },
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
                stroke={isSelected ? "#2563eb" : "#334155"}
                strokeWidth="2"
                markerEnd={`url(#${marker})`}
                pointerEvents="none"
              />
              <text
                x={
                  points
                    ? (points.x1 + points.x2) / 2
                    : (a!.geometry.x + a!.geometry.w / 2 + b!.geometry.x + b!.geometry.w / 2) / 2
                }
                y={
                  points
                    ? (points.y1 + points.y2) / 2 - 8
                    : (a!.geometry.y + a!.geometry.h / 2 + b!.geometry.y + b!.geometry.h / 2) / 2 - 8
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
            opacity={dimIds?.has(item.id) ? 0.3 : 1}
            clipPath={clip ? `url(#${marker}-frame-${clip.id})` : undefined}
            transform={
              item.rotation
                ? `rotate(${item.rotation} ${x + w / 2} ${y + h / 2})`
                : undefined
            }
            onPointerDown={(e) => onSelect?.(e, item)}
            onDoubleClick={() => onEdit?.(item)}
          >
            {item.frame ? (
              <>
                <rect x={x} y={y} width={w} height={h} rx={10} fill="#ffffff" stroke="#94a3b8" />
                <path
                  d={`M ${x} ${y + Math.min(30, h)} H ${x + w}`}
                  stroke="#cbd5e1"
                  fill="none"
                />
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={Math.min(30, h)}
                  rx={10}
                  fill="#f1f5f9"
                />
                <text x={x + 10} y={y + Math.min(20, h / 2)} fontSize="13" fontWeight={600} fill="#334155">
                  {item.text || "Frame"}
                </text>
              </>
            ) : shapeCatalog.some((s) => s.type === item.type) ? (
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
            {!item.frame && (
              <foreignObject
                x={x + (["diamond", "triangle", "parallelogram"].includes(item.type) ? w * 0.23 : 10)}
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
                ["diamond", "triangle", "parallelogram"].includes(item.type) ? w * 0.54 : w - 20,
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
                    item.type === "note" || item.type === "text" ? "flex-start" : "center",
                  justifyContent:
                    item.type === "note" || item.type === "text" ? "flex-start" : "center",
                  textAlign: item.type === "note" || item.type === "text" ? "left" : "center",
                }}
              >
                {item.text}
              </div>
            </foreignObject>
            )}
            {isSelected && (
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
    try {
      Y.applyUpdate(doc, from64(state));
      return doc.getText("mermaid").toString();
    } finally {
      doc.destroy();
    }
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
  const w = Math.max(900, ...items.map((s) => s.geometry.x + s.geometry.w)) - minX + 30,
    h = Math.max(600, ...items.map((s) => s.geometry.y + s.geometry.h)) - minY + 30;
  return mermaidSource ? (
    <MermaidPreview source={mermaidSource} />
  ) : (
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
  const { id: projectId } = useParams<{ id: string }>();
  const [items, setItems] = useState<Item[]>([]),
    [selected, setSelected] = useState(""),
    [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()),
    [tool, setTool] = useState<string>("select"),
    [view, setView] = useState({ x: 0, y: 0, zoom: 1 }),
    [members, setMembers] = useState<Member[]>([]),
    [error, setError] = useState("");
  const [connectFrom, setConnectFrom] = useState("");
  const [connecting, setConnecting] = useState<{
    from: string;
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);
  const connectingRef = useRef<{
    from: string;
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [arrowDraft, setArrowDraft] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const arrowStart = useRef<{ x: number; y: number } | null>(null);
  const [marquee, setMarquee] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);
  const groupDrag = useRef<{
    start: { x: number; y: number };
    geometries: Record<string, Item["geometry"]>;
    latest?: Record<string, Item["geometry"]>;
  } | null>(null);
  const [snap, setSnap] = useState(false);
  const [smart, setSmart] = useState(true);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [threads, setThreads] = useState<BoardThread[]>([]);
  const [review, setReview] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentError, setCommentError] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [activeThread, setActiveThread] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [layersOpen, setLayersOpen] = useState(false);
  const [activeLayer, setActiveLayer] = useState("default");
  const [shapeSearch, setShapeSearch] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"png" | "pdf">("png");
  const [exportScale, setExportScale] = useState<1 | 2>(2);
  const [exportSelected, setExportSelected] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState("");
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [importError, setImportError] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [mentionables, setMentionables] = useState<
    { id: string; name: string; role: string }[]
  >([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareExpiry, setShareExpiry] = useState<"0" | "1" | "7" | "30">("7");
  const [shareLinks, setShareLinks] = useState<any[]>([]);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareCopied, setShareCopied] = useState("");
  const [shapePanel, setShapePanel] = useState(false);
  const [templatePanel, setTemplatePanel] = useState(false);
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
  const rotateDrag = useRef<{
    id: string;
    center: { x: number; y: number };
    startAngle: number;
    startRotation: number;
    latest?: number;
  } | null>(null);
  const deepLink = useRef(false);
  const shapes = provider.doc.getMap<Y.Map<unknown>>("shapes");
  const meta = provider.doc.getMap<unknown>("boardMeta");
  const active = items.find((s) => s.id === selected);
  const linkSource = connecting ? items.find((s) => s.id === connecting.from) : undefined;
  const linkTolerance = Math.max(8, Math.min(24, 18 / view.zoom));
  const linkTarget = connecting
    ? findLinkTarget(items, connecting.x, connecting.y, connecting.from, linkTolerance)
    : undefined;
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
    undo.current = new Y.UndoManager([shapes, meta], {
      trackedOrigins: new Set([origin]),
      captureTimeout: 500,
    });
    const dispose = provider.subscribe(update);
    shapes.observeDeep(update);
    meta.observeDeep(update);
    update();
    return () => {
      dispose();
      shapes.unobserveDeep(update);
      meta.unobserveDeep(update);
      undo.current?.destroy();
    };
  }, [provider, shapes, meta]);
  const loadThreads = async () => {
    try {
      const { data } = await api.get(`/documents/${provider.docId}/threads`);
      setThreads(Array.isArray(data) ? data : []);
      setCommentError("");
    } catch {
      setCommentError("评论加载失败，请检查权限或稍后重试。");
    }
  };
  useEffect(() => {
    void loadThreads();
    let revision = provider.metadataRevision;
    const unsubscribe = provider.subscribe(() => {
      if (provider.metadataRevision !== revision) {
        revision = provider.metadataRevision;
        void loadThreads();
      }
    });
    const timer = setInterval(loadThreads, 30000);
    return () => {
      clearInterval(timer);
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);
  useEffect(() => {
    if (!commentsOpen && !review) return;
    let active = true;
    api
      .get(`/documents/${provider.docId}/mentionable`)
      .then(({ data }) => {
        if (active) setMentionables(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setMentionables([]);
      });
    return () => {
      active = false;
    };
  }, [commentsOpen, review, provider.docId]);
  const point = (e: { clientX: number; clientY: number }) => {
    const p = svg.current!.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const result = p.matrixTransform(svg.current!.getScreenCTM()!.inverse());
    return {
      x: Math.max(-10000, Math.min(10000, snap ? Math.round(result.x / 20) * 20 : result.x)),
      y: Math.max(-10000, Math.min(10000, snap ? Math.round(result.y / 20) * 20 : result.y)),
    };
  };
  const change = (id: string, patch: Partial<BoardShape>) => {
    if (!provider.writable) return;
    const shape = shapes.get(id);
    if (!shape) return;
    const parsed = boardShape.safeParse({ ...shape.toJSON(), ...patch });
    if (!parsed.success) {
      setError("图形超出范围：画布坐标 ±10000，宽高 20–2000，文字最多 2000 字。");
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
    metaFor?: (id: string) => Record<string, unknown>,
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
        (type === "mind" ? "中心主题" : type === "note" ? "双击选中后，在属性中编辑便签" : ""),
      fill: type === "note" ? "#fef3c7" : "#dbeafe",
      order: Date.now(),
      ...extra,
    };
    for (const [key, value] of Object.entries(data)) shape.set(key, value);
    provider.doc.transact(() => {
      shapes.set(id, shape);
      meta.set(`layer:${id}`, activeLayer);
      for (const [key, value] of Object.entries(metaFor?.(id) || {})) meta.set(key, value);
    }, origin);
    undo.current?.stopCapturing();
    setError("");
    setSelectedIds(new Set([id]));
    setSelected(id);
    setTool("select");
    return id;
  };
  const createFreeArrow = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    if (Math.hypot(end.x - start.x, end.y - start.y) < 8) return;
    return create("connector", { x: 0, y: 0 }, {
      geometry: { x: 0, y: 0, w: 20, h: 20 },
      points: { x1: start.x, y1: start.y, x2: end.x, y2: end.y },
      text: "",
      fill: "#ffffff",
    });
  };
  const layers = readLayers(provider.doc);
  const layerMap = new Map(layers.map((layer) => [layer.id, layer]));
  const layerOf = (item: Item) => layerMap.get(item.layer || "default") || defaultLayers[0];
  const layerRank = (item: Item) => {
    const index = layers.findIndex((layer) => layer.id === (item.layer || "default"));
    return index < 0 ? 0 : index;
  };
  const itemLocked = (item: Item) => Boolean(item.locked) || layerOf(item).locked;
  const activeLocked = active ? itemLocked(active) : false;
  const selectedNodes = () =>
    items.filter(
      (s) => selectedIds.has(s.id) && s.type !== "connector" && !itemLocked(s),
    );
  const displayItems = [...items]
    .filter((item) => layerOf(item).visible)
    .sort(
      (a, b) =>
        (a.type === "connector" ? 1 : 0) - (b.type === "connector" ? 1 : 0) ||
        layerRank(a) - layerRank(b) ||
        a.order - b.order,
    );
  const exportArea = exportBounds(
    displayItems as ExportShape[],
    exportSelected && selectedIds.size > 0,
    selectedIds,
  );
  const writeMeta = (entries: [string, unknown][]) => {
    if (!provider.writable || !entries.length) return;
    undo.current?.stopCapturing();
    provider.doc.transact(() => {
      for (const [key, value] of entries) {
        if (value === undefined) meta.delete(key);
        else meta.set(key, value);
      }
    }, origin);
    undo.current?.stopCapturing();
    setItems(read(provider.doc));
  };
  const writeLayers = (next: BoardLayer[]) =>
    writeMeta([["layers", JSON.stringify(next)]]);
  const addLayer = () => {
    if (!provider.writable) return;
    const layer: BoardLayer = {
      id: crypto.randomUUID(),
      name: `图层 ${layers.length + 1}`,
      visible: true,
      locked: false,
    };
    writeLayers([...layers, layer]);
    setActiveLayer(layer.id);
  };
  const updateLayer = (id: string, patch: Partial<BoardLayer>) =>
    writeLayers(layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));
  const moveLayer = (id: string, direction: 1 | -1) => {
    const index = layers.findIndex((layer) => layer.id === id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= layers.length) return;
    const copy = [...layers];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    writeLayers(copy);
  };
  const assignToLayer = () => {
    const nodes = selectedNodes();
    if (!nodes.length || !provider.writable) return;
    writeMeta(nodes.map((item) => [`layer:${item.id}`, activeLayer]));
  };
  const groupSelection = () => {
    const nodes = selectedNodes().filter((item) => !itemLocked(item));
    if (nodes.length < 2 || !provider.writable) {
      setError("请选择至少两个未锁定图元后再分组。");
      return;
    }
    const groupId = crypto.randomUUID();
    writeMeta(nodes.map((item) => [`group:${item.id}`, groupId]));
  };
  const ungroupSelection = () => {
    const groups = new Set(selectedNodes().map((item) => item.group).filter(Boolean));
    if (!groups.size) return;
    const ids = items
      .filter((item) => item.group && groups.has(item.group))
      .map((item) => item.id);
    writeMeta(ids.map((id) => [`group:${id}`, undefined]));
  };
  const lockSelection = (locked: boolean) => {
    const ids = selectedIds.size ? [...selectedIds] : selected ? [selected] : [];
    const nodes = items.filter((item) => ids.includes(item.id) && item.type !== "connector");
    if (!nodes.length) return;
    writeMeta(nodes.map((item) => [`locked:${item.id}`, locked]));
  };
  const createFrame = () => {
    if (!provider.writable) return;
    const p = {
      x: view.x + 600 / view.zoom - 260,
      y: view.y + 400 / view.zoom - 170,
    };
    create(
      "rect",
      p,
      {
        text: "Frame",
        geometry: { x: p.x, y: p.y, w: 520, h: 340 },
      },
      (id) => ({ [`frame:${id}`]: true }),
    );
  };
  const applyFlowLayout = (style: "elbow" | "curve") => {
    if (!provider.writable) return;
    try {
      const { geometries, connectorStyles } = layoutFlow(displayItems, style);
      undo.current?.stopCapturing();
      provider.doc.transact(() => {
        for (const [id, geometry] of Object.entries(geometries))
          shapes.get(id)?.set("geometry", geometry);
        for (const [id, connectorStyle] of Object.entries(connectorStyles)) {
          const shape = shapes.get(id);
          const binding = shape?.get("binding") as BoardShape["binding"];
          if (binding) shape?.set("binding", { ...binding, style: connectorStyle });
        }
      }, origin);
      undo.current?.stopCapturing();
      setItems(read(provider.doc));
      setView(fitItems(read(provider.doc)));
      setLayoutOpen(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "自动布局失败。");
    }
  };
  const frameContents = (frame: Item) =>
    items.filter((item) => {
      if (item.id === frame.id || item.type === "connector" || item.frame) return false;
      const cx = item.geometry.x + item.geometry.w / 2,
        cy = item.geometry.y + item.geometry.h / 2;
      return (
        cx > frame.geometry.x &&
        cx < frame.geometry.x + frame.geometry.w &&
        cy > frame.geometry.y &&
        cy < frame.geometry.y + frame.geometry.h
      );
    });
  const clearGuides = () =>
    setGuides((current) => (current.v.length || current.h.length ? { v: [], h: [] } : current));
  const snapToGuides = (
    rect: Item["geometry"],
    exclude: Set<string>,
    dx: number,
    dy: number,
  ) => {
    if (!smart) return { dx, dy, v: [] as number[], h: [] as number[] };
    const tolerance = Math.max(3, Math.min(10, 6 / view.zoom));
    const targetsX: number[] = [],
      targetsY: number[] = [];
    for (const shape of items) {
      if (shape.type === "connector" || exclude.has(shape.id)) continue;
      const g = shape.geometry;
      targetsX.push(g.x, g.x + g.w / 2, g.x + g.w);
      targetsY.push(g.y, g.y + g.h / 2, g.y + g.h);
    }
    const movingX = [rect.x + dx, rect.x + dx + rect.w / 2, rect.x + dx + rect.w],
      movingY = [rect.y + dy, rect.y + dy + rect.h / 2, rect.y + dy + rect.h];
    let bestX: { delta: number; line: number } | null = null,
      bestY: { delta: number; line: number } | null = null;
    for (const from of movingX)
      for (const to of targetsX) {
        const delta = to - from;
        if (Math.abs(delta) <= tolerance && (!bestX || Math.abs(delta) < Math.abs(bestX.delta)))
          bestX = { delta, line: to };
      }
    for (const from of movingY)
      for (const to of targetsY) {
        const delta = to - from;
        if (Math.abs(delta) <= tolerance && (!bestY || Math.abs(delta) < Math.abs(bestY.delta)))
          bestY = { delta, line: to };
      }
    return {
      dx: dx + (bestX?.delta ?? 0),
      dy: dy + (bestY?.delta ?? 0),
      v: bestX ? [bestX.line] : [],
      h: bestY ? [bestY.line] : [],
    };
  };
  const writeGeometries = (next: Record<string, Item["geometry"]>) => {
    if (!provider.writable || !Object.keys(next).length) return;
    undo.current?.stopCapturing();
    provider.doc.transact(() => {
      for (const [id, geometry] of Object.entries(next)) shapes.get(id)?.set("geometry", geometry);
    }, origin);
    undo.current?.stopCapturing();
    setItems(read(provider.doc));
  };
  const alignSelection = (mode: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") => {
    const nodes = selectedNodes();
    if (nodes.length < 2) return;
    const left = Math.min(...nodes.map((s) => s.geometry.x)),
      right = Math.max(...nodes.map((s) => s.geometry.x + s.geometry.w)),
      top = Math.min(...nodes.map((s) => s.geometry.y)),
      bottom = Math.max(...nodes.map((s) => s.geometry.y + s.geometry.h));
    const next: Record<string, Item["geometry"]> = {};
    for (const shape of nodes) {
      const g = { ...shape.geometry };
      if (mode === "left") g.x = left;
      if (mode === "centerX") g.x = (left + right) / 2 - g.w / 2;
      if (mode === "right") g.x = right - g.w;
      if (mode === "top") g.y = top;
      if (mode === "centerY") g.y = (top + bottom) / 2 - g.h / 2;
      if (mode === "bottom") g.y = bottom - g.h;
      next[shape.id] = g;
    }
    writeGeometries(next);
  };
  const distributeSelection = (axis: "x" | "y") => {
    const nodes = selectedNodes();
    if (nodes.length < 3) return;
    const sorted = [...nodes].sort((a, b) =>
      axis === "x" ? a.geometry.x - b.geometry.x : a.geometry.y - b.geometry.y,
    );
    const first = sorted[0],
      last = sorted[sorted.length - 1];
    const start = axis === "x" ? first.geometry.x : first.geometry.y;
    const end =
      axis === "x"
        ? last.geometry.x + last.geometry.w
        : last.geometry.y + last.geometry.h;
    const total = sorted.reduce((sum, s) => sum + (axis === "x" ? s.geometry.w : s.geometry.h), 0);
    const gap = (end - start - total) / (sorted.length - 1);
    const next: Record<string, Item["geometry"]> = {};
    let cursor = start;
    for (const shape of sorted) {
      const g = { ...shape.geometry };
      if (axis === "x") g.x = cursor;
      else g.y = cursor;
      next[shape.id] = g;
      cursor += (axis === "x" ? g.w : g.h) + gap;
    }
    writeGeometries(next);
  };
  const duplicateSelection = () => {
    const nodes = selectedNodes();
    if (!provider.writable || !nodes.length || shapes.size + nodes.length > 500) return;
    undo.current?.stopCapturing();
    const ids: string[] = [];
    provider.doc.transact(() => {
      for (const shape of nodes) {
        const source = shapes.get(shape.id);
        if (!source) continue;
        const id = crypto.randomUUID();
        const copy = new Y.Map(Object.entries(source.toJSON()));
        copy.set("geometry", {
          ...shape.geometry,
          x: Math.min(9800, shape.geometry.x + 40),
          y: Math.min(9800, shape.geometry.y + 40),
        });
        copy.set("order", Date.now() + ids.length);
        shapes.set(id, copy);
        ids.push(id);
      }
    }, origin);
    undo.current?.stopCapturing();
    setItems(read(provider.doc));
    setSelectedIds(new Set(ids));
    setSelected(ids[0] || "");
  };
  const changeOrder = (mode: "front" | "back" | "forward" | "backward") => {
    if (!provider.writable) return;
    const ids = selectedIds.size ? selectedIds : new Set(selected ? [selected] : []);
    const nodes = items
      .filter((s) => s.type !== "connector")
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    const picked = new Set(
      nodes.filter((s) => ids.has(s.id) && !itemLocked(s)).map((s) => s.id),
    );
    if (!picked.size) return;
    const sequence = nodes.map((s) => s.id);
    if (mode === "front" || mode === "back") {
      const rest = sequence.filter((id) => !picked.has(id)),
        moving = sequence.filter((id) => picked.has(id));
      sequence.splice(0, sequence.length, ...(mode === "front" ? [...rest, ...moving] : [...moving, ...rest]));
    } else if (mode === "forward") {
      for (let i = sequence.length - 2; i >= 0; i--)
        if (picked.has(sequence[i]) && !picked.has(sequence[i + 1]))
          [sequence[i], sequence[i + 1]] = [sequence[i + 1], sequence[i]];
    } else {
      for (let i = 1; i < sequence.length; i++)
        if (picked.has(sequence[i]) && !picked.has(sequence[i - 1]))
          [sequence[i], sequence[i - 1]] = [sequence[i - 1], sequence[i]];
    }
    if (sequence.every((id, i) => nodes[i].id === id)) return;
    undo.current?.stopCapturing();
    provider.doc.transact(() => {
      sequence.forEach((id, i) => shapes.get(id)?.set("order", i + 1));
    }, origin);
    undo.current?.stopCapturing();
    setItems(read(provider.doc));
  };
  const canComment = ["OWNER", "EDITOR", "COMMENTER"].includes(provider.role);
  const shapeThreads = new Map<string, BoardThread[]>();
  for (const thread of threads) {
    const shapeId = threadShapeId(thread);
    if (!shapeId) continue;
    const list = shapeThreads.get(shapeId) || [];
    list.push(thread);
    shapeThreads.set(shapeId, list);
  }
  const sortedThreads = [...threads].sort(
    (a, b) =>
      Number(a.resolved) - Number(b.resolved) ||
      String(b.createdAt).localeCompare(String(a.createdAt)),
  );
  const unresolvedThreads = threads.filter((t) => !t.resolved);
  const selectedShape = items.find((s) => s.id === selected && s.type !== "connector");
  const commentedShapeIds = new Set(unresolvedThreads.map(threadShapeId).filter(Boolean));
  const dimIds =
    review && unresolvedThreads.length
      ? new Set(
          items
            .filter((s) => s.type !== "connector" && !commentedShapeIds.has(s.id))
            .map((s) => s.id),
        )
      : undefined;
  const commentAction = async (fn: () => Promise<unknown>) => {
    if (commentBusy) return;
    setCommentBusy(true);
    try {
      await fn();
      await loadThreads();
      setCommentError("");
    } catch (e: any) {
      setCommentError(e?.response?.data?.message || "评论操作失败，请重试。");
    } finally {
      setCommentBusy(false);
    }
  };
  const addThread = () => {
    const shape = selectedShape;
    const body = commentDraft.trim();
    if (!canComment || !shape || !body) return;
    void commentAction(async () => {
      await api.post(`/documents/${provider.docId}/threads`, {
        id: crypto.randomUUID(),
        body,
        quote: (shape.text || shape.type).slice(0, 1000),
        anchor: shapeAnchor(shape.id),
      });
      setCommentDraft("");
    });
  };
  const appendMention = (name: string) =>
    setCommentDraft((draft) => `${draft}${draft && !/\s$/.test(draft) ? " " : ""}@${name} `);
  const appendReplyMention = (name: string) =>
    setReplyDraft((draft) => `${draft}${draft && !/\s$/.test(draft) ? " " : ""}@${name} `);
  const toggleResolve = (thread: BoardThread) =>
    void commentAction(() =>
      api.patch(`/documents/${provider.docId}/threads/${thread.id}`, {
        resolved: !thread.resolved,
        revision: thread.revision,
      }),
    );
  const sendReply = (thread: BoardThread) => {
    const body = replyDraft.trim();
    if (!body) return;
    void commentAction(async () => {
      await api.post(`/documents/${provider.docId}/threads/${thread.id}/replies`, {
        id: crypto.randomUUID(),
        body,
      });
      setReplyDraft("");
      setReplyTo("");
    });
  };
  const jumpThread = (thread: BoardThread) => {
    const shapeId = threadShapeId(thread);
    const shape = items.find((s) => s.id === shapeId);
    if (!shape) return;
    setTool("select");
    setSelected(shapeId);
    setSelectedIds(new Set([shapeId]));
    setView((current) => {
      const zoom = Math.max(0.05, Math.min(3, current.zoom));
      return {
        ...current,
        x: shape.geometry.x + shape.geometry.w / 2 - 600 / zoom,
        y: shape.geometry.y + shape.geometry.h / 2 - 400 / zoom,
      };
    });
    setActiveThread(thread.id);
    setCommentsOpen(true);
    setCommentError("");
  };
  const nextOpenThread = () => {
    const open = threads.filter(
      (t) => !t.resolved && items.some((s) => s.id === threadShapeId(t)),
    );
    if (!open.length) {
      setCommentError("暂无待处理的图元评论。");
      return;
    }
    const index = open.findIndex((t) => t.id === activeThread);
    jumpThread(open[(index + 1) % open.length]);
  };
  useEffect(() => {
    // Notification deep links: open the comment panel, focus the thread/shape.
    if (deepLink.current) return;
    const params = new URLSearchParams(window.location.search);
    const threadId = params.get("thread");
    const shapeId = params.get("shape");
    if (!threadId && !shapeId) {
      deepLink.current = true;
      return;
    }
    const thread =
      (threadId && threads.find((t) => t.id === threadId)) ||
      (shapeId && threads.find((t) => threadShapeId(t) === shapeId)) ||
      undefined;
    if (thread) {
      deepLink.current = true;
      jumpThread(thread);
      return;
    }
    const shape = shapeId ? items.find((s) => s.id === shapeId) : undefined;
    if (shape) {
      deepLink.current = true;
      setTool("select");
      setSelected(shape.id);
      setSelectedIds(new Set([shape.id]));
      setView((current) => {
        const zoom = Math.max(0.05, Math.min(3, current.zoom));
        return {
          ...current,
          x: shape.geometry.x + shape.geometry.w / 2 - 600 / zoom,
          y: shape.geometry.y + shape.geometry.h / 2 - 400 / zoom,
        };
      });
      setCommentsOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, items]);
  const shareUrl = (token: string) => `${window.location.origin}/share/${token}`;
  const loadShares = async () => {
    try {
      const { data } = await api.get(`/documents/${provider.docId}/shares`);
      setShareLinks(Array.isArray(data) ? data : []);
      setShareError("");
    } catch {
      setShareError("分享列表加载失败，请稍后重试。");
    }
  };
  const openShare = () => {
    setShareOpen(true);
    setShareError("");
    void loadShares();
  };
  const createShareLink = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    setShareError("");
    try {
      const mermaid = provider.doc.getText("mermaid").toString();
      const snapshot = displayItems.length
        ? { view: "canvas", items: displayItems }
        : { view: "mermaid", source: mermaid };
      const { data } = await api.post(`/documents/${provider.docId}/shares`, {
        kind: "BOARD",
        snapshot,
        expiresInDays: shareExpiry === "0" ? null : Number(shareExpiry),
      });
      setShareLinks((links) => [data, ...links]);
      try {
        await navigator.clipboard.writeText(shareUrl(data.token));
        setShareCopied(data.token);
        setTimeout(() => setShareCopied(""), 4000);
      } catch {
        setShareCopied("");
      }
    } catch (e: any) {
      setShareError(e?.response?.data?.message || "创建分享链接失败，请稍后重试。");
    } finally {
      setShareBusy(false);
    }
  };
  const revokeShareLink = async (token: string) => {
    if (shareBusy) return;
    setShareBusy(true);
    setShareError("");
    try {
      await api.post(`/documents/${provider.docId}/shares/${token}/revoke`);
      await loadShares();
    } catch {
      setShareError("撤销失败，请稍后重试。");
    } finally {
      setShareBusy(false);
    }
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
          ...items.filter((s) => s.type !== "connector").map((s) => s.geometry.y + s.geometry.h),
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
          place("mind", { x: 380, y: 100 + i * 140 }, { parent: root, text, fill: colors[i] }),
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
          place("connector", { x: 0, y: 0 }, { text, binding: { from, to, style: "elbow" } }),
        );
      }
    }, origin);
    undo.current?.stopCapturing();
    setView(fitItems(read(provider.doc)));
  };
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = point(e);
    clearGuides();
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
    if (tool === "arrow") {
      arrowStart.current = p;
      setArrowDraft({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      setSelected("");
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (tool !== "select") {
      create(tool as BoardShape["type"], p);
      return;
    }
    marqueeStart.current = p;
    setMarquee({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    if (!e.shiftKey) {
      setSelectedIds(new Set());
      setSelected("");
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const select = (e: React.PointerEvent<SVGGElement>, item: Item) => {
    if (tool === "pan") return;
    e.stopPropagation();
    if (tool === "arrow") {
      beginLink(e, item);
      return;
    }
    if (!["select", "pan", "connect"].includes(tool)) {
      create(tool as BoardShape["type"], point(e));
      return;
    }
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
    if (e.shiftKey) {
      const next = new Set(selectedIds);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      setSelectedIds(next);
      setSelected(next.has(item.id) ? item.id : [...next][0] || "");
      return;
    }
    if (itemLocked(item)) {
      setSelectedIds(new Set([item.id]));
      setSelected(item.id);
      return;
    }
    if (item.group) {
      const members = items.filter(
        (s) => s.group === item.group && s.type !== "connector" && layerOf(s).visible,
      );
      setSelectedIds(new Set(members.map((s) => s.id)));
      setSelected(item.id);
      if (!provider.writable) return;
      const movable = members.filter((s) => !itemLocked(s));
      if (movable.length) {
        groupDrag.current = {
          start: point(e),
          geometries: Object.fromEntries(movable.map((s) => [s.id, s.geometry])),
        };
        svg.current?.setPointerCapture(e.pointerId);
      }
      return;
    }
    if (item.frame) {
      const children = frameContents(item).filter((s) => !itemLocked(s));
      setSelectedIds(new Set([item.id, ...children.map((s) => s.id)]));
      setSelected(item.id);
      if (!provider.writable) return;
      groupDrag.current = {
        start: point(e),
        geometries: Object.fromEntries(
          [item, ...children].map((s) => [s.id, s.geometry]),
        ),
      };
      svg.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (!selectedIds.has(item.id)) {
      setSelectedIds(new Set([item.id]));
      setSelected(item.id);
    }
    if (!provider.writable) return;
    if (item.type === "connector") return;
    if (itemLocked(item)) return;
    if (selectedIds.has(item.id) && selectedIds.size > 1) {
      const geometries = Object.fromEntries(
        items
          .filter((s) => selectedIds.has(s.id) && s.type !== "connector")
          .map((s) => [s.id, s.geometry]),
      );
      groupDrag.current = { start: point(e), geometries };
      svg.current?.setPointerCapture(e.pointerId);
      return;
    }
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
    const rotation = rotateDrag.current;
    if (rotation) {
      const angle = (Math.atan2(p.y - rotation.center.y, p.x - rotation.center.x) * 180) / Math.PI;
      const degrees = ((rotation.startRotation + angle - rotation.startAngle) % 360 + 360) % 360;
      rotation.latest = Math.round(degrees * 10) / 10;
      setItems((current) =>
        current.map((s) => (s.id === rotation.id ? { ...s, rotation: rotation.latest } : s)),
      );
      return;
    }
    if (arrowStart.current) {
      setArrowDraft({
        x1: arrowStart.current.x,
        y1: arrowStart.current.y,
        x2: p.x,
        y2: p.y,
      });
      return;
    }
    if (marqueeStart.current) {
      setMarquee({
        x1: marqueeStart.current.x,
        y1: marqueeStart.current.y,
        x2: p.x,
        y2: p.y,
      });
      return;
    }
    if (groupDrag.current) {
      const g = groupDrag.current,
        boxes = Object.values(g.geometries),
        left = Math.min(...boxes.map((b) => b.x)),
        top = Math.min(...boxes.map((b) => b.y)),
        right = Math.max(...boxes.map((b) => b.x + b.w)),
        bottom = Math.max(...boxes.map((b) => b.y + b.h));
      const snapped = snapToGuides(
        { x: left, y: top, w: right - left, h: bottom - top },
        new Set(Object.keys(g.geometries)),
        p.x - g.start.x,
        p.y - g.start.y,
      );
      setGuides({ v: snapped.v, h: snapped.h });
      const dx = snapped.dx,
        dy = snapped.dy;
      const latest: Record<string, Item["geometry"]> = {};
      for (const [id, geometry] of Object.entries(g.geometries)) {
        latest[id] = {
          ...geometry,
          x: Math.max(-10000, Math.min(10000, geometry.x + dx)),
          y: Math.max(-10000, Math.min(10000, geometry.y + dy)),
        };
      }
      g.latest = latest;
      setItems((current) =>
        current.map((s) => (latest[s.id] ? { ...s, geometry: latest[s.id] } : s)),
      );
      return;
    }
    if (connectingRef.current) {
      connectingRef.current = { ...connectingRef.current, x: p.x, y: p.y };
      setConnecting(connectingRef.current);
      return;
    }
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
    if (d.mode === "resize") {
      const g = { ...d.geometry };
      g.w = Math.max(20, Math.min(2000, g.w + p.x - d.start.x));
      g.h = Math.max(20, Math.min(2000, g.h + p.y - d.start.y));
      d.latest = g;
      setItems((current) => current.map((s) => (s.id === d.id ? { ...s, geometry: g } : s)));
      return;
    }
    const snapped = snapToGuides(
      d.geometry,
      new Set(d.id ? [d.id] : []),
      p.x - d.start.x,
      p.y - d.start.y,
    );
    setGuides({ v: snapped.v, h: snapped.h });
    const g = {
      ...d.geometry,
      x: Math.max(-10000, Math.min(10000, d.geometry.x + snapped.dx)),
      y: Math.max(-10000, Math.min(10000, d.geometry.y + snapped.dy)),
    };
    // Local drag preview is smooth; one atomic geometry update commits on release.
    d.latest = g;
    setItems((current) => current.map((s) => (s.id === d.id ? { ...s, geometry: g } : s)));
  };
  const finish = (e?: React.PointerEvent<SVGSVGElement>) => {
    clearGuides();
    const rotation = rotateDrag.current;
    if (rotation) {
      rotateDrag.current = null;
      if (rotation.latest !== undefined)
        writeMeta([[`rotation:${rotation.id}`, rotation.latest]]);
      return;
    }
    const marqueeOrigin = marqueeStart.current;
    if (marqueeOrigin) {
      marqueeStart.current = null;
      const end = e ? point(e) : { x: marqueeOrigin.x, y: marqueeOrigin.y };
      const moved = Math.hypot(end.x - marqueeOrigin.x, end.y - marqueeOrigin.y) > 4;
      const x1 = Math.min(marqueeOrigin.x, end.x),
        y1 = Math.min(marqueeOrigin.y, end.y),
        x2 = Math.max(marqueeOrigin.x, end.x),
        y2 = Math.max(marqueeOrigin.y, end.y);
      const picked = moved
        ? items
            .filter(
              (s) =>
                s.type !== "connector" &&
                s.geometry.x < x2 &&
                s.geometry.x + s.geometry.w > x1 &&
                s.geometry.y < y2 &&
                s.geometry.y + s.geometry.h > y1,
            )
            .map((s) => s.id)
        : [];
      setSelectedIds((current) =>
        e?.shiftKey ? new Set([...current, ...picked]) : new Set(picked),
      );
      setSelected(picked[0] || (e?.shiftKey ? selected : ""));
      setMarquee(null);
      return;
    }
    const gd = groupDrag.current;
    if (gd) {
      groupDrag.current = null;
      if (gd.latest) writeGeometries(gd.latest);
      return;
    }
    const start = arrowStart.current;
    if (start) {
      arrowStart.current = null;
      setArrowDraft(null);
      if (e) createFreeArrow(start, point(e));
      return;
    }
    const link = connectingRef.current;
    if (link) {
      connectingRef.current = null;
      setConnecting(null);
      const moved = Math.hypot(link.x - link.startX, link.y - link.startY) > 6;
      if (!moved) return;
      // Read the authoritative Y.Doc, not React state: a shape created a moment ago
      // may not have rendered yet when the user drops the connector.
      const target = findLinkTarget(read(provider.doc), link.x, link.y, link.from, linkTolerance);
      if (target) {
        const id = create(
          "connector",
          { x: 0, y: 0 },
          { binding: { from: link.from, to: target.id, style: "elbow" } },
        );
        if (id) setSelected(id);
      } else {
        createFreeArrow({ x: link.startX, y: link.startY }, { x: link.x, y: link.y });
      }
      return;
    }
    const d = drag.current;
    drag.current = undefined;
    if (d?.id && d.latest) {
      change(d.id, { geometry: d.latest });
      undo.current?.stopCapturing();
    }
  };
  const beginLink = (e: React.PointerEvent<SVGElement>, item: Item) => {
    if (!provider.writable) return;
    e.stopPropagation();
    e.preventDefault();
    const p = point(e);
    connectingRef.current = { from: item.id, x: p.x, y: p.y, startX: p.x, startY: p.y };
    setConnecting(connectingRef.current);
    setSelected(item.id);
    setTool("select");
    svg.current?.setPointerCapture(e.pointerId);
  };
  const startConnect = (e: React.PointerEvent<SVGCircleElement>, item: Item) => beginLink(e, item);
  const remove = () => {
    const ids = (selectedIds.size ? [...selectedIds] : selected ? [selected] : []).filter(
      (id) => {
        const item = items.find((s) => s.id === id);
        return !item || !itemLocked(item);
      },
    );
    if (!provider.writable || !ids.length) return;
    const targets = new Set(ids);
    undo.current?.stopCapturing();
    provider.doc.transact(() => {
      for (const id of ids) shapes.delete(id);
      for (const [id, s] of shapes) {
        const b = s.get("binding") as BoardShape["binding"];
        if (b && (targets.has(b.from) || targets.has(b.to))) shapes.delete(id);
      }
    }, origin);
    undo.current?.stopCapturing();
    setSelectedIds(new Set());
    setSelected("");
  };
  return (
    <section aria-label="实时白板" className="flex flex-col">
      {projectId && (
        <BoardAgent
          provider={provider}
          projectId={projectId}
          selected={selected}
          origin={origin}
          stopUndo={() => undo.current?.stopCapturing()}
        />
      )}
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-[var(--paper-raised)] p-2 shadow-sm"
        role="toolbar"
        aria-label="白板工具"
      >
        <label className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />{" "}
          网格吸附
        </label>
        <label className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={smart}
            onChange={(e) => {
              setSmart(e.target.checked);
              if (!e.target.checked) clearGuides();
            }}
          />{" "}
          智能参考线
        </label>
        <span className="h-6 w-px bg-slate-200" />
        <Button
          size="sm"
          variant="ghost"
          disabled={!provider.writable || !items.some((s) => s.type === "mind")}
          onClick={layout}
        >
          自动布局导图
        </Button>
        <span className="h-6 w-px bg-slate-200" />
        <Button
          size="sm"
          variant={layersOpen ? "secondary" : "ghost"}
          disabled={!provider.writable}
          onClick={() => {
            setLayersOpen((v) => !v);
            setShapePanel(false);
          }}
        >
          <Layers size={14} /> 图层
        </Button>
        <Button size="sm" variant="ghost" disabled={!provider.writable} onClick={createFrame}>
          <Frame size={14} /> Frame
        </Button>
        <div className="relative">
          <Button
            size="sm"
            variant="ghost"
            disabled={!provider.writable}
            onClick={() => setLayoutOpen((v) => !v)}
          >
            <GitBranch size={14} /> 布局流程
          </Button>
          {layoutOpen && (
            <div className="absolute left-0 top-9 z-40 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
              <button
                type="button"
                className="block w-full rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-indigo-50"
                onClick={() => applyFlowLayout("elbow")}
              >
                正交布局
              </button>
              <button
                type="button"
                className="block w-full rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-indigo-50"
                onClick={() => applyFlowLayout("curve")}
              >
                曲线布局
              </button>
            </div>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setExportOpen(true)}>
          <FileImage size={14} /> 导出图片
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!["OWNER", "EDITOR"].includes(provider.role)}
          onClick={openShare}
        >
          <Share2 size={14} /> 分享
        </Button>
        <span className="h-6 w-px bg-slate-200" />
        <Button
          size="sm"
          variant={commentsOpen ? "secondary" : "ghost"}
          aria-label="打开图元评论"
          aria-pressed={commentsOpen}
          onClick={() => {
            if (review) setReview(false);
            setCommentsOpen((v) => !v);
          }}
        >
          <MessageSquare size={14} /> 评论{unresolvedThreads.length ? ` (${unresolvedThreads.length})` : ""}
        </Button>
        <Button
          size="sm"
          variant={review ? "secondary" : "ghost"}
          aria-label="评审模式"
          aria-pressed={review}
          onClick={() => {
            setReview((v) => !v);
            setCommentsOpen(true);
          }}
        >
          <CheckCircle2 size={14} /> 评审模式
        </Button>
        <span className="h-6 w-px bg-slate-200" />
        <Button
          size="sm"
          variant="ghost"
          aria-label="撤销"
          disabled={!provider.writable || !undo.current?.canUndo()}
          onClick={() => undo.current?.undo()}
        >
          <Undo2 size={14} /> 撤销
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="重做"
          disabled={!provider.writable || !undo.current?.canRedo()}
          onClick={() => undo.current?.redo()}
        >
          <Redo2 size={14} /> 重做
        </Button>
        <span className="h-6 w-px bg-slate-200" />
        <Button
          size="sm"
          variant="ghost"
          aria-label="缩小白板"
          onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.03, v.zoom - 0.25) }))}
        >
          −
        </Button>
        <button
          type="button"
          onClick={() => setView({ x: 0, y: 0, zoom: 1 })}
          className="min-w-16 rounded-lg px-2 py-1.5 font-mono text-xs text-slate-600 transition hover:bg-slate-100"
          title="复位视图"
        >
          {Math.round(view.zoom * 100)}%
        </button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="放大白板"
          onClick={() => setView((v) => ({ ...v, zoom: Math.min(3, v.zoom + 0.25) }))}
        >
          ＋
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setView(fitItems(displayItems))}>
          <LayoutGrid size={14} /> 适应全部
        </Button>
        <span className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const copy = svg.current?.cloneNode(true) as SVGSVGElement | undefined;
              if (!copy) return;
              copy
                .querySelectorAll(
                  '[data-testid="board-resize"], [data-testid="board-connect-hit"], [data-testid="board-connect-handle"], [aria-label$="的白板光标"]',
                )
                .forEach((n) => n.remove());
              const nodes = items.filter((s) => s.type !== "connector" || s.points);
              const xs = nodes.flatMap((s) =>
                  s.points ? [s.points.x1, s.points.x2] : [s.geometry.x, s.geometry.x + s.geometry.w],
                ),
                ys = nodes.flatMap((s) =>
                  s.points ? [s.points.y1, s.points.y2] : [s.geometry.y, s.geometry.y + s.geometry.h],
                );
              const x = Math.min(0, ...xs) - 30,
                y = Math.min(0, ...ys) - 30;
              const w = Math.max(900, ...xs) - x + 30,
                h = Math.max(600, ...ys) - y + 30;
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
          >
            <Download size={14} /> 导出 SVG
          </Button>
          <Button
            size="sm"
            variant="ghost"
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
          >
            导出草稿
          </Button>
        </span>
      </div>
      <p aria-live="polite" className="px-1 py-0.5 text-[11px] leading-5 text-slate-500">
        {tool === "arrow"
          ? "从一个图元内部拖到另一个图元生成连接线；从空白处拖动生成自由箭头。"
          : tool === "connect"
            ? connectFrom
              ? "请选择终点节点；连接线会跟随节点移动。"
              : "依次点击两个节点，或从图形边缘的蓝点拖到目标图形。"
            : "选择图元工具后点击画布放置；选中图形后拖动边缘蓝点，或使用箭头工具拖线。"}
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
      {selectedIds.size > 1 && (
        <div
          role="toolbar"
          aria-label="多选对齐"
          className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 p-2"
        >
          <span className="px-1 text-xs font-medium text-indigo-800">
            已选 {selectedIds.size} 个
          </span>
          <span className="h-5 w-px bg-indigo-200" />
          <Button size="sm" variant="secondary" disabled={!provider.writable} onClick={() => alignSelection("left")}>
            左对齐
          </Button>
          <Button size="sm" variant="secondary" disabled={!provider.writable} onClick={() => alignSelection("centerX")}>
            水平居中
          </Button>
          <Button size="sm" variant="secondary" disabled={!provider.writable} onClick={() => alignSelection("right")}>
            右对齐
          </Button>
          <Button size="sm" variant="secondary" disabled={!provider.writable} onClick={() => alignSelection("top")}>
            顶对齐
          </Button>
          <Button size="sm" variant="secondary" disabled={!provider.writable} onClick={() => alignSelection("centerY")}>
            垂直居中
          </Button>
          <Button size="sm" variant="secondary" disabled={!provider.writable} onClick={() => alignSelection("bottom")}>
            底对齐
          </Button>
          <span className="h-5 w-px bg-indigo-200" />
          <Button size="sm" variant="ghost" disabled={!provider.writable || selectedIds.size < 3} onClick={() => distributeSelection("x")}>
            水平分布
          </Button>
          <Button size="sm" variant="ghost" disabled={!provider.writable || selectedIds.size < 3} onClick={() => distributeSelection("y")}>
            垂直分布
          </Button>
          <span className="h-5 w-px bg-indigo-200" />
          <Button size="sm" variant="ghost" disabled={!provider.writable} onClick={() => changeOrder("front")}>
            置顶
          </Button>
          <Button size="sm" variant="ghost" disabled={!provider.writable} onClick={() => changeOrder("back")}>
            置底
          </Button>
          <span className="h-5 w-px bg-indigo-200" />
          <Button
            size="sm"
            variant="ghost"
            disabled={!provider.writable || selectedNodes().length < 2}
            onClick={groupSelection}
          >
            <Group size={13} /> 分组
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!provider.writable}
            onClick={ungroupSelection}
          >
            <Ungroup size={13} /> 取消分组
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!provider.writable}
            onClick={() => lockSelection(true)}
          >
            <Lock size={13} /> 锁定
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!provider.writable}
            onClick={() => lockSelection(false)}
          >
            <Unlock size={13} /> 解锁
          </Button>
          <Button size="sm" variant="ghost" disabled={!provider.writable} onClick={duplicateSelection}>
            复制所选
          </Button>
          <Button size="sm" variant="danger" disabled={!provider.writable} onClick={remove}>
            删除所选
          </Button>
        </div>
      )}
      <div className="mt-2 flex min-h-0 items-stretch gap-2">
        <nav
          aria-label="画布工具"
          className="flex w-14 shrink-0 flex-col items-center gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-[var(--paper-raised)] p-1.5 shadow-sm"
        >
          {tools.map(([key, label]) => {
            const Icon =
              key === "select"
                ? MousePointer2
                : key === "pan"
                  ? Hand
                  : key === "rect"
                    ? Square
                    : key === "ellipse"
                      ? Circle
                      : key === "note"
                        ? StickyNote
                        : key === "text"
                          ? Type
                          : key === "arrow"
                            ? ArrowUpRight
                            : key === "diamond"
                              ? Diamond
                              : key === "mind"
                                ? GitBranch
                                : key === "connect"
                                  ? Spline
                                  : null;
            return (
              <button
                key={key}
                aria-label={label}
                title={label}
                aria-pressed={tool === key}
                disabled={!provider.writable && !["select", "pan"].includes(key)}
                onClick={() => {
                  setTool(key);
                  setConnectFrom("");
                }}
                className={`grid size-10 shrink-0 place-items-center rounded-xl transition disabled:opacity-40 ${
                  tool === key
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {Icon ? (
                  <Icon className="size-[18px]" aria-hidden="true" />
                ) : (
                  <span className="pointer-events-none block size-6">
                    <ShapeGlyph type={key as BoardShape["type"]} />
                  </span>
                )}
              </button>
            );
          })}
          <span className="my-0.5 h-px w-6 bg-slate-200" />
          <button
            type="button"
            aria-label="更多图元"
            title="更多图元"
            aria-expanded={shapePanel}
            onClick={() => {
              setShapePanel((value) => !value);
              setLayersOpen(false);
            }}
            className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${
              shapePanel
                ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Shapes className="size-[18px]" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="模板"
            title="模板"
            aria-expanded={templatePanel}
            onClick={() => {
              setTemplatePanel((value) => !value);
              setShapePanel(false);
              setLayersOpen(false);
            }}
            className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${
              templatePanel
                ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <LayoutTemplate className="size-[18px]" aria-hidden="true" />
          </button>
        </nav>
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {templatePanel && (
            <div className="absolute left-3 top-3 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <div className="flex items-center justify-between px-1 pb-1.5">
                <p className="text-xs font-semibold text-slate-700">模板</p>
                <button
                  type="button"
                  aria-label="关闭模板面板"
                  onClick={() => setTemplatePanel(false)}
                  className="rounded-md px-1 text-sm text-slate-400 hover:bg-slate-100"
                >
                  ×
                </button>
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  aria-label="流程图模板"
                  disabled={!provider.writable}
                  onClick={() => {
                    template(false);
                    setTemplatePanel(false);
                  }}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-medium text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40"
                >
                  流程图模板
                  <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
                    流程节点与连接线
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="思维导图模板"
                  disabled={!provider.writable}
                  onClick={() => {
                    template(true);
                    setTemplatePanel(false);
                  }}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-medium text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40"
                >
                  思维导图模板
                  <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
                    中心主题与分支
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Mermaid 源码"
                  onClick={() => {
                    setSourceOpen((v) => !v);
                    setTemplatePanel(false);
                  }}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-medium text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700"
                >
                  Mermaid 源码
                  <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
                    用文字生成图形
                  </span>
                </button>
              </div>
            </div>
          )}
          {shapePanel && (
            <div className="absolute left-3 top-3 z-20 flex max-h-[70%] w-72 flex-col rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <div className="flex items-center justify-between px-1 pb-1.5">
                <p className="text-xs font-semibold text-slate-700">更多图元</p>
                <button
                  type="button"
                  aria-label="关闭更多图元"
                  onClick={() => setShapePanel(false)}
                  className="rounded-md px-1 text-sm text-slate-400 hover:bg-slate-100"
                >
                  ×
                </button>
              </div>
              <label className="relative mb-2 block">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-2 top-2.5 text-slate-400"
                />
                <input
                  aria-label="搜索图元"
                  value={shapeSearch}
                  onChange={(e) => setShapeSearch(e.target.value)}
                  placeholder="搜索 UML、ERD、K8s、BPMN…"
                  className="w-full rounded-lg border border-slate-200 py-1.5 pl-7 pr-2 text-xs"
                />
              </label>
              <div className="grid min-h-0 grid-cols-4 gap-1 overflow-y-auto">
                {shapeCatalog
                  .filter((s) => {
                    const query = shapeSearch.trim().toLowerCase();
                    return (
                      !query ||
                      (s.label + " " + s.type + " " + (s.keywords || "") + " " + s.group)
                        .toLowerCase()
                        .includes(query)
                    );
                  })
                  .map((s) => (
                  <button
                    key={s.type}
                    draggable={provider.writable}
                    disabled={!provider.writable}
                    aria-label={`图元 ${s.label}`}
                    title={s.label}
                    aria-pressed={tool === s.type}
                    onDragStart={(e) => {
                      if (!provider.writable) {
                        e.preventDefault();
                        return;
                      }
                      e.dataTransfer.setData("application/x-collabspace-shape", s.type);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => {
                      setTool(s.type);
                      setShapePanel(false);
                    }}
                    className="flex flex-col items-center gap-1 rounded-lg p-1.5 text-[10px] text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                  >
                    <span className="pointer-events-none block size-6">
                      <ShapeGlyph type={s.type} />
                    </span>
                    <span className="max-w-full truncate">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {layersOpen && (
            <div className="absolute left-3 top-3 z-20 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <div className="flex items-center justify-between px-1 pb-1.5">
                <p className="text-xs font-semibold text-slate-700">图层</p>
                <button
                  type="button"
                  aria-label="关闭图层面板"
                  onClick={() => setLayersOpen(false)}
                  className="rounded-md px-1 text-sm text-slate-400 hover:bg-slate-100"
                >
                  ×
                </button>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                disabled={!provider.writable}
                onClick={addLayer}
              >
                + 新建图层
              </Button>
              <div className="mt-2 space-y-1">
                {[...layers].reverse().map((layer) => {
                  const count = items.filter(
                    (item) => (item.layer || "default") === layer.id,
                  ).length;
                  return (
                    <div
                      key={layer.id}
                      className={`flex items-center gap-1 rounded-lg border px-1.5 py-1 ${
                        activeLayer === layer.id
                          ? "border-indigo-200 bg-indigo-50/70"
                          : "border-transparent hover:bg-slate-50"
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-xs text-slate-700"
                        onClick={() => setActiveLayer(layer.id)}
                        title={layer.name}
                      >
                        {layer.name}
                        <span className="ml-1 text-[10px] text-slate-400">{count}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`${layer.visible ? "隐藏" : "显示"} ${layer.name}`}
                        disabled={!provider.writable}
                        onClick={() => {
                          if (layer.visible && selected) {
                            const activeItem = items.find((item) => item.id === selected);
                            if (activeItem && (activeItem.layer || "default") === layer.id) {
                              setSelected("");
                              setSelectedIds(new Set());
                            }
                          }
                          updateLayer(layer.id, { visible: !layer.visible });
                        }}
                        className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-40"
                      >
                        {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button
                        type="button"
                        aria-label={`${layer.locked ? "解锁" : "锁定"} ${layer.name}`}
                        disabled={!provider.writable}
                        onClick={() => updateLayer(layer.id, { locked: !layer.locked })}
                        className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-40"
                      >
                        {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
                      </button>
                      <button
                        type="button"
                        aria-label={`上移 ${layer.name}`}
                        disabled={!provider.writable}
                        onClick={() => moveLayer(layer.id, 1)}
                        className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`下移 ${layer.name}`}
                        disabled={!provider.writable}
                        onClick={() => moveLayer(layer.id, -1)}
                        className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-40"
                      >
                        ↓
                      </button>
                    </div>
                  );
                })}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 w-full"
                disabled={!provider.writable || !selectedNodes().length}
                onClick={assignToLayer}
              >
                移入当前图层
              </Button>
              <p className="mt-1 px-1 text-[10px] leading-4 text-slate-400">
                面板顶部为最上层；隐藏或锁定图层会影响其中所有图元。
              </p>
            </div>
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
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
            e.preventDefault();
            const ids = items.filter((s) => s.type !== "connector").map((s) => s.id);
            setSelectedIds(new Set(ids));
            setSelected(ids[0] || "");
            return;
          }
          if (active?.type === "mind" && (e.key === "Tab" || e.key === "Enter")) {
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
            setSelectedIds(new Set());
            arrowStart.current = null;
            setArrowDraft(null);
            marqueeStart.current = null;
            setMarquee(null);
            groupDrag.current = null;
            rotateDrag.current = null;
            clearGuides();
          }
        }}
        viewBox={`${view.x} ${view.y} ${1200 / view.zoom} ${800 / view.zoom}`}
        className="h-[max(520px,calc(100dvh-17rem))] w-full touch-none bg-slate-50"
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
          const type = e.dataTransfer.getData("application/x-collabspace-shape");
          const entry = shapeCatalog.find((s) => s.type === type);
          if (entry) create(entry.type, point(e));
        }}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={() => {
          drag.current = undefined;
          connectingRef.current = null;
          setConnecting(null);
          arrowStart.current = null;
          setArrowDraft(null);
          marqueeStart.current = null;
          setMarquee(null);
          groupDrag.current = null;
          rotateDrag.current = null;
          clearGuides();
          setItems(read(provider.doc));
        }}
        onLostPointerCapture={() => {
          if (connectingRef.current) {
            connectingRef.current = null;
            setConnecting(null);
          }
          arrowStart.current = null;
          setArrowDraft(null);
          marqueeStart.current = null;
          setMarquee(null);
          groupDrag.current = null;
          drag.current = undefined;
          rotateDrag.current = null;
          clearGuides();
        }}
        onPointerLeave={() => {
          if (!drag.current) provider.cursor(null);
        }}
      >
        <defs>
          <pattern id={`${marker}-grid`} width="20" height="20" patternUnits="userSpaceOnUse">
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
          items={displayItems}
          selected={selected}
          selectedIds={selectedIds}
          dimIds={dimIds}
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
        {(guides.v.length > 0 || guides.h.length > 0) && (
          <g data-testid="align-guides" pointerEvents="none" aria-label="对齐参考线">
            {guides.v.map((x) => (
              <line
                key={`v-${x}`}
                data-testid="align-guide"
                x1={x}
                y1={view.y}
                x2={x}
                y2={view.y + 800 / view.zoom}
                stroke="#ec4899"
                strokeWidth={1 / view.zoom}
                strokeDasharray={`${4 / view.zoom} ${4 / view.zoom}`}
              />
            ))}
            {guides.h.map((y) => (
              <line
                key={`h-${y}`}
                data-testid="align-guide"
                x1={view.x}
                y1={y}
                x2={view.x + 1200 / view.zoom}
                y2={y}
                stroke="#ec4899"
                strokeWidth={1 / view.zoom}
                strokeDasharray={`${4 / view.zoom} ${4 / view.zoom}`}
              />
            ))}
          </g>
        )}
        {active && selectedIds.size === 1 && active.type !== "connector" && provider.writable && !itemLocked(active) && (
          <>
            {[
              ["top", active.geometry.x + active.geometry.w / 2, active.geometry.y],
              ["right", active.geometry.x + active.geometry.w, active.geometry.y + active.geometry.h / 2],
              ["bottom", active.geometry.x + active.geometry.w / 2, active.geometry.y + active.geometry.h],
              ["left", active.geometry.x, active.geometry.y + active.geometry.h / 2],
            ].map(([side, cx, cy]) => {
              const centerX = active.geometry.x + active.geometry.w / 2,
                centerY = active.geometry.y + active.geometry.h / 2,
                point = rotatePoint(
                  centerX,
                  centerY,
                  Number(cx),
                  Number(cy),
                  active.rotation || 0,
                );
              return (
                <g key={String(side)}>
                  <circle
                    data-testid="board-connect-hit"
                    cx={point.x}
                    cy={point.y}
                    r={14 / view.zoom}
                    fill="transparent"
                    style={{ cursor: "crosshair" }}
                    onPointerDown={(e) => startConnect(e, active)}
                  />
                  <circle
                    data-testid="board-connect-handle"
                    aria-label={`拖动连接：${active.text || "图形"}`}
                    cx={point.x}
                    cy={point.y}
                    r={7 / view.zoom}
                    fill="#ffffff"
                    stroke="#4f46e5"
                    strokeWidth={1.6 / view.zoom}
                    pointerEvents="none"
                  />
                </g>
              );
            })}
            {(() => {
              const centerX = active.geometry.x + active.geometry.w / 2,
                centerY = active.geometry.y + active.geometry.h / 2,
                top = rotatePoint(
                  centerX,
                  centerY,
                  centerX,
                  active.geometry.y,
                  active.rotation || 0,
                ),
                handle = rotatePoint(
                  centerX,
                  centerY,
                  centerX,
                  active.geometry.y - 30 / view.zoom,
                  active.rotation || 0,
                );
              return (
                <g>
                  <line
                    x1={top.x}
                    y1={top.y}
                    x2={handle.x}
                    y2={handle.y}
                    stroke="#4f46e5"
                    strokeWidth={1.5 / view.zoom}
                    pointerEvents="none"
                  />
                  <circle
                    data-testid="board-rotate"
                    aria-label="旋转图元"
                    cx={handle.x}
                    cy={handle.y}
                    r={8 / view.zoom}
                    fill="#ffffff"
                    stroke="#4f46e5"
                    strokeWidth={1.8 / view.zoom}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const p = point(e);
                      rotateDrag.current = {
                        id: active.id,
                        center: { x: centerX, y: centerY },
                        startAngle: (Math.atan2(p.y - centerY, p.x - centerX) * 180) / Math.PI,
                        startRotation: active.rotation || 0,
                      };
                      svg.current?.setPointerCapture(e.pointerId);
                    }}
                  />
                </g>
              );
            })()}
            {!active.rotation && (
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
          </>
        )}
        {marquee && (
          <rect
            x={Math.min(marquee.x1, marquee.x2)}
            y={Math.min(marquee.y1, marquee.y2)}
            width={Math.abs(marquee.x2 - marquee.x1)}
            height={Math.abs(marquee.y2 - marquee.y1)}
            fill="rgba(79,70,229,0.08)"
            stroke="#4f46e5"
            strokeWidth={1.5 / view.zoom}
            strokeDasharray={`${5 / view.zoom} ${4 / view.zoom}`}
            pointerEvents="none"
            aria-label="框选区域"
          />
        )}
        {arrowDraft && (
          <g pointerEvents="none" aria-label="自由箭头预览">
            <line
              x1={arrowDraft.x1}
              y1={arrowDraft.y1}
              x2={arrowDraft.x2}
              y2={arrowDraft.y2}
              stroke="#6366f1"
              strokeWidth={2 / view.zoom}
              strokeDasharray={`${6 / view.zoom} ${4 / view.zoom}`}
              markerEnd={`url(#${marker})`}
            />
            <circle
              cx={arrowDraft.x2}
              cy={arrowDraft.y2}
              r={4 / view.zoom}
              fill="#6366f1"
            />
          </g>
        )}
        {linkTarget && (
          <rect
            x={linkTarget.geometry.x - 4 / view.zoom}
            y={linkTarget.geometry.y - 4 / view.zoom}
            width={linkTarget.geometry.w + 8 / view.zoom}
            height={linkTarget.geometry.h + 8 / view.zoom}
            fill="none"
            stroke="#4f46e5"
            strokeWidth={2 / view.zoom}
            strokeDasharray={`${6 / view.zoom} ${4 / view.zoom}`}
            pointerEvents="none"
            aria-label="连线目标"
          />
        )}
        {connecting && linkSource && (
          <g pointerEvents="none" aria-label="连线拖动预览">
            <line
              x1={linkSource.geometry.x + linkSource.geometry.w / 2}
              y1={linkSource.geometry.y + linkSource.geometry.h / 2}
              x2={connecting.x}
              y2={connecting.y}
              stroke="#6366f1"
              strokeWidth={2 / view.zoom}
              strokeDasharray={`${6 / view.zoom} ${4 / view.zoom}`}
            />
            <circle cx={connecting.x} cy={connecting.y} r={4 / view.zoom} fill="#6366f1" />
          </g>
        )}
        {displayItems
          .filter((shape) => shape.type !== "connector")
          .map((shape) => {
            const list = shapeThreads.get(shape.id) || [];
            const open = list.filter((t) => !t.resolved);
            const shown = review ? list : open;
            if (!shown.length) return null;
            return (
              <g
                key={`comment-${shape.id}`}
                data-testid="board-comment-pin"
                data-shape-id={shape.id}
                role="button"
                aria-label={`图元评论：${open.length || list.length} 条`}
                transform={`translate(${shape.geometry.x + shape.geometry.w},${shape.geometry.y})`}
                style={{ cursor: "pointer" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setTool("select");
                  setSelected(shape.id);
                  setSelectedIds(new Set([shape.id]));
                  setCommentsOpen(true);
                  setActiveThread((list.find((t) => !t.resolved) || list[0]).id);
                }}
              >
                <circle
                  r={10 / view.zoom}
                  fill={open.length ? "#f59e0b" : "#94a3b8"}
                  stroke="#ffffff"
                  strokeWidth={1.5 / view.zoom}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10 / view.zoom}
                  fontWeight={700}
                  fill="#ffffff"
                >
                  {open.length || list.length}
                </text>
              </g>
            );
          })}
        {members
          .filter((m) => m.cursor)
          .map((m) => (
            <g
              key={m.sessionId}
              transform={`translate(${m.cursor!.x},${m.cursor!.y})`}
              pointerEvents="none"
              aria-label={`${m.name} 的白板光标`}
            >
              <path d="M0 0 L0 18 L5 13 L10 22 L14 20 L9 12 L17 12 Z" fill={colorFor(m.userId)} />
              <text x="18" y="14" fill={colorFor(m.userId)} fontSize="14">
                {m.name}
              </text>
            </g>
          ))}
      </svg>
      {shareOpen && (
        <div
          role="dialog"
          aria-label="公开只读分享"
          className="absolute left-1/2 top-4 z-40 w-[24rem] max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">公开只读分享</h2>
              <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
                链接使用独立只读快照，不暴露组织内其他内容；可随时撤销。
              </p>
            </div>
            <button
              type="button"
              aria-label="关闭分享面板"
              className="rounded-md px-1 text-lg leading-none text-slate-400 hover:bg-slate-100"
              onClick={() => setShareOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <label htmlFor="share-expiry" className="text-slate-600">
              有效期
            </label>
            <select
              id="share-expiry"
              value={shareExpiry}
              onChange={(e) => setShareExpiry(e.target.value as "0" | "1" | "7" | "30")}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            >
              <option value="1">1 天</option>
              <option value="7">7 天</option>
              <option value="30">30 天</option>
              <option value="0">永久（可撤销）</option>
            </select>
            <Button
              size="sm"
              variant="secondary"
              disabled={shareBusy}
              onClick={createShareLink}
            >
              <Link2 size={13} /> {shareBusy ? "创建中…" : "创建链接"}
            </Button>
          </div>
          {shareCopied && (
            <p className="mt-2 rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-800">
              链接已复制，可发送给外部查看者。
            </p>
          )}
          {shareError && (
            <p role="alert" className="mt-2 text-xs text-red-700">
              {shareError}
            </p>
          )}
          <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
            {!shareLinks.length && (
              <p className="py-4 text-center text-xs text-slate-400">还没有公开链接。</p>
            )}
            {shareLinks.map((link) => {
              const revoked = Boolean(link.revoked_at);
              const expired =
                Boolean(link.expires_at) && new Date(link.expires_at).getTime() < Date.now();
              return (
                <div key={link.token} className="rounded-lg border border-slate-200 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[11px] text-slate-500">
                      {shareUrl(link.token)}
                    </span>
                    <span
                      className={`shrink-0 text-[10px] ${
                        revoked
                          ? "text-red-600"
                          : expired
                            ? "text-amber-600"
                            : "text-emerald-700"
                      }`}
                    >
                      {revoked
                        ? "已撤销"
                        : expired
                          ? "已过期"
                          : link.expires_at
                            ? `${new Date(link.expires_at).toLocaleDateString("zh-CN")} 到期`
                            : "永久"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-indigo-700 hover:underline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(shareUrl(link.token));
                          setShareCopied(link.token);
                          setTimeout(() => setShareCopied(""), 4000);
                        } catch {
                          setShareError("复制失败，请手动选择链接复制。");
                        }
                      }}
                    >
                      <Copy size={12} /> 复制
                    </button>
                    <a
                      href={shareUrl(link.token)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-700 hover:underline"
                    >
                      预览
                    </a>
                    {!revoked && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-red-700 hover:underline"
                        disabled={shareBusy}
                        onClick={() => revokeShareLink(link.token)}
                      >
                        <Ban size={12} /> 撤销
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {exportOpen && (
        <div
          role="dialog"
          aria-label="导出白板"
          className="absolute left-1/2 top-4 z-40 w-[22rem] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h2 className="text-sm font-semibold text-slate-900">导出与导入</h2>
            <button
              type="button"
              aria-label="关闭导出面板"
              className="rounded-md px-1 text-lg leading-none text-slate-400 hover:bg-slate-100"
              onClick={() => setExportOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="mt-3 flex gap-1 rounded-xl bg-slate-100 p-1">
            {(["png", "pdf"] as const).map((format) => (
              <button
                key={format}
                type="button"
                aria-pressed={exportFormat === format}
                onClick={() => setExportFormat(format)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  exportFormat === format
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2 text-xs">
            <button
              type="button"
              aria-pressed={!exportSelected}
              onClick={() => setExportSelected(false)}
              className={`flex-1 rounded-lg border px-3 py-2 ${
                !exportSelected
                  ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              全部可见内容
            </button>
            <button
              type="button"
              aria-pressed={exportSelected}
              disabled={!selectedIds.size}
              onClick={() => setExportSelected(true)}
              className={`flex-1 rounded-lg border px-3 py-2 disabled:opacity-40 ${
                exportSelected
                  ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              选中区域
            </button>
          </div>
          <label className="mt-3 inline-flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={exportScale === 2}
              onChange={(e) => setExportScale(e.target.checked ? 2 : 1)}
            />
            2x 高清
          </label>
          <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500">
            {exportArea
              ? `${Math.round(exportArea.w * exportScale)} × ${Math.round(
                  exportArea.h * exportScale,
                )} px`
              : "当前没有可导出的内容"}
          </p>
          {exportError && (
            <p role="alert" className="mt-2 text-xs text-red-700">
              {exportError}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={exportBusy || !exportArea}
              onClick={async () => {
                setExportBusy(true);
                setExportError("");
                try {
                  await exportBoard(displayItems as ExportShape[], selectedIds, {
                    format: exportFormat,
                    scale: exportScale,
                    selectedOnly: exportSelected && selectedIds.size > 0,
                    fileName: "collabspace-board",
                  });
                } catch (e) {
                  setExportError(e instanceof Error ? e.message : "导出失败。");
                } finally {
                  setExportBusy(false);
                }
              }}
            >
              <FileImage size={14} /> {exportBusy ? "导出中…" : `导出 ${exportFormat.toUpperCase()}`}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExportOpen(false)}
            >
              取消
            </Button>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-3">
            <p className="text-xs font-semibold text-slate-700">draw.io 互导</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              导入保留图形、文字与连接线；导出 `.drawio` 可在 draw.io / diagrams.net 打开。
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/50">
                <Upload size={13} /> 导入 .drawio
                <input
                  aria-label="导入 draw.io 文件"
                  type="file"
                  accept=".drawio,.xml,application/xml,text/xml"
                  className="sr-only"
                  disabled={!provider.writable || importBusy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setImportBusy(true);
                    setImportError("");
                    try {
                      if (file.size > 4_000_000) throw Error("文件超过 4MB，请先在 draw.io 精简。");
                      const imported = parseDrawio(await file.text());
                      if (shapes.size + imported.length > 500)
                        throw Error("导入后超过 500 个图元，请先清理画布。");
                      undo.current?.stopCapturing();
                      provider.doc.transact(() => {
                        for (const { id, ...data } of imported) {
                          shapes.set(id, new Y.Map(Object.entries(data)));
                          meta.set(`layer:${id}`, activeLayer);
                        }
                      }, origin);
                      undo.current?.stopCapturing();
                      setItems(read(provider.doc));
                      setView(fitItems(read(provider.doc)));
                      setExportOpen(false);
                    } catch (error) {
                      setImportError(error instanceof Error ? error.message : "导入失败。");
                    } finally {
                      setImportBusy(false);
                    }
                  }}
                />
              </label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  downloadText(
                    exportDrawio(displayItems),
                    "collabspace-board.drawio",
                    "application/xml",
                  )
                }
              >
                <FileDown size={13} /> 导出 .drawio
              </Button>
            </div>
            {importError && (
              <p role="alert" className="mt-2 text-xs text-red-700">
                {importError}
              </p>
            )}
          </div>
        </div>
      )}
      {(commentsOpen || review) && (
        <aside
          aria-label="图元评论"
          className="absolute inset-y-3 right-3 z-30 flex w-80 flex-col overflow-hidden rounded-xl border border-slate-200 bg-[var(--paper-raised)] shadow-xl backdrop-blur"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
            <div>
              <p className="text-xs font-semibold text-slate-800">
                {review ? "评审模式" : "图元评论"}
              </p>
              <p className="text-[11px] text-slate-500">
                {unresolvedThreads.length} 待处理 · {threads.length} 总计
              </p>
            </div>
            <button
              type="button"
              aria-label="关闭评论面板"
              className="rounded-md px-1 text-lg leading-none text-slate-400 hover:bg-slate-100"
              onClick={() => {
                setCommentsOpen(false);
                setReview(false);
              }}
            >
              ×
            </button>
          </div>
          {review && (
            <div className="border-b border-slate-200 p-3">
              <p className="text-[11px] leading-5 text-slate-500">
                未评论图元已弱化；可逐条定位待处理评论。
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                disabled={commentBusy}
                onClick={nextOpenThread}
              >
                <MapPin size={13} /> 下一处待处理
              </Button>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {canComment && selectedShape && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/70 p-2">
                <p className="text-[11px] font-medium text-amber-900">
                  评论选中图元：{selectedShape.text || selectedShape.type}
                </p>
                <textarea
                  aria-label="图元评论内容"
                  maxLength={5000}
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="写下需要对齐的细节或待确认的问题…"
                  className="mt-1 w-full rounded-lg border border-amber-200 bg-white p-2 text-sm"
                />
                {mentionables.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-slate-500">提及：</span>
                    {mentionables.slice(0, 8).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => appendMention(m.name)}
                        className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[11px] text-amber-900 hover:bg-amber-100"
                      >
                        @{m.name}
                      </button>
                    ))}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-1"
                  disabled={commentBusy || !commentDraft.trim()}
                  onClick={addThread}
                >
                  发表评论
                </Button>
              </div>
            )}
            {canComment && !selectedShape && (
              <p className="mb-3 rounded-lg bg-slate-50 p-2 text-[11px] leading-5 text-slate-500">
                选择一个图元后即可发表评论；也可以点击图元右上角的评论徽标。
              </p>
            )}
            {!canComment && (
              <p className="mb-3 rounded-lg bg-slate-50 p-2 text-[11px] leading-5 text-slate-500">
                当前角色只能查看评论，不能新增或解决。
              </p>
            )}
            {commentError && (
              <p role="alert" className="mb-3 text-xs leading-5 text-red-700">
                {commentError}
              </p>
            )}
            {!sortedThreads.length && (
              <p className="py-6 text-sm text-slate-400">
                尚无评论。选中一个图元，写下需要对齐的细节。
              </p>
            )}
            <div className="space-y-3">
              {sortedThreads.map((thread) => {
                const shape = items.find((s) => s.id === threadShapeId(thread));
                return (
                  <article
                    key={thread.id}
                    data-testid="board-comment-thread"
                    className={`rounded-lg border p-2 text-sm ${
                      activeThread === thread.id
                        ? "border-amber-300 bg-amber-50/40"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-medium text-slate-500">
                        {thread.resolved ? "已解决" : "待处理"}
                        {shape ? "" : " · 图元已删除"}
                      </p>
                      {shape && (
                        <button
                          type="button"
                          className="text-[11px] text-indigo-700 hover:underline"
                          onClick={() => jumpThread(thread)}
                        >
                          定位
                        </button>
                      )}
                    </div>
                    <blockquote className="mt-1 border-l-2 border-slate-200 pl-2 text-xs text-slate-500">
                      {shape?.text || thread.quote || "未命名图元"}
                    </blockquote>
                    <p className="mt-1 whitespace-pre-wrap text-slate-800">{thread.body}</p>
                    {thread.replies?.map((reply) => (
                      <p
                        key={reply.id}
                        className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600"
                      >
                        ↳ {reply.body}
                      </p>
                    ))}
                    {canComment && (
                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        <button
                          type="button"
                          className="text-indigo-700 hover:underline disabled:opacity-40"
                          disabled={commentBusy}
                          onClick={() => toggleResolve(thread)}
                        >
                          {thread.resolved ? "重新打开" : "标记解决"}
                        </button>
                        <button
                          type="button"
                          className="text-indigo-700 hover:underline disabled:opacity-40"
                          disabled={commentBusy}
                          onClick={() => {
                            setReplyTo(thread.id);
                            setReplyDraft("");
                          }}
                        >
                          回复
                        </button>
                      </div>
                    )}
                    {replyTo === thread.id && (
                      <div className="mt-2">
                        <textarea
                          aria-label="回复评论"
                          maxLength={5000}
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                        />
                        {mentionables.length > 0 && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="text-[10px] text-slate-500">提及：</span>
                            {mentionables.slice(0, 8).map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => appendReplyMention(m.name)}
                                className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-indigo-800 hover:bg-indigo-50"
                              >
                                @{m.name}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="mt-1 flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={commentBusy || !replyDraft.trim()}
                            onClick={() => sendReply(thread)}
                          >
                            发送回复
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReplyTo("");
                              setReplyDraft("");
                            }}
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </aside>
      )}
      {active && selectedIds.size === 1 && !commentsOpen && !review && (
        <aside
          aria-label="图形属性"
          className="absolute inset-y-3 right-3 z-20 w-72 overflow-y-auto rounded-xl border border-slate-200 bg-[var(--paper-raised)] p-3 shadow-xl backdrop-blur"
        >
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <p className="text-xs font-semibold text-slate-800">图形属性</p>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">
              {active.type}
            </span>
          </div>
          {activeLocked && (
            <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] leading-5 text-amber-900">
              <Lock size={13} className="mt-0.5 shrink-0" />
              <span className="flex-1">
                该图元已锁定，不能拖动或修改几何；仍可评论。
                <button
                  type="button"
                  className="ml-1 font-medium underline"
                  onClick={() => lockSelection(false)}
                >
                  解锁
                </button>
              </span>
            </div>
          )}
          {active.frame && (
            <p className="mb-2 rounded-lg bg-indigo-50 p-2 text-[11px] leading-5 text-indigo-800">
              Frame：移动 Frame 会带走框内图元；超出边界的部分会被裁切。
            </p>
          )}
          {!active.binding && (
            <>
              {active.type !== "mind" && (
                <label className="text-xs">
                  图元类型
                  <select
                    aria-label="图形类型"
                    value={active.type}
                    disabled={!provider.writable || activeLocked}
                    onChange={(e) =>
                      change(active.id, {
                        type: e.target.value as BoardShape["type"],
                      })
                    }
                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
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
              {active.type === "connector" ? (
                <p className="rounded-lg bg-slate-50 px-2 py-2 text-xs leading-5 text-slate-500">
                  {active.points
                    ? "自由箭头：起止点由拖动位置决定；可改文字、线型或删除。"
                    : "连接线位置跟随两端图元；可改文字、线型或删除。"}
                </p>
              ) : (
                (["x", "y", "w", "h"] as const).map((key, i) => (
                  <label key={key} className="text-xs">
                    {["X", "Y", "宽度", "高度"][i]}
                    <input
                      key={`${active.id}:${key}:${active.geometry[key]}`}
                      type="number"
                      aria-label={`图形${["X", "Y", "宽度", "高度"][i]}`}
                      defaultValue={Math.round(active.geometry[key])}
                      min={key === "x" || key === "y" ? -10000 : 20}
                      max={key === "x" || key === "y" ? 10000 : 2000}
                      disabled={!provider.writable || activeLocked}
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
                      className="mt-1 block w-20 rounded-lg border border-slate-200 bg-white p-2 text-sm"
                    />
                  </label>
                ))
              )}
              <Button
                size="sm"
                variant="secondary"
                disabled={!provider.writable || activeLocked}
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
              </Button>
              {active.type !== "connector" && (
                <div className="mt-2 grid grid-cols-2 gap-1" aria-label="层级顺序">
                  <Button size="sm" variant="ghost" disabled={!provider.writable || activeLocked} onClick={() => changeOrder("front")}>
                    <ChevronsUp size={13} /> 置顶
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!provider.writable || activeLocked} onClick={() => changeOrder("forward")}>
                    <ArrowUp size={13} /> 上移
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!provider.writable || activeLocked} onClick={() => changeOrder("backward")}>
                    <ArrowDown size={13} /> 下移
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!provider.writable || activeLocked} onClick={() => changeOrder("back")}>
                    <ChevronsDown size={13} /> 置底
                  </Button>
                </div>
              )}
              {active.type !== "connector" && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    disabled={!provider.writable}
                    onClick={() => lockSelection(!activeLocked)}
                  >
                    {activeLocked ? <Unlock size={13} /> : <Lock size={13} />}
                    {activeLocked ? "解锁图元" : "锁定图元"}
                  </Button>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs">
                    旋转角度
                    <input
                      key={`${active.id}:rotation:${active.rotation || 0}`}
                      type="number"
                      aria-label="旋转角度"
                      min={0}
                      max={359}
                      defaultValue={Math.round(active.rotation || 0)}
                      disabled={!provider.writable || activeLocked}
                      onBlur={(e) => {
                        const value = Number(e.currentTarget.value);
                        if (!Number.isFinite(value)) return;
                        const next = Math.max(0, Math.min(359, value));
                        writeMeta([[`rotation:${active.id}`, next]]);
                      }}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
                    />
                  </label>
                  <label className="text-xs">
                    所属图层
                    <select
                      aria-label="所属图层"
                      value={active.layer || "default"}
                      disabled={!provider.writable || activeLocked}
                      onChange={(e) => writeMeta([[`layer:${active.id}`, e.target.value]])}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
                    >
                      {layers.map((layer) => (
                        <option key={layer.id} value={layer.id}>
                          {layer.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  </div>
                </>
              )}
            </>
          )}
          {active.type === "mind" && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={!provider.writable} onClick={() => branch()}>
                添加子主题
              </Button>
              <Button size="sm" variant="secondary" disabled={!provider.writable} onClick={() => branch(true)}>
                添加同级主题
              </Button>
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
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
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
              disabled={!provider.writable || activeLocked}
              value={active.text}
              onChange={(e) => change(active.id, { text: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
            />
          </label>
          <label className="text-xs">
            颜色
            <select
              aria-label="图形颜色"
              disabled={!provider.writable || activeLocked}
              value={active.fill}
              onChange={(e) =>
                change(active.id, {
                  fill: e.target.value as BoardShape["fill"],
                })
              }
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
            >
              {colors.map((c, i) => (
                <option key={c} value={c}>
                  {["黄", "蓝", "绿", "粉", "白"][i]}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" variant="danger" className="mt-3 w-full" disabled={!provider.writable} onClick={remove}>
            删除图形
          </Button>
        </aside>
      )}
        </div>
      </div>
    </section>
  );
}
function BoardWorkspace({ provider }: { provider: DocumentProvider }) {
  const [mode, setMode] = useState(() =>
    provider.doc.getMap("shapes").size ? "canvas" : "mermaid",
  );
  const modeTouched = useRef(false);
  useEffect(() => {
    const shapes = provider.doc.getMap("shapes");
    const sync = () => {
      if (!shapes.size) return;
      const params = new URLSearchParams(window.location.search);
      const anchored = Boolean(params.get("shape") || params.get("thread"));
      // Newly synced or deep-linked boards open on the canvas, where anchors live.
      if (anchored || !modeTouched.current) setMode("canvas");
    };
    sync();
    shapes.observe(sync);
    return () => shapes.unobserve(sync);
  }, [provider]);
  const [convertMessage, setConvertMessage] = useState("");
  const convertToCanvas = () => {
    try {
      if (!provider.writable) {
        setConvertMessage("当前为只读，不能转换。");
        return;
      }
      const shapes = provider.doc.getMap<Y.Map<unknown>>("shapes");
      const source = provider.doc.getText("mermaid").toString().trim();
      if (!source || shapes.size) return;
      let parsed: ReturnType<typeof parseMermaid>;
      try {
        parsed = parseMermaid(source);
      } catch (e) {
        setConvertMessage(e instanceof Error ? e.message : "图表源码无法解析，未生成图元。");
        return;
      }
      if (parsed.length > 500) {
        setConvertMessage("转换后超过 500 个图元上限，请精简图表。");
        return;
      }
      provider.doc.transact(() => {
        for (const { id, ...data } of parsed)
          shapes.set(id, new Y.Map(Object.entries(data)));
      }, "collabspace:mermaid:convert");
      setConvertMessage("已从 Mermaid 生成可拖拽图元，可继续改字或连线。");
    } catch (e) {
      setConvertMessage(e instanceof Error ? e.message : "图表转换失败，未生成图元。");
    }
  };
  // The tab switch is the single entry point: entering the canvas with no
  // shapes derives them from Mermaid, so there is no separate convert button.
  useEffect(() => {
    if (mode === "canvas") convertToCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-2 py-1.5 shadow-sm">
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            aria-pressed={mode === "canvas"}
            onClick={() => {
              modeTouched.current = true;
              setMode("canvas");
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              mode === "canvas" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            自由画布
          </button>
          <button
            type="button"
            aria-pressed={mode === "mermaid"}
            onClick={() => {
              modeTouched.current = true;
              setMode("mermaid");
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              mode === "mermaid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            Mermaid 图表工作区
          </button>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <span
            className={`size-1.5 rounded-full ${
              provider.saved ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
          {provider.saved ? "已同步" : "保存中"}
        </span>
        <span className="text-[11px] text-slate-400">
          {provider.writable ? "可编辑" : "只读"} · 同一文档保留两种视图
        </span>
        {mode === "mermaid" && (
          <span className="ml-auto text-[11px] text-slate-400">切到自由画布会自动生成图元</span>
        )}
      </div>
      {convertMessage && (
        <p role="status" className="px-1 text-[11px] text-slate-500">
          {convertMessage}
        </p>
      )}
      {mode === "mermaid" ? (
        <MermaidWorkspace provider={provider} />
      ) : (
        <Canvas provider={provider} />
      )}
    </div>
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
    <BoardWorkspace provider={provider} />
  ) : (
    <p className="p-6">正在读取白板…</p>
  );
}
