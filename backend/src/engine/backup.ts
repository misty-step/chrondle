/**
 * Backup, restore and reconciliation for the Convex document store.
 *
 * Backup format (NDJSON), also produced from a Convex snapshot export by
 * backend/scripts/convex-snapshot.mjs so data moves both ways losslessly:
 *   {"table":"users","tableNumber":10002}                  one per table, first
 *   {"table":"users","document":{"_id":"…","_creationTime":…,…}}
 * Table numbers are kept for empty tables too, so IDs minted later still
 * decode to the table Convex knows (lossless rollback).
 *
 * Reconciliation hashes canonical records, not storage files: per table,
 * sha256 over the sorted lines `canonicalJson(document) + "\n"`.
 */
import { createHash } from "node:crypto";
import { convexToJson, jsonToConvex, type JSONValue, type Value } from "convex/values";
import type { Engine } from "./engine";
import { decodeDocumentId } from "./ids";
import type { Doc } from "./store";

export type TableSummary = { tableNumber: number | null; count: number; sha256: string };
export type Manifest = Record<string, TableSummary>;

export function canonicalJson(value: JSONValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key] as JSONValue)}`).join(",")}}`;
}

/** Hash documents the same way on both sides of a migration. */
export function summarizeDocuments(
  tableNumber: number | null,
  documents: Iterable<JSONValue>,
): TableSummary {
  const lines = [...documents].map(canonicalJson).sort();
  const hash = createHash("sha256");
  for (const line of lines) hash.update(`${line}\n`);
  return { tableNumber, count: lines.length, sha256: hash.digest("hex") };
}

/** Application tables: declared in the schema, numbered, or holding documents. */
function userTables(engine: Engine): string[] {
  const store = engine.store;
  const names = new Set<string>([
    ...store.schema.tables.keys(),
    ...store.registeredTables().keys(),
    ...store.tables(),
  ]);
  return [...names].filter((name) => !name.startsWith("_")).sort();
}

export function summarize(engine: Engine): Manifest {
  const numbers = engine.store.registeredTables();
  const manifest: Manifest = {};
  for (const table of userTables(engine)) {
    const documents = [...engine.store.allDocuments(table)].map((doc) =>
      convexToJson(doc as Value),
    );
    manifest[table] = summarizeDocuments(numbers.get(table) ?? null, documents);
  }
  return manifest;
}

/** Serialize every application table (numbers first, then documents) as NDJSON. */
export function* exportLines(engine: Engine): Generator<string> {
  const numbers = engine.store.registeredTables();
  const tables = userTables(engine);
  for (const table of tables) {
    const tableNumber = numbers.get(table);
    if (tableNumber !== undefined) yield `${JSON.stringify({ table, tableNumber })}\n`;
  }
  for (const table of tables) {
    for (const doc of engine.store.allDocuments(table))
      yield `${JSON.stringify({ table, document: convexToJson(doc as Value) })}\n`;
  }
}

type Parsed = { numbers: Map<string, number>; documents: Map<string, Doc[]> };

function parse(lines: Iterable<string>): Parsed {
  const numbers = new Map<string, number>();
  const documents = new Map<string, Doc[]>();
  for (const line of lines) {
    if (!line.trim()) continue;
    const record = JSON.parse(line) as {
      table?: unknown;
      tableNumber?: unknown;
      document?: JSONValue;
    };
    const table = record.table;
    if (typeof table !== "string" || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(table))
      throw new Error(`Refusing to restore table ${String(table)}`);
    if (record.document === undefined) {
      if (typeof record.tableNumber !== "number")
        throw new Error(`Line for ${table} has neither tableNumber nor document`);
      const known = numbers.get(table);
      if (known !== undefined && known !== record.tableNumber)
        throw new Error(`Table ${table} listed with numbers ${known} and ${record.tableNumber}`);
      numbers.set(table, record.tableNumber);
      continue;
    }
    const doc = jsonToConvex(record.document) as Doc;
    const decoded = decodeDocumentId(doc._id);
    if (!decoded) throw new Error(`Document in ${table} has an invalid Convex ID`);
    if (typeof doc._creationTime !== "number")
      throw new Error(`Document ${doc._id} has no _creationTime`);
    const known = numbers.get(table);
    if (known !== undefined && known !== decoded.tableNumber) {
      throw new Error(
        `Document ${doc._id} has table number ${decoded.tableNumber}, but ${table} is ${known}`,
      );
    }
    numbers.set(table, decoded.tableNumber);
    if (!documents.has(table)) documents.set(table, []);
    documents.get(table)!.push(doc);
  }
  return { numbers, documents };
}

/**
 * Make the application tables equal the backup: every user table not in the
 * backup is emptied, every table in it is replaced, in one transaction.
 * Documents keep `_id` / `_creationTime` and are schema-validated first.
 */
export async function restore(engine: Engine, lines: Iterable<string>): Promise<Manifest> {
  const { numbers, documents } = parse(lines);
  const store = engine.store;
  for (const [table, number] of numbers) store.registerTable(table, number);
  for (const [table, docs] of documents) for (const doc of docs) store.validate(table, doc);

  await engine.writeExclusive((write) => {
    for (const table of userTables(engine)) {
      for (const existing of [...store.allDocuments(table)]) write(table, existing._id, null);
    }
    for (const [table, docs] of documents) for (const doc of docs) write(table, doc._id, doc);
  });
  for (const docs of documents.values())
    for (const doc of docs) store.observeCreationTime(doc._creationTime);
  return summarize(engine);
}
