import { z } from "zod";
import { validateBoard, type BoardShape } from "@collabspace/protocol";

const ref = z.string().max(5).regex(/^[sn][1-9][0-9]*$/);
const coordinate = z.number().finite().min(-10000).max(10000);
const xy = { x: coordinate, y: coordinate };
const planSchema = z.object({
  ops: z.array(z.discriminatedUnion("op", [
    z.object({ op: z.literal("note"), ref, text: z.string().trim().min(1).max(300), ...xy }).strict(),
    z.object({ op: z.literal("move"), ref, ...xy }).strict(),
    z.object({ op: z.literal("connect"), from: ref, to: ref }).strict(),
  ])).min(1).max(8),
}).strict();

export function compileBoardPlan(
  text: string,
  initial: Record<string, BoardShape>,
  scope: string[],
) {
  const { ops } = planSchema.parse(JSON.parse(text));
  const aliases = new Map(scope.map((id, index) => ["s" + (index + 1), id]));
  const final = { ...initial };
  const changes = new Map<string, BoardShape>();
  const labels: string[] = [];
  const target = (key: string) => {
    const id = aliases.get(key);
    if (!id || !final[id] || final[id].type === "connector") throw Error("Invalid target");
    return id;
  };
  for (const op of ops) {
    const next = (id: string, shape: BoardShape) => {
      final[id] = shape;
      changes.set(id, shape);
    };
    if (op.op === "note") {
      if (!op.ref.startsWith("n") || aliases.has(op.ref)) throw Error("Invalid note");
      const id = crypto.randomUUID();
      aliases.set(op.ref, id);
      next(id, { type: "note", geometry: { x: op.x, y: op.y, w: 180, h: 120 }, text: op.text,
        fill: "#fef3c7", order: Date.now() });
      labels.push(`新增便签「${op.text}」 · (${op.x}, ${op.y})`);
    } else if (op.op === "move") {
      const id = target(op.ref), shape = final[id];
      if (shape.geometry.x === op.x && shape.geometry.y === op.y) throw Error("No change");
      next(id, { ...shape, geometry: { ...shape.geometry, x: op.x, y: op.y } });
      labels.push(`移动「${shape.text || op.ref}」至 (${op.x}, ${op.y})`);
    } else {
      const from = target(op.from), to = target(op.to);
      next(crypto.randomUUID(), { type: "connector", geometry: { x: 0, y: 0, w: 20, h: 20 },
        binding: { from, to, style: "straight" }, fill: "#ffffff", text: "", order: Date.now() });
      labels.push(`连接「${final[from].text || op.from}」到「${final[to].text || op.to}」`);
    }
  }
  validateBoard(final);
  return { changes, labels };
}

