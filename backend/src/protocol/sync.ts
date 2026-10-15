/**
 * Server side of the Convex client sync protocol (convex@1.45 WebSocket,
 * `/api/<version>/sync`). Each socket keeps its query set, auth identity and
 * the state version it last sent; commits re-run only the subscribed queries
 * whose recorded reads intersect the written documents.
 */
import { convexToJson, jsonToConvex, type JSONValue, type Value } from "convex/values";
import { AuthError, type AuthVerifier } from "../engine/auth";
import type { CommitInfo, Engine, Identity, ReadEntry, Write } from "../engine/engine";
import { documentKey } from "../engine/store";

const CHUNK_BYTES = 512 * 1024;

export function encodeTs(ts: bigint): string {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, ts, true);
  return btoa(String.fromCharCode(...bytes));
}

type StateVersion = { querySet: number; identity: number; ts: bigint };
type Subscription = { udfPath: string; args: Record<string, Value>; reads: ReadEntry[]; sent: string | null };
type ClientMessage =
  | { type: "Connect"; sessionId: string }
  | { type: "ModifyQuerySet"; baseVersion: number; newVersion: number; modifications: Array<{ type: "Add"; queryId: number; udfPath: string; args: JSONValue[] } | { type: "Remove"; queryId: number }> }
  | { type: "Authenticate"; tokenType: "User" | "Admin" | "None"; value?: string; baseVersion: number }
  | { type: "Mutation" | "Action"; requestId: number; udfPath: string; args: JSONValue[] }
  | { type: "Event" };

export function readsIntersect(reads: ReadEntry[], writes: Map<string, Write>): boolean {
  for (const [id, write] of writes) {
    for (const read of reads) {
      if (read.kind === "get" && read.id === id) return true;
      if (read.kind === "table" && read.table === write.table) return true;
      if (read.kind === "range" && read.index.table === write.table) {
        for (const doc of [write.before, write.after]) {
          if (!doc) continue;
          const key = documentKey(read.index, doc);
          if (key >= read.range.lower && key < read.range.upper) return true;
        }
      }
    }
  }
  return false;
}

export class SyncSession {
  private sessionId = "";
  private querySetVersion = 0;
  private identityVersion = 0;
  private identity: Identity | null = null;
  private identityExpiresAt = 0;
  private subscriptions = new Map<number, Subscription>();
  private dirty = new Set<number>();
  private removed = new Set<number>();
  private sent: StateVersion = { querySet: 0, identity: 0, ts: 0n };
  private chain: Promise<void> = Promise.resolve();
  closed = false;

  constructor(
    private readonly engine: Engine,
    private readonly verifier: AuthVerifier,
    private readonly transport: { send(message: string): void; close(code: number, reason: string): void },
  ) {}

  /** Serialize all work on this socket so versions advance in order. */
  private enqueue(work: () => Promise<void>) {
    this.chain = this.chain.then(work).catch((error) => this.fatal(error));
  }

  receive(raw: string) {
    let message: ClientMessage;
    try {
      message = JSON.parse(raw);
    } catch {
      this.fatal(new Error("Malformed client message"));
      return;
    }
    if (message.type === "Mutation" || message.type === "Action") {
      // Requests run concurrently with the socket's query bookkeeping, like Convex.
      void this.request(message);
      return;
    }
    this.enqueue(() => this.handle(message));
  }

  /** Called after every commit; refresh only affected subscriptions. */
  invalidate(commit: CommitInfo) {
    if (this.closed) return;
    const affected = [...this.subscriptions].filter(([, sub]) => readsIntersect(sub.reads, commit.writes));
    if (affected.length === 0) return;
    for (const [queryId] of affected) this.dirty.add(queryId);
    this.enqueue(() => this.flush());
  }

  ping() {
    if (!this.closed) this.transport.send(JSON.stringify({ type: "Ping" }));
  }

  private send(message: Record<string, unknown>) {
    if (this.closed) return;
    const text = JSON.stringify(message);
    if (message.type !== "Transition" || text.length <= CHUNK_BYTES) {
      this.transport.send(text);
      return;
    }
    const totalParts = Math.ceil(text.length / CHUNK_BYTES);
    const transitionId = crypto.randomUUID();
    for (let part = 0; part < totalParts; part++) {
      this.transport.send(
        JSON.stringify({
          type: "TransitionChunk",
          chunk: text.slice(part * CHUNK_BYTES, (part + 1) * CHUNK_BYTES),
          partNumber: part,
          totalParts,
          transitionId,
        }),
      );
    }
  }

  private fatal(error: unknown) {
    if (this.closed) return;
    const message = error instanceof Error ? error.message : String(error);
    console.error("[sync] fatal", message);
    this.send({ type: "FatalError", error: message });
    this.closed = true;
    this.transport.close(1011, "InternalServerError");
  }

  private async handle(message: ClientMessage) {
    switch (message.type) {
      case "Connect":
        this.sessionId = message.sessionId;
        return;
      case "ModifyQuerySet": {
        if (message.baseVersion !== this.querySetVersion) {
          throw new Error(`Base version ${message.baseVersion} passed up doesn't match the current version ${this.querySetVersion}`);
        }
        for (const modification of message.modifications) {
          if (modification.type === "Add") {
            this.subscriptions.set(modification.queryId, {
              udfPath: modification.udfPath,
              args: jsonToConvex(modification.args[0] ?? {}) as Record<string, Value>,
              reads: [],
              sent: null,
            });
            this.dirty.add(modification.queryId);
            this.removed.delete(modification.queryId);
          } else {
            this.subscriptions.delete(modification.queryId);
            this.dirty.delete(modification.queryId);
            this.removed.add(modification.queryId);
          }
        }
        this.querySetVersion = message.newVersion;
        return this.flush();
      }
      case "Authenticate": {
        let identityChanged = true;
        if (message.baseVersion !== this.identityVersion) {
          throw new Error(`Auth base version ${message.baseVersion} doesn't match the current version ${this.identityVersion}`);
        }
        if (message.tokenType === "User") {
          try {
            const verified = await this.verifier.verify(message.value ?? "");
            identityChanged = JSON.stringify(verified.identity) !== JSON.stringify(this.identity);
            this.identity = verified.identity;
            this.identityExpiresAt = verified.expiresAt;
          } catch (error) {
            const reason = error instanceof AuthError ? error.message : "Could not verify token";
            this.send({ type: "AuthError", error: reason, baseVersion: message.baseVersion, authUpdateAttempted: true });
            return;
          }
        } else if (message.tokenType === "None") {
          identityChanged = this.identity !== null;
          this.identity = null;
        } else {
          this.send({ type: "AuthError", error: "Admin authentication is not supported", baseVersion: message.baseVersion, authUpdateAttempted: true });
          return;
        }
        this.identityVersion = message.baseVersion + 1;
        // Token refreshes for the same user keep results; only re-run on a real change.
        if (identityChanged) for (const queryId of this.subscriptions.keys()) this.dirty.add(queryId);
        return this.flush();
      }
      case "Event":
        return;
      default:
        throw new Error(`Unknown client message ${(message as { type: string }).type}`);
    }
  }

  /**
   * The identity to run functions with. Like Convex, an expired token stops
   * authenticating and the client is told to refresh it.
   */
  private currentIdentity(): Identity | null {
    if (this.identity && this.verifier.expired(this.identityExpiresAt)) {
      this.identity = null;
      this.send({ type: "AuthError", error: "Token expired", baseVersion: this.identityVersion - 1, authUpdateAttempted: false });
    }
    return this.identity;
  }

  private async request(message: Extract<ClientMessage, { type: "Mutation" | "Action" }>) {
    const args = jsonToConvex(message.args[0] ?? {}) as Record<string, Value>;
    // Use the identity that applies at the point this request was received.
    await this.chain;
    const identity = this.currentIdentity();
    if (message.type === "Mutation") {
      try {
        const { value, ts } = await this.engine.runMutation(message.udfPath, args, identity, {
          dedupe: { session: this.sessionId, request: message.requestId },
        });
        this.send({ type: "MutationResponse", requestId: message.requestId, success: true, result: convexToJson(value), ts: encodeTs(ts), logLines: [] });
        // The client resolves a mutation only on a Transition at or past `ts` that
        // arrives after this response (even a replayed one), so always send one.
        this.enqueue(() => this.flush(true));
      } catch (error) {
        const failure = this.engine.clientError(error);
        this.send({ type: "MutationResponse", requestId: message.requestId, success: false, result: failure.errorMessage, errorData: failure.errorData, logLines: [] });
      }
      return;
    }
    try {
      const value = await this.engine.runAction(message.udfPath, args, identity);
      this.send({ type: "ActionResponse", requestId: message.requestId, success: true, result: convexToJson(value), logLines: [] });
    } catch (error) {
      const failure = this.engine.clientError(error);
      this.send({ type: "ActionResponse", requestId: message.requestId, success: false, result: failure.errorMessage, errorData: failure.errorData, logLines: [] });
    }
  }

  /**
   * Send one Transition covering query-set, identity and data changes, all at
   * one timestamp. `force` sends it even when nothing changed.
   */
  private async flush(force = false): Promise<void> {
    const { modifications, ts } = await this.engine.snapshot(async () => {
      const modifications: Record<string, unknown>[] = [];
      for (const queryId of this.removed) modifications.push({ type: "QueryRemoved", queryId });
      this.removed.clear();
      const pending = [...this.dirty];
      this.dirty.clear();
      for (const queryId of pending) {
        const subscription = this.subscriptions.get(queryId);
        if (!subscription) continue;
        const reads: ReadEntry[] = [];
        try {
          const value = await this.engine.executeQuery(subscription.udfPath, subscription.args, this.currentIdentity(), { readSet: reads });
          const json = convexToJson(value);
          const text = JSON.stringify(json);
          subscription.reads = reads;
          if (text === subscription.sent) continue;
          subscription.sent = text;
          modifications.push({ type: "QueryUpdated", queryId, value: json, logLines: [], journal: null });
        } catch (error) {
          subscription.reads = reads;
          subscription.sent = null;
          const failure = this.engine.clientError(error);
          modifications.push({ type: "QueryFailed", queryId, errorMessage: failure.errorMessage, errorData: failure.errorData, logLines: [], journal: null });
        }
      }
      return { modifications, ts: this.engine.ts };
    });
    const end: StateVersion = { querySet: this.querySetVersion, identity: this.identityVersion, ts: ts > this.sent.ts ? ts : this.sent.ts };
    const changed = modifications.length > 0 || end.querySet !== this.sent.querySet || end.identity !== this.sent.identity || end.ts !== this.sent.ts;
    if (!changed && !force) return;
    this.send({
      type: "Transition",
      startVersion: { querySet: this.sent.querySet, identity: this.sent.identity, ts: encodeTs(this.sent.ts) },
      endVersion: { querySet: end.querySet, identity: end.identity, ts: encodeTs(end.ts) },
      modifications,
      serverTs: Date.now(),
    });
    this.sent = end;
  }
}
