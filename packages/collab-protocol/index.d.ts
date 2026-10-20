import { z } from "zod";
export const VERSION: 1;
export const MAX_FRAME_BYTES: number;
export const auth: z.ZodTypeAny;
export const frame: z.ZodTypeAny;
export type Role = "OWNER" | "EDITOR" | "COMMENTER" | "VIEWER";
export type Selection = { anchor: string; head: string } | null;
export type Member = {
  sessionId: string;
  userId: string;
  name: string;
  selection: Selection;
};
