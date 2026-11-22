import type { BoardShape } from "@collabspace/protocol";

export type ExportShape = BoardShape & {
  id: string;
  rotation?: number;
  frame?: boolean;
  locked?: boolean;
};

export type ExportOptions = {
  format: "png" | "pdf";
  scale: 1 | 2;
  selectedOnly: boolean;
  fileName?: string;
};

const FONT =
  '"Noto Sans SC","Source Han Sans SC","PingFang SC","Microsoft YaHei",ui-sans-serif,system-ui,sans-serif';
const PAD = 32;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function rotatedBounds(item: ExportShape) {
  const { x, y, w, h } = item.geometry;
  const rotation = ((item.rotation || 0) * Math.PI) / 180;
  if (!rotation) return { x, y, w, h };
  const cx = x + w / 2,
    cy = y + h / 2;
  const corners = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ].map(([px, py]) => [
    cx + (px - cx) * Math.cos(rotation) - (py - cy) * Math.sin(rotation),
    cy + (px - cx) * Math.sin(rotation) + (py - cy) * Math.cos(rotation),
  ]);
  const xs = corners.map((p) => p[0]),
    ys = corners.map((p) => p[1]);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}

export function exportBounds(items: ExportShape[], selectedOnly: boolean, selectedIds: Set<string>) {
  const nodes = items.filter((s) => s.type !== "connector" || s.points);
  const chosen = selectedOnly
    ? nodes.filter((s) => selectedIds.has(s.id))
    : nodes;
  if (!chosen.length) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const shape of chosen) {
    if (shape.points) {
      minX = Math.min(minX, shape.points.x1, shape.points.x2);
      minY = Math.min(minY, shape.points.y1, shape.points.y2);
      maxX = Math.max(maxX, shape.points.x1, shape.points.x2);
      maxY = Math.max(maxY, shape.points.y1, shape.points.y2);
    } else {
      const b = rotatedBounds(shape);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    }
  }
  return { x: minX - PAD, y: minY - PAD, w: maxX - minX + PAD * 2, h: maxY - minY + PAD * 2 };
}

function contains(frame: ExportShape, shape: ExportShape) {
  if (frame.id === shape.id || shape.frame || shape.type === "connector") return false;
  const cx = shape.geometry.x + shape.geometry.w / 2,
    cy = shape.geometry.y + shape.geometry.h / 2;
  return (
    cx > frame.geometry.x &&
    cx < frame.geometry.x + frame.geometry.w &&
    cy > frame.geometry.y &&
    cy < frame.geometry.y + frame.geometry.h
  );
}

function shapePath(ctx: CanvasRenderingContext2D, item: ExportShape) {
  const { x, y, w, h } = item.geometry;
  if (item.frame) {
    roundRect(ctx, x, y, w, h, 10);
    return;
  }
  switch (item.type) {
    case "ellipse":
    case "umlUseCase":
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      return;
    case "diamond":
    case "erdRelationship":
    case "bpmnGateway":
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      return;
    case "triangle":
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      return;
    case "parallelogram":
      ctx.beginPath();
      ctx.moveTo(x + w * 0.18, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w * 0.82, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      return;
    case "hexagon":
    case "k8sPod":
      ctx.beginPath();
      ctx.moveTo(x + w * 0.17, y);
      ctx.lineTo(x + w * 0.83, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w * 0.83, y + h);
      ctx.lineTo(x + w * 0.17, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      return;
    case "document":
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h * 0.84);
      ctx.bezierCurveTo(x + w * 0.7, y + h * 0.62, x + w * 0.3, y + h * 1.06, x, y + h * 0.88);
      ctx.closePath();
      return;
    case "database":
    case "cloudStorage":
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.18, w / 2, h * 0.16, 0, 0, Math.PI * 2);
      ctx.moveTo(x, y + h * 0.18);
      ctx.lineTo(x, y + h * 0.82);
      ctx.ellipse(x + w / 2, y + h * 0.82, w / 2, h * 0.16, 0, 0, Math.PI);
      ctx.closePath();
      return;
    case "bpmnStart":
    case "bpmnEnd":
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      return;
    case "text":
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      return;
    default:
      roundRect(
        ctx,
        x,
        y,
        w,
        h,
        item.type === "note" ? 2 : item.type === "mind" ? 24 : 10,
      );
  }
}

function drawText(
  ctx: CanvasRenderingContext2D,
  item: ExportShape,
  zoom: number,
) {
  const { x, y, w, h } = item.geometry;
  const text = item.text || "";
  if (!text) return;
  const fontSize = 16;
  ctx.save();
  ctx.font = `${fontSize}px ${FONT}`;
  ctx.fillStyle = "#0f172a";
  ctx.textBaseline = "top";
  const left = item.type === "note" || item.type === "text";
  const padding = 10;
  const maxWidth = Math.max(10, w - padding * 2);
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const char of paragraph) {
      const test = line + char;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else line = test;
    }
    lines.push(line);
  }
  const lineHeight = fontSize * 1.4;
  const total = lines.length * lineHeight;
  const startY = left
    ? y + padding
    : y + (item.frame ? 34 : Math.max(padding, (h - total) / 2));
  const startX = left ? x + padding : x + w / 2;
  ctx.textAlign = left ? "left" : "center";
  ctx.beginPath();
  if (item.frame) ctx.rect(x + 4, y + 4, w - 8, h - 8);
  else ctx.rect(x + 2, y + 2, w - 4, h - 4);
  ctx.clip();
  lines.forEach((line, index) => {
    if (startY + index * lineHeight + lineHeight > y + h) return;
    ctx.fillText(line, startX, startY + index * lineHeight);
  });
  ctx.restore();
  void zoom;
}

function drawConnector(
  ctx: CanvasRenderingContext2D,
  item: ExportShape,
  items: ExportShape[],
) {
  const from = items.find((s) => s.id === item.binding?.from);
  const to = items.find((s) => s.id === item.binding?.to);
  const points = item.points;
  let x1: number, y1: number, x2: number, y2: number;
  if (points) {
    ({ x1, y1, x2, y2 } = points);
  } else if (from && to) {
    x1 = from.geometry.x + from.geometry.w / 2;
    y1 = from.geometry.y + from.geometry.h / 2;
    x2 = to.geometry.x + to.geometry.w / 2;
    y2 = to.geometry.y + to.geometry.h / 2;
  } else return;
  ctx.save();
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2;
  ctx.fillStyle = "#334155";
  if (item.binding?.style === "curve" && from && to) {
    const mx = (x1 + x2) / 2,
      my = (y1 + y2) / 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(mx, my - 40, x2, y2);
    ctx.stroke();
  } else if (item.binding?.style === "elbow" && from && to) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo((x1 + x2) / 2, y1);
    ctx.lineTo((x1 + x2) / 2, y2);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 10 * Math.cos(angle - 0.4), y2 - 10 * Math.sin(angle - 0.4));
  ctx.lineTo(x2 - 10 * Math.cos(angle + 0.4), y2 - 10 * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
  if (item.text) {
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "#334155";
    ctx.fillText(item.text, (x1 + x2) / 2, (y1 + y2) / 2 - 6);
  }
  ctx.restore();
}

function renderBoard(
  items: ExportShape[],
  selectedOnly: boolean,
  selectedIds: Set<string>,
  scale: number,
) {
  const nodes = selectedOnly
    ? items.filter(
        (s) =>
          selectedIds.has(s.id) &&
          (s.type !== "connector" || (s.points && selectedIds.has(s.id))),
      )
    : items;
  const included = new Set(nodes.map((s) => s.id));
  const connectors = nodes.filter(
    (s) =>
      s.type === "connector" &&
      (s.points ||
        (s.binding && included.has(s.binding.from) && included.has(s.binding.to))),
  );
  const shapes = nodes.filter((s) => s.type !== "connector");
  const frames = shapes.filter((s) => s.frame);
  const bounds = exportBounds(nodes, selectedOnly, selectedIds);
  if (!bounds) throw Error("当前没有可导出的内容。");
  const width = Math.max(1, Math.ceil(bounds.w * scale));
  const height = Math.max(1, Math.ceil(bounds.h * scale));
  if (width * height > 80_000_000) throw Error("导出区域过大，请缩小范围或使用 1x。");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("浏览器不支持图片导出。");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.scale(scale, scale);
  ctx.translate(-bounds.x, -bounds.y);

  for (const frame of frames) {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    shapePath(ctx, frame);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(
      frame.geometry.x,
      frame.geometry.y,
      frame.geometry.w,
      Math.min(30, frame.geometry.h),
    );
    ctx.strokeStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.moveTo(frame.geometry.x, frame.geometry.y + Math.min(30, frame.geometry.h));
    ctx.lineTo(
      frame.geometry.x + frame.geometry.w,
      frame.geometry.y + Math.min(30, frame.geometry.h),
    );
    ctx.stroke();
    ctx.restore();
  }

  for (const shape of shapes.filter((s) => s.frame)) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(shape.geometry.x, shape.geometry.y, shape.geometry.w, shape.geometry.h);
    ctx.clip();
    for (const child of shapes.filter((s) => contains(shape, s))) {
      if (selectedOnly && !selectedIds.has(child.id)) continue;
      drawShape(ctx, child);
    }
    ctx.restore();
  }

  for (const shape of shapes) {
    if (shape.frame) continue;
    if (frames.some((frame) => contains(frame, shape))) continue;
    drawShape(ctx, shape);
  }
  for (const connector of connectors) drawConnector(ctx, connector, nodes);
  return { canvas, bounds, width, height };
}

function drawShape(ctx: CanvasRenderingContext2D, item: ExportShape) {
  const { x, y, w, h } = item.geometry;
  const rotation = item.rotation || 0;
  ctx.save();
  if (rotation) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }
  ctx.fillStyle = item.fill || "#dbeafe";
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 1.5;
  if (item.type !== "text") {
    shapePath(ctx, item);
    ctx.fill();
    ctx.stroke();
  }
  if (item.type === "arrow") {
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + w, y);
    ctx.stroke();
    const angle = Math.atan2(-h, w);
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w - 12 * Math.cos(angle - 0.4), y - 12 * Math.sin(angle - 0.4));
    ctx.lineTo(x + w - 12 * Math.cos(angle + 0.4), y - 12 * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
  }
  if (item.frame) {
    ctx.fillStyle = "#0f172a";
    ctx.font = `600 13px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(item.text || "Frame", x + 10, y + Math.min(15, h / 2));
  } else drawText(ctx, item, 1);
  ctx.restore();
}

function jpegBytes(canvas: HTMLCanvasElement) {
  const data = canvas.toDataURL("image/jpeg", 0.92).split(",")[1];
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function pdfBlob(canvas: HTMLCanvasElement) {
  const bytes = jpegBytes(canvas);
  const pageWidth = (canvas.width * 72) / 96;
  const pageHeight = (canvas.height * 72) / 96;
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let length = 0;
  const push = (value: string | Uint8Array) => {
    const chunk = typeof value === "string" ? encoder.encode(value) : value;
    chunks.push(chunk);
    length += chunk.byteLength;
  };
  const object = (id: number, body: string | Uint8Array) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    push(body);
    push("\nendobj\n");
  };
  push("%PDF-1.4\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(
      2,
    )}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`,
  );
  const content = `q\n${pageWidth.toFixed(2)} 0 0 ${pageHeight.toFixed(2)} 0 0 cm\n/Im0 Do\nQ`;
  object(4, `<< /Length ${encoder.encode(content).byteLength} >>\nstream\n${content}\nendstream`);
  offsets[5] = length;
  push(
    `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.byteLength} >>\nstream\n`,
  );
  push(bytes);
  push("\nendstream\nendobj\n");
  const xref = length;
  push(`xref\n0 6\n0000000000 65535 f \n`);
  for (let i = 1; i <= 5; i++)
    push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

export async function exportBoard(
  items: ExportShape[],
  selectedIds: Set<string>,
  options: ExportOptions,
) {
  const { canvas } = renderBoard(items, options.selectedOnly, selectedIds, options.scale);
  const base = (options.fileName || "collabspace-board").replace(/[\\/:*?"<>|]/g, "-");
  if (options.format === "png") {
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error("图片编码失败。"))),
        "image/png",
      ),
    );
    download(blob, `${base}.png`);
    return { width: canvas.width, height: canvas.height };
  }
  download(pdfBlob(canvas), `${base}.pdf`);
  return { width: canvas.width, height: canvas.height };
}
