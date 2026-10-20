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
    type: z.enum(["rect", "ellipse", "note", "text", "arrow"]),
    geometry,
    text: z.string().max(2000),
    fill: z.enum(["#fef3c7", "#dbeafe", "#dcfce7", "#fce7f3", "#ffffff"]),
    order: z.number().finite().min(0).max(1e15),
  })
  .strict();
function validateBoard(shapes) {
  const entries = Object.entries(shapes);
  if (entries.length > 500) throw Error("BOARD_SHAPE_LIMIT");
  for (const [id, shape] of entries) {
    z.string().uuid().parse(id);
    boardShape.parse(shape);
  }
}
module.exports = {
  VERSION,
  MAX_FRAME_BYTES,
  auth,
  frame,
  boardShape,
  validateBoard,
};
