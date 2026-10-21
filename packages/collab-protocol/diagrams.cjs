// Deliberately bounded Mermaid interchange subset. No HTML, directives, links,
// code execution, or embedded renderer. Parse fully before any CRDT mutation.
const clean = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#(10|34|40|41|91|93|123|124|125|60|62);/g, (_, n) =>
      String.fromCharCode(Number(n)),
    )
    .replace(/&amp;/g, "&");
const quote = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "&#10;")
    .replace(/[\[\]{}()|<>]/g, (c) => `&#${c.charCodeAt(0)};`);
function parseMermaid(input, makeId = () => globalThis.crypto.randomUUID()) {
  if (typeof input !== "string" || input.length > 32000)
    throw Error("源码最多32000字符");
  if (input.includes("%%{") || /[<\t\u0000]/.test(input))
    throw Error("不支持HTML、指令或制表符；请使用普通文字和空格缩进");
  const lines = input
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("%%"));
  const header = lines.shift()?.trim();
  const nodes = [],
    edges = [];
  const make = (type, text, parent) => ({
    id: makeId(),
    type,
    text: clean(text),
    geometry: { x: 80, y: 80, w: 180, h: type === "mind" ? 60 : 90 },
    fill: "#dbeafe",
    order: nodes.length + edges.length,
    ...(parent ? { parent } : {}),
  });
  if (header === "mindmap") {
    const stack = [];
    let rootIndent;
    for (const [i, line] of lines.entries()) {
      const indent = line.length - line.trimStart().length;
      let text = line.trim();
      const shape = text.match(/^[A-Za-z_][\w]*\(\((.*)\)\)$/);
      if (shape) text = shape[1];
      else if (/[\[\]{}()]/.test(text))
        throw Error(`第${i + 2}行：导图支持普通文字或id((根主题))`);
      if (!text || text.length > 2000)
        throw Error(`第${i + 2}行：主题文字不合法`);
      if (rootIndent === undefined) rootIndent = indent;
      if (i > 0 && indent <= rootIndent)
        throw Error(`第${i + 2}行：仅支持一个根主题，其余主题必须缩进`);
      while (stack.length && stack.at(-1).indent >= indent) stack.pop();
      const n = make("mind", text, stack.at(-1)?.id);
      nodes.push(n);
      stack.push({ indent, id: n.id });
    }
    if (!nodes.length) throw Error("请添加根主题");
    const { layoutMindmap } = require("./index.cjs");
    const positions = layoutMindmap(nodes);
    for (const n of nodes) n.geometry = positions[n.id];
  } else {
    const h = header?.match(/^(?:flowchart|graph) (LR|TD|TB)$/);
    if (!h) throw Error("支持 flowchart LR / TD / TB 或 mindmap");
    const byName = new Map();
    const token = (raw, line) => {
      const m = raw
        .trim()
        .match(
          /^([A-Za-z_][A-Za-z0-9_]{0,63})(?:\[(.*)\]|\{(.*)\}|\(\((.*)\)\))?$/,
        );
      if (!m || /^(subgraph|end|style|classDef|click|linkStyle)$/.test(m[1]))
        throw Error(
          `第${line}行：仅支持id、id[文字]、id{判断}、id((开始))和 -->|标签|`,
        );
      let n = byName.get(m[1]);
      const label = m[2] ?? m[3] ?? m[4];
      const text = label?.replace(/^"(.*)"$/, "$1");
      if (!n) {
        n = make(
          m[3] !== undefined
            ? "diamond"
            : m[4] !== undefined
              ? "ellipse"
              : "rect",
          text ?? m[1],
        );
        nodes.push(n);
        byName.set(m[1], n);
      } else if (text !== undefined) {
        n.text = clean(text);
        n.type =
          m[3] !== undefined
            ? "diamond"
            : m[4] !== undefined
              ? "ellipse"
              : "rect";
      }
      if (n.text.length > 2000) throw Error(`第${line}行：文字最多2000字符`);
      return n;
    };
    lines.forEach((line, i) => {
      const parts = line.trim().split(/\s*-->\s*/);
      let from = token(parts[0], i + 2);
      for (const part of parts.slice(1)) {
        const m = part.match(/^(?:\|([^|]*)\|\s*)?(.*)$/);
        const to = token(m[2], i + 2);
        if (from.id === to.id) throw Error(`第${i + 2}行：暂不支持自环`);
        const e = make("connector", m[1] || "");
        e.binding = { from: from.id, to: to.id, style: "elbow" };
        edges.push(e);
        from = to;
      }
    });
    if (!nodes.length) throw Error("请添加节点");
    // Stable simple layered placement; cyclic graphs use a deterministic grid.
    const ranks = new Map(nodes.map((n) => [n.id, 0])),
      pending = new Set(nodes.map((n) => n.id));
    let step = 0;
    while (pending.size && step < nodes.length) {
      const batch = [...pending].filter(
        (id) =>
          !edges.some(
            (e) => e.binding.to === id && pending.has(e.binding.from),
          ),
      );
      if (!batch.length) break;
      for (const id of batch) {
        pending.delete(id);
        for (const e of edges.filter((e) => e.binding.from === id))
          ranks.set(
            e.binding.to,
            Math.max(ranks.get(e.binding.to), ranks.get(id) + 1),
          );
      }
      step++;
    }
    const rows = new Map();
    nodes.forEach((n, i) => {
      const rank = pending.size ? Math.floor(i / 3) : ranks.get(n.id);
      const row = rows.get(rank) || 0;
      rows.set(rank, row + 1);
      const x = Math.min(9000, rank * 260) + 80,
        y = Math.min(9000, row * 160) + 80;
      n.geometry = {
        x: h[1] === "LR" ? x : y,
        y: h[1] === "LR" ? y : x,
        w: 180,
        h: 90,
      };
    });
  }
  const items = [...nodes, ...edges];
  if (items.length > 500) throw Error("最多500个节点和连接线");
  const { validateBoard } = require("./index.cjs");
  validateBoard(Object.fromEntries(items.map(({ id, ...s }) => [id, s])));
  return items;
}
function exportMermaid(items, mind = false) {
  const nodes = items.filter(
    (n) => n.type !== "connector" && n.type !== "arrow",
  );
  const ids = new Map(nodes.map((n, i) => [n.id, "N" + i]));
  if (mind) {
    if (
      nodes.some((n) => n.type !== "mind") ||
      items.some((n) => n.type === "connector" || n.type === "arrow")
    )
      throw Error("导出mindmap需仅包含思维主题；混合画布请选择流程图导出");
    const roots = nodes.filter((n) => !ids.has(n.parent));
    if (roots.length !== 1) throw Error("mindmap导出需要一个根主题");
    const out = ["mindmap"],
      seen = new Set();
    const walk = (n, d) => {
      if (seen.has(n.id)) throw Error("导图存在循环");
      seen.add(n.id);
      out.push(
        "  ".repeat(d + 1) +
          (d === 0
            ? ids.get(n.id) + "((" + quote(n.text) + "))"
            : quote(n.text)),
      );
      for (const child of nodes.filter((c) => c.parent === n.id))
        walk(child, d + 1);
    };
    walk(roots[0], 0);
    return out.join("\n");
  }
  const out = ["flowchart LR"];
  for (const n of nodes) {
    const label = '"' + quote(n.text) + '"';
    out.push(
      "  " +
        ids.get(n.id) +
        (n.type === "diamond"
          ? "{" + label + "}"
          : n.type === "ellipse"
            ? "((" + label + "))"
            : "[" + label + "]"),
    );
  }
  for (const e of items.filter((n) => n.type === "connector" && n.binding))
    if (ids.has(e.binding.from) && ids.has(e.binding.to))
      out.push(
        `  ${ids.get(e.binding.from)} -->${e.text ? "|" + quote(e.text) + "|" : ""} ${ids.get(e.binding.to)}`,
      );
  for (const n of nodes)
    if (n.type === "mind" && ids.has(n.parent))
      out.push(`  ${ids.get(n.parent)} --> ${ids.get(n.id)}`);
  if (items.some((n) => n.type === "arrow"))
    throw Error("独立箭头没有绑定节点，无法无损导出；请先用连接节点工具替换");
  return out.join("\n");
}
module.exports = { parseMermaid, exportMermaid };
