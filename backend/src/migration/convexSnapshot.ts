/**
 * Convert between a Convex snapshot ZIP (`npx convex export` / `npx convex
 * import`) and this backend's backup NDJSON (see ../engine/backup.ts), keeping
 * every `_id`, `_creationTime` and table number.
 *
 * Snapshot layout, as written by Convex's export worker:
 *   _tables/documents.jsonl        {"name":"users","id":10002} per user table
 *   <table>/documents.jsonl        one document per line, "export JSON"
 *   <table>/generated_schema.jsonl "uniform" (marks the export JSON format)
 *
 * Export JSON is Convex's `ConvexExportJSON` value format: int64 is a bare
 * integer, float64 always has a fraction or exponent ("3.0", "-0.0"),
 * non-finite floats and bytes use `{"$float"|"$bytes": base64}`. Telling
 * "3" (int64) from "3.0" (float64) needs the source text of each number, so
 * parsing uses JSON.parse's `context.source`.
 */
import { convexToJson, jsonToConvex, type JSONValue, type Value } from "convex/values";
import type { Manifest } from "../engine/backup";
import { summarizeDocuments } from "../engine/backup";
import type { ZipEntries } from "./zip";

type Doc = Record<string, Value> & { _id: string; _creationTime: number };
export type Snapshot = { tableNumbers: Map<string, number>; documents: Map<string, Doc[]> };

const TABLES = "_tables/documents.jsonl";
const TABLE_NAME = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;

/** Parse one export-JSON line into a Convex value. */
export function parseExportJson(line: string): Value {
  const reviver = function (
    this: unknown,
    _key: string,
    value: unknown,
    context?: { source?: string },
  ) {
    if (typeof value === "number") {
      const source = context?.source;
      if (source === undefined) throw new Error("JSON.parse source text access is required");
      return /^-?\d+$/.test(source) ? BigInt(source) : value;
    }
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const keys = Object.keys(value);
      if (keys.length === 1 && keys[0].startsWith("$")) {
        const encoded = (value as Record<string, unknown>)[keys[0]];
        if (typeof encoded !== "string") throw new Error(`Malformed ${keys[0]} value`);
        return jsonToConvex({ [keys[0]]: encoded } as JSONValue);
      }
    }
    return value;
  } as (key: string, value: unknown) => unknown;
  return JSON.parse(line, reviver) as Value;
}

/** Serialize a Convex value as export JSON (what `npx convex import` expects). */
export function formatExportJson(value: Value): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "bigint") {
    if (value < INT64_MIN || value > INT64_MAX) throw new Error(`int64 out of range: ${value}`);
    return value.toString();
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return JSON.stringify(convexToJson(value));
    if (Object.is(value, -0)) return "-0.0";
    const text = String(value);
    return /[.eE]/.test(text) ? text : `${text}.0`;
  }
  if (value instanceof ArrayBuffer) return JSON.stringify(convexToJson(value));
  if (Array.isArray(value)) return `[${value.map(formatExportJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, Value>).filter(
    ([, field]) => field !== undefined,
  );
  return `{${entries.map(([key, field]) => `${JSON.stringify(key)}:${formatExportJson(field)}`).join(",")}}`;
}

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const lines = (body: string) => body.split("\n").filter((line) => line.trim() !== "");

/** Read a Convex snapshot export. Refuses anything this backend cannot hold. */
export function readSnapshot(entries: ZipEntries): Snapshot {
  const tableNumbers = new Map<string, number>();
  const documents = new Map<string, Doc[]>();
  const tablesEntry = entries.get(TABLES);
  if (!tablesEntry) throw new Error(`Snapshot has no ${TABLES}; export it with npx convex export`);
  for (const line of lines(text(tablesEntry))) {
    const { name, id } = JSON.parse(line) as { name: string; id: number };
    if (!TABLE_NAME.test(name)) throw new Error(`Unexpected table name ${JSON.stringify(name)}`);
    tableNumbers.set(name, id);
  }
  for (const [path, bytes] of entries) {
    if (path === TABLES || path === "README.md" || path.endsWith("/generated_schema.jsonl"))
      continue;
    if (path.startsWith("_components/"))
      throw new Error("Snapshots with components are not supported");
    const match = /^([^/]+)\/documents\.jsonl$/.exec(path);
    if (!match) throw new Error(`Unexpected snapshot entry ${path}`);
    const table = match[1];
    const rows = lines(text(bytes));
    if (table.startsWith("_")) {
      if (rows.length > 0)
        throw new Error(
          `Snapshot holds ${rows.length} ${table} records; file storage is not supported`,
        );
      continue;
    }
    if (!tableNumbers.has(table)) throw new Error(`Table ${table} is missing from ${TABLES}`);
    documents.set(
      table,
      rows.map((row) => parseExportJson(row) as Doc),
    );
  }
  return { tableNumbers, documents };
}

/** Build the snapshot ZIP entries `npx convex import --replace-all` reads. */
export function writeSnapshot(snapshot: Snapshot): ZipEntries {
  const encoder = new TextEncoder();
  const entries: ZipEntries = new Map();
  const numbered = [...snapshot.tableNumbers].sort((a, b) => a[1] - b[1]);
  entries.set(
    TABLES,
    encoder.encode(numbered.map(([name, id]) => `${JSON.stringify({ name, id })}\n`).join("")),
  );
  for (const [table] of numbered) {
    const docs = snapshot.documents.get(table) ?? [];
    entries.set(
      `${table}/documents.jsonl`,
      encoder.encode(docs.map((doc) => `${formatExportJson(doc)}\n`).join("")),
    );
    entries.set(`${table}/generated_schema.jsonl`, encoder.encode('"uniform"\n'));
  }
  return entries;
}

/** Backup NDJSON (../engine/backup.ts format) → snapshot. */
export function fromBackup(backupLines: Iterable<string>): Snapshot {
  const tableNumbers = new Map<string, number>();
  const documents = new Map<string, Doc[]>();
  for (const line of backupLines) {
    if (!line.trim()) continue;
    const record = JSON.parse(line) as {
      table: string;
      tableNumber?: number;
      document?: JSONValue;
    };
    if (record.document === undefined) {
      tableNumbers.set(record.table, record.tableNumber as number);
      continue;
    }
    if (!documents.has(record.table)) documents.set(record.table, []);
    documents.get(record.table)!.push(jsonToConvex(record.document) as Doc);
  }
  for (const table of documents.keys()) {
    if (!tableNumbers.has(table))
      throw new Error(`Backup has documents for ${table} but no table number`);
  }
  return { tableNumbers, documents };
}

/** Snapshot → backup NDJSON lines (table numbers first, like exportLines). */
export function* toBackup(snapshot: Snapshot): Generator<string> {
  const tables = [...snapshot.tableNumbers.keys()].sort();
  for (const table of tables)
    yield `${JSON.stringify({ table, tableNumber: snapshot.tableNumbers.get(table) })}\n`;
  for (const table of tables) {
    for (const doc of snapshot.documents.get(table) ?? []) {
      yield `${JSON.stringify({ table, document: convexToJson(doc as Value) })}\n`;
    }
  }
}

/** Per-table counts and canonical-record SHA-256, identical to the backend's manifest. */
export function snapshotManifest(snapshot: Snapshot): Manifest {
  const manifest: Manifest = {};
  for (const table of [...snapshot.tableNumbers.keys()].sort()) {
    const docs = (snapshot.documents.get(table) ?? []).map((doc) => convexToJson(doc as Value));
    manifest[table] = summarizeDocuments(snapshot.tableNumbers.get(table) ?? null, docs);
  }
  return manifest;
}

/** Tables whose count, hash or table number differ between two manifests. */
export function manifestMismatches(expected: Manifest, actual: Manifest): string[] {
  const tables = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
  return tables.filter(
    (table) => JSON.stringify(expected[table] ?? null) !== JSON.stringify(actual[table] ?? null),
  );
}
