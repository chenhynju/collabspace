import { z } from "zod";
import { validateBoard, type BoardShape } from "@collabspace/protocol";

const ref = z.string().max(5).regex(/^[sn][1-9][0-9]*$/);
const coordinate = z.number().finite().min(-10000).max(10000);
const xy = { x: coordinate, y: coordinate };
const shapeType = z.enum(["rect", "ellipse", "diamond", "note", "text", "mind"]);
const planSchema = z.object({
  ops: z.array(z.discriminatedUnion("op", [
    z.object({
      op: z.literal("add"),
      ref,
      type: shapeType.default("rect"),
      text: z.string().trim().min(1).max(300),
      x: coordinate.optional(),
      y: coordinate.optional(),
      w: z.number().finite().min(20).max(2000).optional(),
      h: z.number().finite().min(20).max(2000).optional(),
    }).strict(),
    z.object({ op: z.literal("note"), ref, text: z.string().trim().min(1).max(300), ...xy }).strict(),
    z.object({ op: z.literal("update"), ref, text: z.string().trim().min(1).max(300) }).strict(),
    z.object({ op: z.literal("move"), ref, ...xy }).strict(),
    z.object({ op: z.literal("connect"), from: ref, to: ref }).strict(),
  ])).min(1).max(20),
}).strict();

const fills: Record<string, BoardShape["fill"]> = {
  note: "#fef3c7",
  mind: "#dbeafe",
  rect: "#dbeafe",
  ellipse: "#dcfce7",
  diamond: "#fce7f3",
  text: "#ffffff",
};

export function compileBoardPlan(
  text: string,
  initial: Record<string, BoardShape>,
  scope: string[],
) {
  const raw = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const { ops } = planSchema.parse(JSON.parse(raw));
  const aliases = new Map(scope.map((id, index) => ["s" + (index + 1), id]));
  const final = { ...initial };
  const changes = new Map<string, BoardShape>();
  const labels: string[] = [];
  const target = (key: string) => {
    const id = aliases.get(key);
    if (!id || !final[id] || final[id].type === "connector") throw Error("Invalid target");
    return id;
  };
  const nodes = Object.values(final).filter((shape) => shape.type !== "connector");
  const baseY = nodes.length ? Math.max(...nodes.map((shape) => shape.geometry.y + shape.geometry.h)) + 120 : 80;
  let autoIndex = 0;
  for (const op of ops) {
    const next = (id: string, shape: BoardShape) => {
      final[id] = shape;
      changes.set(id, shape);
    };
    if (op.op === "add" || op.op === "note") {
      if (!op.ref.startsWith("n") || aliases.has(op.ref)) throw Error("Invalid note");
      const id = crypto.randomUUID();
      aliases.set(op.ref, id);
      const type = op.op === "note" ? "note" : op.type;
      const auto = op.op === "add" && (op.x === undefined || op.y === undefined);
      const x = auto ? 80 + (autoIndex % 3) * 260 : (op.x as number);
      const y = auto ? baseY + Math.floor(autoIndex / 3) * 170 : (op.y as number);
      if (auto) autoIndex++;
      next(id, {
        type,
        geometry: {
          x,
          y,
          w: (op.op === "add" && op.w) || (type === "note" ? 180 : type === "mind" ? 200 : 180),
          h: (op.op === "add" && op.h) || (type === "mind" ? 60 : 120),
        },
        text: op.text,
        fill: fills[type] || "#dbeafe",
        order: Date.now() + changes.size,
      });
      labels.push(`新增${type === "note" ? "便签" : "图元"}「${op.text}」`);
    } else if (op.op === "update") {
      const id = target(op.ref);
      const shape = final[id];
      if (shape.text === op.text) continue;
      next(id, { ...shape, text: op.text });
      labels.push(`修改「${shape.text || op.ref}」文字`);
    } else if (op.op === "move") {
      const id = target(op.ref), shape = final[id];
      if (shape.geometry.x === op.x && shape.geometry.y === op.y) continue;
      next(id, { ...shape, geometry: { ...shape.geometry, x: op.x, y: op.y } });
      labels.push(`移动「${shape.text || op.ref}」至 (${op.x}, ${op.y})`);
    } else {
      const from = target(op.from), to = target(op.to);
      next(crypto.randomUUID(), {
        type: "connector",
        geometry: { x: 0, y: 0, w: 20, h: 20 },
        binding: { from, to, style: "straight" },
        fill: "#ffffff",
        text: "",
        order: Date.now() + changes.size,
      });
      labels.push(`连接「${final[from].text || op.from}」到「${final[to].text || op.to}」`);
    }
  }
  if (!changes.size) throw Error("No change");
  validateBoard(final);
  return { changes, labels };
}
