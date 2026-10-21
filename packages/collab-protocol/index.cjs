const { z } = require("zod");
const VERSION = 1,
  MAX_FRAME_BYTES = 360000;
const auth = z
  .object({
    v: z.literal(VERSION),
    type: z.literal("auth"),
    org: z.string().min(1).max(100),
    user: z.string().min(1).max(100),
    docId: z.string().uuid(),
    ticket: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const frame = z.discriminatedUnion("type", [
  z
    .object({
      v: z.literal(VERSION),
      type: z.literal("sync"),
      vector: z.string().max(90000),
    })
    .strict(),
  z
    .object({
      v: z.literal(VERSION),
      type: z.literal("update"),
      updateId: z.string().uuid(),
      update: z.string().max(350000),
    })
    .strict(),
  z
    .object({
      v: z.literal(VERSION),
      type: z.literal("presence"),
      selection: z
        .object({ anchor: z.string().max(2000), head: z.string().max(2000) })
        .nullable(),
      cursor: z
        .object({
          x: z.number().finite().min(-10000).max(10000),
          y: z.number().finite().min(-10000).max(10000),
        })
        .strict()
        .nullable()
        .optional(),
    })
    .strict(),
]);
const geometry = z
  .object({
    x: z.number().finite().min(-10000).max(10000),
    y: z.number().finite().min(-10000).max(10000),
    w: z.number().finite().min(20).max(2000),
    h: z.number().finite().min(20).max(2000),
  })
  .strict();
const boardShape = z
  .object({
    type: z.enum([
      "rect",
      "ellipse",
      "note",
      "text",
      "arrow",
      "diamond",
      "mind",
      "connector",
      "document",
      "parallelogram",
      "hexagon",
      "triangle",
      "database",
      "server",
      "cloud",
      "actor",
    ]),
    geometry,
    text: z.string().max(2000),
    fill: z.enum(["#fef3c7", "#dbeafe", "#dcfce7", "#fce7f3", "#ffffff"]),
    order: z.number().finite().min(0).max(1e15),
    parent: z.string().uuid().optional(),
    binding: z
      .object({
        from: z.string().uuid(),
        to: z.string().uuid(),
        style: z.enum(["straight", "elbow", "curve"]),
      })
      .strict()
      .optional(),
  })
  .strict();
function validateBoard(shapes) {
  const entries = Object.entries(shapes);
  if (entries.length > 500) throw Error("BOARD_SHAPE_LIMIT");
  for (const [id, shape] of entries) {
    z.string().uuid().parse(id);
    boardShape.parse(shape);
    if (shape.parent && shape.type !== "mind")
      throw Error("INVALID_MIND_PARENT");
    if (
      shape.type === "connector" &&
      (!shape.binding || shape.binding.from === shape.binding.to)
    )
      throw Error("INVALID_CONNECTOR");
    if (shape.binding && shape.type !== "connector")
      throw Error("INVALID_CONNECTOR");
    // Missing endpoints are allowed after concurrent deletion; rendering hides
    // dangling links rather than resurrecting the deleted node.
    if (
      shape.binding &&
      [shape.binding.from, shape.binding.to].some(
        (key) => shapes[key]?.type === "connector",
      )
    )
      throw Error("INVALID_CONNECTOR");
    const seen = new Set([id]);
    let parent = shape.parent;
    while (parent && shapes[parent]) {
      if (seen.has(parent) || shapes[parent].type !== "mind")
        throw Error("INVALID_MIND_TREE");
      seen.add(parent);
      parent = shapes[parent].parent;
    }
  }
}
function connectorPath(a, b, style = "elbow") {
  const ax = a.x + a.w / 2,
    ay = a.y + a.h / 2,
    bx = b.x + b.w / 2,
    by = b.y + b.h / 2;
  const dx = bx - ax,
    dy = by - ay;
  if (!dx && !dy) return "";
  const boundary = (s) =>
    s.type === "diamond"
      ? 1 / (Math.abs(dx) / (s.w / 2) + Math.abs(dy) / (s.h / 2))
      : s.type === "ellipse"
        ? 1 / Math.sqrt((dx / (s.w / 2)) ** 2 + (dy / (s.h / 2)) ** 2)
        : Math.min(
            dx ? s.w / 2 / Math.abs(dx) : Infinity,
            dy ? s.h / 2 / Math.abs(dy) : Infinity,
          );
  const ta = boundary(a),
    tb = boundary(b);
  if (ta + tb >= 1) return "";
  const x = ax + dx * ta,
    y = ay + dy * ta,
    xx = bx - dx * tb,
    yy = by - dy * tb,
    mid = (x + xx) / 2;
  return style === "straight"
    ? `M ${x} ${y} L ${xx} ${yy}`
    : style === "curve"
      ? `M ${x} ${y} C ${mid} ${y} ${mid} ${yy} ${xx} ${yy}`
      : `M ${x} ${y} H ${mid} V ${yy} H ${xx}`;
}
function layoutMindmap(items) {
  const nodes = items
    .filter((s) => s.type === "mind")
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const byId = new Map(nodes.map((s) => [s.id, s])),
    children = new Map(),
    result = {},
    visited = new Set();
  for (const n of nodes) {
    const p = byId.has(n.parent) ? n.parent : null;
    if (!children.has(p)) children.set(p, []);
    children.get(p).push(n);
  }
  let row = 0;
  const walk = (n, depth) => {
    if (visited.has(n.id)) return 0;
    visited.add(n.id);
    const kids = children.get(n.id) || [];
    const positions = kids.map((c) => walk(c, depth + 1));
    const y = positions.length
      ? positions.reduce((a, b) => a + b, 0) / positions.length
      : row++ * 100;
    result[n.id] = { x: depth * 260, y, w: 180, h: 60 };
    return y;
  };
  for (const root of children.get(null) || []) {
    walk(root, 0);
    row++;
  }
  const values = Object.values(result),
    maxX = Math.max(1, ...values.map((g) => g.x)),
    maxY = Math.max(1, ...values.map((g) => g.y));
  const obstacles = items.filter(
    (s) => s.type !== "mind" && s.type !== "connector",
  );
  let left = Math.max(
      80,
      ...obstacles.map((s) => s.geometry.x + s.geometry.w + 100),
    ),
    top = 80;
  if (left > 6000) {
    left = 80;
    top = Math.max(
      80,
      ...obstacles.map((s) => s.geometry.y + s.geometry.h + 100),
    );
  }
  if (top > 9000) throw Error("自动布局空间不足，请先移动其他图形");
  for (const g of values) {
    g.x = left + g.x * Math.min(1, (9800 - left) / maxX);
    g.y = top + g.y * Math.min(1, (9800 - top) / maxY);
  }
  return result;
}
module.exports = {
  VERSION,
  MAX_FRAME_BYTES,
  auth,
  frame,
  boardShape,
  validateBoard,
  connectorPath,
  layoutMindmap,
  ...require("./diagrams.cjs"),
  shapeCatalog: require("./shape-catalog.cjs"),
};
