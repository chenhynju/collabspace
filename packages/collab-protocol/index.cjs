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
    })
    .strict(),
]);
module.exports = { VERSION, MAX_FRAME_BYTES, auth, frame };
