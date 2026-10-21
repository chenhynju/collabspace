export class Store {
  constructor(url?: string);
  [key: string]: any;
  close(): Promise<void>;
  assertRuntime(): Promise<void>;
}
export class StoreError extends Error {
  status: number;
  code: string;
}
