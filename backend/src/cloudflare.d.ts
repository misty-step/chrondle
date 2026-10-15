/**
 * The subset of the Cloudflare Workers runtime API used by the backend.
 * Behaviour is exercised against real workerd by the integration suite
 * (backend/scripts/integration.mjs); these declarations only type-check it.
 */
declare module "cloudflare:workers" {
  export abstract class DurableObject<Env = unknown> {
    protected ctx: DurableObjectState;
    protected env: Env;
    constructor(ctx: DurableObjectState, env: Env);
  }
}

interface SqlStorageCursor<T> {
  toArray(): T[];
}

interface DurableObjectState {
  storage: {
    sql: { exec<T = Record<string, string | number | null>>(query: string, ...bindings: unknown[]): SqlStorageCursor<T> };
    transactionSync<T>(fn: () => T): T;
    setAlarm(scheduledTime: number): Promise<void>;
  };
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
}

interface DurableObjectStub<T> {
  fetch(request: Request): Promise<Response>;
  backup: T extends { backup(): infer R } ? () => R : never;
  wake: T extends { wake(): infer R } ? () => R : never;
}

interface DurableObjectNamespace<T = unknown> {
  idFromName(name: string): unknown;
  get(id: unknown, options?: { locationHint?: string }): DurableObjectStub<T>;
}

interface R2Object {
  key: string;
}

interface R2ObjectBody extends R2Object {
  text(): Promise<string>;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> },
  ): Promise<R2Object>;
  list(options?: { prefix?: string }): Promise<{ objects: R2Object[] }>;
  delete(keys: string | string[]): Promise<void>;
}

declare class WebSocketPair {
  0: WebSocket & { accept(): void };
  1: WebSocket & { accept(): void };
}

interface ResponseInit {
  webSocket?: WebSocket | null;
}

interface SubtleCrypto {
  timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean;
}

interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

interface ExportedHandler<Env> {
  fetch?(request: Request, env: Env): Promise<Response>;
  scheduled?(controller: ScheduledController, env: Env): Promise<void>;
}
