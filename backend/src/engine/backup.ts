/**
 * Snapshots of everything a backend holds, for backups, migrations and
 * rollbacks: the application tables plus the runtime state that has to travel
 * with them, so a restore is one coherent point in time.
 *
 * Snapshot format (NDJSON), one record per line:
 *   {"table":"users","tableNumber":10002}             table numbers, kept for empty tables
 *   {"table":"users","document":{"_id":"…",…}}        application documents
 *   {"scheduledFunction":{"_id":"…","name":…,…}}      `_scheduled_functions` records
 *   {"cron":"<name>","lastOccurrence":1792022400000} each cron's last dispatched occurrence
 *   {"mutation":{"session":…,"request":…,…}}          replay records of client mutations
 *
 * Reconciliation hashes canonical records, not storage files: per table,
 * sha256 over the sorted lines `canonicalJson(document) + "\n"`; the runtime
 * state is summarized the same way.
 */
import { createHash } from "node:crypto";
import { convexToJson, jsonToConvex, type JSONValue, type Value } from "convex/values";
import { z } from "zod";
import type { Engine } from "./engine";
import { decodeDocumentId } from "./ids";
import { SCHEDULED_FUNCTIONS, type Doc, type MutationLogEntry } from "./store";
import type { IdChecker } from "./validate";

export type Snapshot = {
  /** Application table numbers, including tables that are empty. */
  tableNumbers: Map<string, number>;
  /** Application documents by table. */
  documents: Map<string, Doc[]>;
  scheduledFunctions: Doc[];
  /** Cron name → last dispatched occurrence (ms). */
  cronCursors: Map<string, number>;
  mutationLog: MutationLogEntry[];
};

export type TableSummary = { tableNumber: number | null; count: number; sha256: string };
/** Application tables: what Convex and this backend both hold. */
export type Manifest = Record<string, TableSummary>;
/** Runtime state that only this backend's snapshots carry. */
export type RuntimeSummary = {
  scheduledFunctions: { count: number; sha256: string; states: Record<string, number> };
  cronCursors: Record<string, number>;
  mutationLog: { count: number; sha256: string };
};
export type Summary = { manifest: Manifest; runtime: RuntimeSummary };

const count = z.number().int().nonnegative();
const checksum = z.string().regex(/^[a-f0-9]{64}$/);
const digestSchema = z.object({ count, sha256: checksum });
/** R2 metadata is untrusted too: runtime checksums are mandatory for our backups. */
export const summarySchema = z.object({
  manifest: z.record(z.string(), digestSchema.extend({ tableNumber: z.number().int().nullable() })),
  runtime: z.object({
    scheduledFunctions: digestSchema.extend({ states: z.record(z.string(), count) }),
    cronCursors: z.record(z.string(), z.number().finite()),
    mutationLog: digestSchema,
  }),
});

export class SnapshotMismatchError extends Error {
  constructor(readonly mismatches: string[]) {
    super(`Snapshot checksum mismatch: ${mismatches.join(", ")}`);
    this.name = "SnapshotMismatchError";
  }
}

function verify(expected: Summary, actual: Summary): void {
  const differences = mismatches(expected, actual);
  if (differences.length) throw new SnapshotMismatchError(differences);
}

const TABLE_NAME = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const FIRST_USER_TABLE_NUMBER = 10001;
const SCHEDULED_FUNCTIONS_NUMBER = 9;
const JOB_STATES = ["pending", "inProgress", "success", "failed", "canceled"];

export function canonicalJson(value: JSONValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key] as JSONValue)}`).join(",")}}`;
}

function digest(records: Iterable<JSONValue>): { count: number; sha256: string } {
  const lines = [...records].map(canonicalJson).sort();
  const hash = createHash("sha256");
  for (const line of lines) hash.update(`${line}\n`);
  return { count: lines.length, sha256: hash.digest("hex") };
}

/** Hash documents the same way on both sides of a migration. */
export function summarizeDocuments(
  tableNumber: number | null,
  documents: Iterable<JSONValue>,
): TableSummary {
  return { tableNumber, ...digest(documents) };
}

/** The whole stored state, read in one synchronous turn (so one commit point). */
export function readState(engine: Engine): Snapshot {
  const store = engine.store;
  const tableNumbers = new Map(
    [...store.registeredTables()].filter(([name]) => !name.startsWith("_")),
  );
  const tables = new Set(
    [...tableNumbers.keys(), ...store.tables()].filter((t) => !t.startsWith("_")),
  );
  return {
    tableNumbers,
    documents: new Map([...tables].sort().map((table) => [table, [...store.allDocuments(table)]])),
    scheduledFunctions: [...store.allDocuments(SCHEDULED_FUNCTIONS)],
    cronCursors: store.cronCursors(),
    mutationLog: store.mutationLog(),
  };
}

export function summarize(snapshot: Snapshot): Summary {
  const manifest: Manifest = {};
  const tables = new Set([...snapshot.tableNumbers.keys(), ...snapshot.documents.keys()]);
  for (const table of [...tables].sort()) {
    manifest[table] = summarizeDocuments(
      snapshot.tableNumbers.get(table) ?? null,
      (snapshot.documents.get(table) ?? []).map((doc) => convexToJson(doc as Value)),
    );
  }
  const states: Record<string, number> = {};
  for (const job of snapshot.scheduledFunctions) {
    const kind = (job.state as { kind: string }).kind;
    states[kind] = (states[kind] ?? 0) + 1;
  }
  return {
    manifest,
    runtime: {
      scheduledFunctions: {
        ...digest(snapshot.scheduledFunctions.map((job) => convexToJson(job as Value))),
        states,
      },
      cronCursors: Object.fromEntries(
        [...snapshot.cronCursors].sort(([a], [b]) => (a < b ? -1 : 1)),
      ),
      mutationLog: digest(snapshot.mutationLog as unknown as JSONValue[]),
    },
  };
}

/**
 * Parts that differ: table names, then runtime parts. Runtime state is only
 * compared when both sides carry it (a Convex snapshot does not). Empty when equal.
 */
export function mismatches(
  expected: { manifest: Manifest; runtime?: RuntimeSummary },
  actual: { manifest: Manifest; runtime?: RuntimeSummary },
): string[] {
  const tables = [...new Set([...Object.keys(expected.manifest), ...Object.keys(actual.manifest)])];
  const differs = (a: unknown, b: unknown) =>
    canonicalJson((a ?? null) as JSONValue) !== canonicalJson((b ?? null) as JSONValue);
  const runtime =
    expected.runtime && actual.runtime
      ? (["scheduledFunctions", "cronCursors", "mutationLog"] as const).filter((part) =>
          differs(expected.runtime![part], actual.runtime![part]),
        )
      : [];
  return [
    ...tables.sort().filter((table) => differs(expected.manifest[table], actual.manifest[table])),
    ...runtime,
  ];
}

/** Serialize a snapshot as NDJSON lines. */
export function* serialize(snapshot: Snapshot): Generator<string> {
  for (const [table, tableNumber] of [...snapshot.tableNumbers].sort(([a], [b]) =>
    a < b ? -1 : 1,
  ))
    yield `${JSON.stringify({ table, tableNumber })}\n`;
  for (const [table, docs] of [...snapshot.documents].sort(([a], [b]) => (a < b ? -1 : 1)))
    for (const doc of docs)
      yield `${JSON.stringify({ table, document: convexToJson(doc as Value) })}\n`;
  for (const job of snapshot.scheduledFunctions)
    yield `${JSON.stringify({ scheduledFunction: convexToJson(job as Value) })}\n`;
  for (const [cron, lastOccurrence] of snapshot.cronCursors)
    yield `${JSON.stringify({ cron, lastOccurrence })}\n`;
  for (const mutation of snapshot.mutationLog) yield `${JSON.stringify({ mutation })}\n`;
}

function fail(message: string): never {
  throw new Error(message);
}

function document(json: JSONValue | undefined, label: string): Doc {
  if (json === null || typeof json !== "object" || Array.isArray(json))
    fail(`${label}: not a document`);
  const doc = jsonToConvex(json) as Doc;
  if (!decodeDocumentId(doc._id)) fail(`${label}: invalid Convex ID`);
  if (typeof doc._creationTime !== "number") fail(`${label} ${doc._id}: no _creationTime`);
  return doc;
}

/**
 * Parse snapshot lines, refusing anything malformed or inconsistent: unknown
 * records, bad table names or numbers, IDs of another table, duplicates.
 */
export function parse(lines: Iterable<string>): Snapshot {
  const snapshot: Snapshot = {
    tableNumbers: new Map(),
    documents: new Map(),
    scheduledFunctions: [],
    cronCursors: new Map(),
    mutationLog: [],
  };
  const ids = new Set<string>();
  const replays = new Set<string>();
  const number = (table: string, value: number) => {
    if (!TABLE_NAME.test(table)) fail(`Refusing to restore table ${JSON.stringify(table)}`);
    if (!Number.isInteger(value) || value < FIRST_USER_TABLE_NUMBER)
      fail(`Table ${table} has invalid number ${value}`);
    const known = snapshot.tableNumbers.get(table);
    if (known !== undefined && known !== value)
      fail(`Table ${table} listed with numbers ${known} and ${value}`);
    for (const [other, otherNumber] of snapshot.tableNumbers)
      if (other !== table && otherNumber === value)
        fail(`Table number ${value} given to both ${other} and ${table}`);
    snapshot.tableNumbers.set(table, value);
  };
  const unique = (id: string) => {
    if (ids.has(id)) fail(`Document ${id} appears twice`);
    ids.add(id);
  };
  for (const line of lines) {
    if (!line.trim()) continue;
    const record = JSON.parse(line) as Record<string, JSONValue | undefined>;
    const keys = Object.keys(record).sort().join(",");
    if (keys === "table,tableNumber") {
      number(record.table as string, record.tableNumber as number);
    } else if (keys === "document,table") {
      const table = record.table as string;
      const doc = document(record.document, `Document in ${table}`);
      number(table, decodeDocumentId(doc._id)!.tableNumber);
      unique(doc._id);
      if (!snapshot.documents.has(table)) snapshot.documents.set(table, []);
      snapshot.documents.get(table)!.push(doc);
    } else if (keys === "scheduledFunction") {
      const job = document(record.scheduledFunction, "Scheduled function");
      if (decodeDocumentId(job._id)!.tableNumber !== SCHEDULED_FUNCTIONS_NUMBER)
        fail(`Scheduled function ${job._id} is not a ${SCHEDULED_FUNCTIONS} ID`);
      const state = (job.state as { kind?: unknown } | undefined)?.kind;
      if (
        typeof job.name !== "string" ||
        !Array.isArray(job.args) ||
        typeof job.scheduledTime !== "number" ||
        !JOB_STATES.includes(state as string)
      )
        fail(`Scheduled function ${job._id} is malformed`);
      unique(job._id);
      snapshot.scheduledFunctions.push(job);
    } else if (keys === "cron,lastOccurrence") {
      if (typeof record.cron !== "string" || typeof record.lastOccurrence !== "number")
        fail(`Malformed cron cursor ${line.trim()}`);
      if (snapshot.cronCursors.has(record.cron)) fail(`Cron ${record.cron} appears twice`);
      snapshot.cronCursors.set(record.cron, record.lastOccurrence);
    } else if (keys === "mutation") {
      const entry = record.mutation as Record<string, JSONValue>;
      if (
        typeof entry?.session !== "string" ||
        typeof entry.request !== "number" ||
        typeof entry.result !== "string" ||
        typeof entry.ts !== "string" ||
        !/^\d+$/.test(entry.ts) ||
        typeof entry.at !== "number"
      )
        fail(`Malformed mutation record ${line.trim().slice(0, 120)}`);
      const key = `${entry.session}\u0000${entry.request}`;
      if (replays.has(key)) fail(`Mutation ${entry.session}/${entry.request} appears twice`);
      replays.add(key);
      snapshot.mutationLog.push(entry as unknown as MutationLogEntry);
    } else {
      fail(`Unknown snapshot record with fields ${keys}`);
    }
  }
  return snapshot;
}

/** ID checks against the snapshot's own table numbers (before they are stored). */
function stagedIsId(tableNumbers: Map<string, number>): IdChecker {
  const names = new Map([...tableNumbers].map(([name, number]) => [number, name]));
  return (id, table) => {
    const decoded = decodeDocumentId(id);
    if (!decoded) return false;
    const owner = names.get(decoded.tableNumber);
    return owner === undefined ? !tableNumbers.has(table) : owner === table;
  };
}

/**
 * Make the backend hold exactly `snapshot`: documents, table numbers, jobs,
 * cron cursors and replay records, in one transaction and only while writes
 * are paused. Everything is validated first, so a refused restore changes
 * nothing. Returns the summary of the state now stored.
 */
export async function restore(
  engine: Engine,
  snapshot: Snapshot,
  recorded: Summary = summarize(snapshot),
): Promise<Summary> {
  const expected = summarize(snapshot);
  verify(summarySchema.parse(recorded), expected);
  const store = engine.store;
  const isId = stagedIsId(snapshot.tableNumbers);
  for (const [table, docs] of snapshot.documents)
    for (const doc of docs) store.validate(table, doc, isId);
  await engine.replaceState(({ write }) => {
    for (const table of store.tables())
      for (const doc of [...store.allDocuments(table)]) write(table, doc._id, null);
    for (const [table, docs] of snapshot.documents)
      for (const doc of docs) write(table, doc._id, doc);
    for (const job of snapshot.scheduledFunctions) write(SCHEDULED_FUNCTIONS, job._id, job);
    return () => {
      store.replaceRegistry(snapshot.tableNumbers);
      store.replaceCronCursors(snapshot.cronCursors);
      store.replaceMutationLog(snapshot.mutationLog);
      // Still inside SQLite's transaction: even a mid-restore discrepancy rolls back
      // documents, registry, jobs, cursors and replay results together.
      verify(expected, summarize(readState(engine)));
    };
  });
  return summarize(readState(engine));
}
