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
  cursor?: { x: number; y: number } | null;
};
export type BoardShape = {
  type: "rect" | "ellipse" | "note" | "text" | "arrow";
  geometry: { x: number; y: number; w: number; h: number };
  text: string;
  fill: "#fef3c7" | "#dbeafe" | "#dcfce7" | "#fce7f3" | "#ffffff";
  order: number;
};
export const boardShape: z.ZodTypeAny;
export function validateBoard(shapes: Record<string, unknown>): void;
