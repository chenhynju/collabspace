import type { BoardShape } from "@collabspace/protocol";

export type DrawioItem = BoardShape & { id: string };
const PALETTE: BoardShape["fill"][] = ["#fef3c7", "#dbeafe", "#dcfce7", "#fce7f3", "#ffffff"];

function decode(value: string) {
  if (!value) return "";
  const doc = new DOMParser().parseFromString(`<div>${value}</div>`, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim().slice(0, 2000);
}

function nearestFill(value?: string): BoardShape["fill"] {
  const match = /^#([0-9a-f]{6})$/i.exec(value || "");
  if (!match) return "#dbeafe";
  const rgb = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r, g, b] = rgb(match[1]);
  let best = PALETTE[1],
    distance = Infinity;
  for (const color of PALETTE) {
    const [pr, pg, pb] = rgb(color.slice(1));
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < distance) {
      distance = d;
      best = color;
    }
  }
  return best;
}

function styleValue(style: string, key: string) {
  const match = new RegExp(`(?:^|;)${key}=([^;]*)`).exec(style);
  return match?.[1];
}

export function parseDrawio(xml: string) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw Error("文件不是有效的 draw.io XML。");
  const cells = Array.from(doc.querySelectorAll("mxCell"));
  if (!cells.length) throw Error("没有在文件中找到 draw.io 图元。");
  const ids = new Map<string, string>();
  const items: DrawioItem[] = [];
  let serial = 0;
  for (const cell of cells) {
    if (cell.getAttribute("vertex") !== "1") continue;
    const sourceId = cell.getAttribute("id") || "";
    if (!sourceId || sourceId === "0" || sourceId === "1") continue;
    const geometry = cell.querySelector("mxGeometry");
    if (!geometry) continue;
    const style = cell.getAttribute("style") || "";
    const x = Number(geometry.getAttribute("x") || 0),
      y = Number(geometry.getAttribute("y") || 0),
      w = Number(geometry.getAttribute("width") || 120),
      h = Number(geometry.getAttribute("height") || 60);
    if (![x, y, w, h].every(Number.isFinite)) continue;
    const type: BoardShape["type"] = /ellipse/.test(style)
      ? "ellipse"
      : /rhombus/.test(style)
        ? "diamond"
        : /text/.test(style) && !/shape=/.test(style)
          ? "text"
          : /shape=note/.test(style)
            ? "note"
            : /shape=document/.test(style)
              ? "document"
              : "rect";
    const id = crypto.randomUUID();
    ids.set(sourceId, id);
    items.push({
      id,
      type,
      text: decode(cell.getAttribute("value") || ""),
      fill: nearestFill(styleValue(style, "fillColor")),
      geometry: {
        x: Math.max(-10000, Math.min(10000, x)),
        y: Math.max(-10000, Math.min(10000, y)),
        w: Math.max(20, Math.min(2000, w)),
        h: Math.max(20, Math.min(2000, h)),
      },
      order: Date.now() + serial++,
    });
    if (items.length > 480) throw Error("draw.io 文件图元过多，单白板最多 500 个。");
  }
  for (const cell of cells) {
    if (cell.getAttribute("edge") !== "1") continue;
    const style = cell.getAttribute("style") || "";
    const source = ids.get(cell.getAttribute("source") || ""),
      target = ids.get(cell.getAttribute("target") || "");
    const geometry = cell.querySelector("mxGeometry");
    const sourcePoint = geometry?.querySelector("mxPoint[as='sourcePoint']"),
      targetPoint = geometry?.querySelector("mxPoint[as='targetPoint']");
    const text = decode(cell.getAttribute("value") || "");
    if (source && target) {
      items.push({
        id: crypto.randomUUID(),
        type: "connector",
        text,
        fill: "#ffffff",
        geometry: { x: 0, y: 0, w: 20, h: 20 },
        order: Date.now() + serial++,
        binding: {
          from: source,
          to: target,
          style: /curved=1/.test(style)
            ? "curve"
            : /orthogonalEdgeStyle|edgeStyle=orthogonal/.test(style)
              ? "elbow"
              : "straight",
        },
      });
    } else if (sourcePoint && targetPoint) {
      const x1 = Number(sourcePoint.getAttribute("x") || 0),
        y1 = Number(sourcePoint.getAttribute("y") || 0),
        x2 = Number(targetPoint.getAttribute("x") || 0),
        y2 = Number(targetPoint.getAttribute("y") || 0);
      if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
      items.push({
        id: crypto.randomUUID(),
        type: "connector",
        text,
        fill: "#ffffff",
        geometry: { x: 0, y: 0, w: 20, h: 20 },
        order: Date.now() + serial++,
        points: { x1, y1, x2, y2 },
      });
    }
  }
  if (!items.length) throw Error("没有可导入的 draw.io 图元。");
  return items;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exportDrawio(items: DrawioItem[]) {
  const nodes = items.filter((s) => s.type !== "connector");
  const connectors = items.filter((s) => s.type === "connector");
  const cells = nodes.map((shape) => {
    const style =
      shape.type === "ellipse"
        ? "ellipse;whiteSpace=wrap;html=1;"
        : shape.type === "diamond"
          ? "rhombus;whiteSpace=wrap;html=1;"
          : shape.type === "text"
            ? "text;html=1;align=left;verticalAlign=top;"
            : shape.type === "note"
              ? "shape=note;whiteSpace=wrap;html=1;"
              : `rounded=1;whiteSpace=wrap;html=1;fillColor=${shape.fill};`;
    return `        <mxCell id="${escapeXml(shape.id)}" value="${escapeXml(
      shape.text,
    )}" style="${escapeXml(style)}" vertex="1" parent="1">
          <mxGeometry x="${Math.round(shape.geometry.x)}" y="${Math.round(
            shape.geometry.y,
          )}" width="${Math.round(shape.geometry.w)}" height="${Math.round(
            shape.geometry.h,
          )}" as="geometry"/>
        </mxCell>`;
  });
  for (const shape of connectors) {
    if (shape.binding) {
      const style =
        shape.binding.style === "curve"
          ? "curved=1;endArrow=block;html=1;"
          : shape.binding.style === "elbow"
            ? "edgeStyle=orthogonalEdgeStyle;rounded=0;endArrow=block;html=1;"
            : "endArrow=block;html=1;";
      cells.push(`        <mxCell id="${escapeXml(
        shape.id,
      )}" value="${escapeXml(shape.text)}" style="${escapeXml(
        style,
      )}" edge="1" parent="1" source="${escapeXml(
        shape.binding.from,
      )}" target="${escapeXml(shape.binding.to)}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>`);
    } else if (shape.points) {
      cells.push(`        <mxCell id="${escapeXml(
        shape.id,
      )}" value="${escapeXml(shape.text)}" style="endArrow=block;html=1;" edge="1" parent="1">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="${Math.round(shape.points.x1)}" y="${Math.round(
              shape.points.y1,
            )}" as="sourcePoint"/>
            <mxPoint x="${Math.round(shape.points.x2)}" y="${Math.round(
              shape.points.y2,
            )}" as="targetPoint"/>
          </mxGeometry>
        </mxCell>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="collabspace" modified="${new Date().toISOString()}" agent="CollabSpace" version="1.0">
  <diagram name="CollabSpace" id="collabspace">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1200" pageHeight="800" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${cells.join("\n")}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;
}

export function downloadText(value: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
