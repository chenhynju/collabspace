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
  type:
    | "rect"
    | "ellipse"
    | "note"
    | "text"
    | "arrow"
    | "diamond"
    | "mind"
    | "connector"
    | "document"
    | "parallelogram"
    | "hexagon"
    | "triangle"
    | "database"
    | "server"
    | "cloud"
    | "actor";
  geometry: { x: number; y: number; w: number; h: number };
  text: string;
  fill: "#fef3c7" | "#dbeafe" | "#dcfce7" | "#fce7f3" | "#ffffff";
  order: number;
  parent?: string;
  binding?: { from: string; to: string; style: "straight" | "elbow" | "curve" };
};
export const boardShape: z.ZodTypeAny;
export const shapeCatalog: readonly {
  type: BoardShape["type"];
  label: string;
  group: string;
}[];
export function validateBoard(shapes: Record<string, unknown>): void;
export function connectorPath(
  a: BoardShape["geometry"] & { type?: BoardShape["type"] },
  b: BoardShape["geometry"] & { type?: BoardShape["type"] },
  style?: "straight" | "elbow" | "curve",
): string;
export function layoutMindmap(
  items: (BoardShape & { id: string })[],
): Record<string, BoardShape["geometry"]>;
export function parseMermaid(input: string): (BoardShape & { id: string })[];
export function exportMermaid(
  items: (BoardShape & { id: string })[],
  mind?: boolean,
): string;
