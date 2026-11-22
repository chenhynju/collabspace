import type { BoardShape } from "@collabspace/protocol";

export type LayoutItem = BoardShape & { id: string; frame?: boolean };

export function layoutFlow(
  items: LayoutItem[],
  style: "elbow" | "curve" = "elbow",
): {
  geometries: Record<string, BoardShape["geometry"]>;
  connectorStyles: Record<string, "elbow" | "curve">;
} {
  const nodes = items.filter((s) => s.type !== "connector" && !s.frame);
  const nodeIds = new Set(nodes.map((s) => s.id));
  const edges = items
    .filter(
      (s) =>
        s.type === "connector" &&
        s.binding &&
        nodeIds.has(s.binding.from) &&
        nodeIds.has(s.binding.to),
    )
    .map((s) => ({ from: s.binding!.from, to: s.binding!.to, id: s.id }));
  if (!nodes.length) throw Error("当前画布没有可布局的图元。");

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) || []), edge.to]);
    incoming.set(edge.to, [...(incoming.get(edge.to) || []), edge.from]);
  }
  const levels = new Map<string, number>();
  const queue = nodes.filter((s) => !(incoming.get(s.id)?.length)).map((s) => s.id);
  queue.forEach((id) => levels.set(id, 0));
  if (!queue.length) {
    // Pure cycle: seed with the first node so the layout still progresses.
    levels.set(nodes[0].id, 0);
    queue.push(nodes[0].id);
  }
  for (let cursor = 0; cursor < queue.length && cursor < nodes.length * 4; cursor++) {
    const id = queue[cursor],
      level = levels.get(id) || 0;
    for (const next of outgoing.get(id) || []) {
      const proposed = level + 1;
      if ((levels.get(next) ?? -1) < proposed) {
        levels.set(next, proposed);
        queue.push(next);
      }
    }
  }
  for (const node of nodes) if (!levels.has(node.id)) levels.set(node.id, 0);

  const average = edges.reduce(
    (acc, edge) => {
      const from = nodes.find((s) => s.id === edge.from)!.geometry;
      const to = nodes.find((s) => s.id === edge.to)!.geometry;
      return {
        dx: acc.dx + Math.abs(to.x + to.w / 2 - (from.x + from.w / 2)),
        dy: acc.dy + Math.abs(to.y + to.h / 2 - (from.y + from.h / 2)),
        n: acc.n + 1,
      };
    },
    { dx: 0, dy: 0, n: 0 },
  );
  const horizontal = average.n ? average.dx >= average.dy : true;
  const grouped = new Map<number, LayoutItem[]>();
  for (const node of nodes) {
    const level = levels.get(node.id) || 0;
    grouped.set(level, [...(grouped.get(level) || []), node]);
  }
  const levelKeys = [...grouped.keys()].sort((a, b) => a - b);
  const gap = 90;
  const levelGap = 140;
  const sizes = new Map<number, number>();
  for (const level of levelKeys) {
    const list = grouped.get(level)!;
    sizes.set(
      level,
      list.reduce((sum, node) => sum + (horizontal ? node.geometry.w : node.geometry.h), 0) +
        gap * Math.max(0, list.length - 1),
    );
  }
  const totalCross = Math.max(...levelKeys.map((level) => sizes.get(level) || 0), 0);
  const geometries: Record<string, BoardShape["geometry"]> = {};
  let mainCursor = 0;
  for (const level of levelKeys) {
    const list = grouped.get(level)!;
    const crossSize = sizes.get(level) || 0;
    let crossCursor = -totalCross / 2 + (totalCross - crossSize) / 2;
    const levelSize = Math.max(
      ...list.map((node) => (horizontal ? node.geometry.w : node.geometry.h)),
      0,
    );
    for (const node of list) {
      const { w, h } = node.geometry;
      const geometry = horizontal
        ? {
            x: mainCursor + (levelSize - w) / 2,
            y: crossCursor,
            w,
            h,
          }
        : {
            x: crossCursor,
            y: mainCursor + (levelSize - h) / 2,
            w,
            h,
          };
      geometries[node.id] = geometry;
      crossCursor += (horizontal ? w : h) + gap;
    }
    mainCursor += levelSize + levelGap;
  }
  return {
    geometries,
    connectorStyles: Object.fromEntries(edges.map((edge) => [edge.id, style])),
  };
}
