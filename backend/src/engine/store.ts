/**
 * Document store for Convex tables on SQLite (a Durable Object in production,
 * `node:sqlite` in tests).
 *
 * - `cvx_documents` holds every document as Convex JSON, keyed by Convex ID.
 * - `cvx_index` holds one row per (index, document) with an order-preserving
 *   key (see keys.ts), so index ranges are SQL range scans in Convex order.
 * - Writes are buffered by `Transaction` and applied atomically by `commit`.
 */
import { convexToJson, jsonToConvex, type Value } from "convex/values";
import { decodeDocumentId, newDocumentId } from "./ids";
import { encodeKey, fieldValue, KEY_MAX_SUFFIX } from "./keys";
import { checkDocument, type IdChecker, type ValidatorJSON } from "./validate";

export type SqlValue = string | number | null;
export type SqlRow = Record<string, SqlValue>;

/** Minimal synchronous SQL surface shared by Durable Objects and node:sqlite. */
export interface Sql {
  exec(query: string, ...params: SqlValue[]): SqlRow[];
  transaction<T>(fn: () => T): T;
}

export type Doc = Record<string, Value> & { _id: string; _creationTime: number };

/** A committed client mutation's result, kept so a replayed request gets it again. */
export type MutationLogEntry = {
  session: string;
  request: number;
  result: string;
  ts: string;
  at: number;
};

/** Replay records are kept a day; clients replay unacknowledged mutations on reconnect. */
const MUTATION_LOG_RETENTION_MS = 24 * 60 * 60 * 1000;
const CRON_CURSOR = "cron:";

/** Metadata key holding a cron's last dispatched occurrence. */
export function cronCursorKey(name: string): string {
  return `${CRON_CURSOR}${name}`;
}

export interface IndexDef {
  /** `${table}.${indexName}` */
  name: string;
  table: string;
  fields: string[];
}

export interface TableDef {
  name: string;
  documentType: ValidatorJSON | null;
  indexes: IndexDef[];
}

export interface SchemaInfo {
  tables: Map<string, TableDef>;
  schemaValidation: boolean;
}

export const SCHEDULED_FUNCTIONS = "_scheduled_functions";
const SYSTEM_TABLE_NUMBERS: Record<string, number> = { [SCHEDULED_FUNCTIONS]: 9 };
const FIRST_USER_TABLE_NUMBER = 10001;
const PAGE = 256;

/** Build schema info from `schema.export()` plus the system tables we host. */
export function schemaInfoFromExport(exported: string | null): SchemaInfo {
  const tables = new Map<string, TableDef>();
  const parsed = exported
    ? (JSON.parse(exported) as {
        tables: Array<{
          tableName: string;
          indexes: Array<{ indexDescriptor: string; fields: string[] }>;
          documentType: ValidatorJSON | null;
        }>;
        schemaValidation: boolean;
      })
    : { tables: [], schemaValidation: false };
  for (const table of parsed.tables) {
    tables.set(table.tableName, {
      name: table.tableName,
      documentType: table.documentType ?? null,
      indexes: table.indexes.map((index) => ({
        name: `${table.tableName}.${index.indexDescriptor}`,
        table: table.tableName,
        fields: index.fields,
      })),
    });
  }
  tables.set(SCHEDULED_FUNCTIONS, {
    name: SCHEDULED_FUNCTIONS,
    documentType: null,
    indexes: [
      {
        name: `${SCHEDULED_FUNCTIONS}.by_state_time`,
        table: SCHEDULED_FUNCTIONS,
        fields: ["state.kind", "scheduledTime"],
      },
    ],
  });
  return { tables, schemaValidation: parsed.schemaValidation };
}

/** All indexes of a table including the implicit Convex ones, with full key fields. */
export function indexesFor(schema: SchemaInfo, table: string): IndexDef[] {
  const declared = schema.tables.get(table)?.indexes ?? [];
  return [
    { name: `${table}.by_creation_time`, table, fields: ["_creationTime", "_id"] },
    { name: `${table}.by_id`, table, fields: ["_id"] },
    ...declared.map((index) => ({ ...index, fields: [...index.fields, "_creationTime", "_id"] })),
  ];
}

export function documentKey(index: IndexDef, document: Doc): string {
  return encodeKey(index.fields.map((field) => fieldValue(document, field)));
}

export function serializeFields(document: Doc): string {
  const { _id, _creationTime, ...fields } = document;
  void _id;
  void _creationTime;
  return JSON.stringify(convexToJson(fields as Value));
}

function rowToDoc(row: SqlRow): Doc {
  const fields = jsonToConvex(JSON.parse(row.doc as string)) as Record<string, Value>;
  return { _creationTime: row.ct as number, _id: row.id as string, ...fields } as Doc;
}

export type Range = { lower: string; upper: string };
export type SerializedRange = Array<{
  type: "Eq" | "Gt" | "Gte" | "Lt" | "Lte";
  fieldPath: string;
  value: Value | undefined;
}>;

/** Translate an index range expression into a half-open key interval. */
export function keyRange(index: IndexDef, range: SerializedRange): Range {
  let prefix = "";
  let i = 0;
  for (; i < range.length && range[i].type === "Eq"; i++) {
    if (range[i].fieldPath !== index.fields[i]) {
      throw new Error(
        `Index range for ${index.name} must use fields in index order; expected ${index.fields[i]} but got ${range[i].fieldPath}`,
      );
    }
    prefix += encodeKey([range[i].value]);
  }
  let lower = prefix;
  let upper = prefix + KEY_MAX_SUFFIX;
  const boundField = index.fields[i];
  for (const bound of range.slice(i)) {
    if (bound.type === "Eq" || bound.fieldPath !== boundField) {
      throw new Error(`Invalid index range for ${index.name}: ${JSON.stringify(range)}`);
    }
    const encoded = prefix + encodeKey([bound.value]);
    if (bound.type === "Gte") lower = encoded;
    if (bound.type === "Gt") lower = encoded + KEY_MAX_SUFFIX;
    if (bound.type === "Lte") upper = encoded + KEY_MAX_SUFFIX;
    if (bound.type === "Lt") upper = encoded;
  }
  return { lower, upper };
}

export class Store {
  private tableNumbers = new Map<string, number>();
  private tableNames = new Map<number, string>();
  private lastCreationTime = 0;

  constructor(
    readonly sql: Sql,
    readonly schema: SchemaInfo,
  ) {}

  init(): void {
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS cvx_documents (id TEXT PRIMARY KEY, tbl TEXT NOT NULL, ct REAL NOT NULL, doc TEXT NOT NULL) WITHOUT ROWID",
    );
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS cvx_index (ix TEXT NOT NULL, k TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY (ix, k)) WITHOUT ROWID",
    );
    this.sql.exec("CREATE INDEX IF NOT EXISTS cvx_documents_tbl ON cvx_documents (tbl)");
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS cvx_tables (name TEXT PRIMARY KEY, number INTEGER NOT NULL UNIQUE) WITHOUT ROWID",
    );
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS cvx_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID",
    );
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS cvx_mutation_log (session TEXT NOT NULL, request INTEGER NOT NULL, result TEXT NOT NULL, ts TEXT NOT NULL, at REAL NOT NULL, PRIMARY KEY (session, request)) WITHOUT ROWID",
    );
    this.reload();
    for (const [name, number] of Object.entries(SYSTEM_TABLE_NUMBERS))
      if (!this.tableNumbers.has(name)) this.registerTable(name, number);
    this.syncIndexes();
  }

  /** Re-read the table registry and creation-time watermark (after an import). */
  reload(): void {
    this.tableNumbers.clear();
    this.tableNames.clear();
    for (const row of this.sql.exec("SELECT name, number FROM cvx_tables")) {
      this.tableNumbers.set(row.name as string, row.number as number);
      this.tableNames.set(row.number as number, row.name as string);
    }
    const [{ maxCt }] = this.sql.exec("SELECT COALESCE(MAX(ct), 0) AS maxCt FROM cvx_documents");
    this.observeCreationTime(maxCt as number);
  }

  /** Rebuild index entries whose definition changed since the last deploy. */
  private syncIndexes(): void {
    const tables = new Set<string>(this.schema.tables.keys());
    for (const row of this.sql.exec("SELECT DISTINCT tbl FROM cvx_documents"))
      tables.add(row.tbl as string);
    const wanted = new Map<string, IndexDef>();
    for (const table of tables)
      for (const index of indexesFor(this.schema, table)) wanted.set(index.name, index);
    const stored = new Map<string, string>(
      Object.entries(JSON.parse(this.getMeta("index_defs") ?? "{}") as Record<string, string>),
    );
    const changed = [...wanted.values()].filter(
      (index) => stored.get(index.name) !== JSON.stringify(index.fields),
    );
    const removed = [...stored.keys()].filter((name) => !wanted.has(name));
    if (changed.length === 0 && removed.length === 0) return;
    this.sql.transaction(() => {
      for (const name of [...removed, ...changed.map((index) => index.name)]) {
        this.sql.exec("DELETE FROM cvx_index WHERE ix = ?", name);
      }
      for (const index of changed) {
        for (const row of this.sql.exec(
          "SELECT id, ct, doc FROM cvx_documents WHERE tbl = ?",
          index.table,
        )) {
          const document = rowToDoc(row);
          this.sql.exec(
            "INSERT INTO cvx_index (ix, k, id) VALUES (?, ?, ?)",
            index.name,
            documentKey(index, document),
            document._id,
          );
        }
      }
      const definitions = Object.fromEntries(
        [...wanted.values()].map((index) => [index.name, JSON.stringify(index.fields)]),
      );
      this.setMeta("index_defs", JSON.stringify(definitions));
    });
  }

  getMeta(key: string): string | null {
    const rows = this.sql.exec("SELECT value FROM cvx_meta WHERE key = ?", key);
    return rows.length ? (rows[0].value as string) : null;
  }

  setMeta(key: string, value: string): void {
    this.sql.exec(
      "INSERT INTO cvx_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      key,
      value,
    );
  }

  /** Last dispatched occurrence of each cron (`cron:<name>` metadata). */
  cronCursors(): Map<string, number> {
    const rows = this.sql.exec(
      "SELECT key, value FROM cvx_meta WHERE substr(key, 1, ?) = ? ORDER BY key",
      CRON_CURSOR.length,
      CRON_CURSOR,
    );
    return new Map(
      rows.map((row) => [(row.key as string).slice(CRON_CURSOR.length), Number(row.value)]),
    );
  }

  cronCursor(name: string): number | null {
    const value = this.getMeta(cronCursorKey(name));
    return value === null ? null : Number(value);
  }

  /** Inside a transaction: make the cron cursors exactly `cursors`. */
  replaceCronCursors(cursors: Map<string, number>): void {
    this.sql.exec(
      "DELETE FROM cvx_meta WHERE substr(key, 1, ?) = ?",
      CRON_CURSOR.length,
      CRON_CURSOR,
    );
    for (const [name, occurrence] of cursors) this.setMeta(cronCursorKey(name), String(occurrence));
  }

  loggedMutation(session: string, request: number): MutationLogEntry | null {
    const rows = this.sql.exec(
      "SELECT session, request, result, ts, at FROM cvx_mutation_log WHERE session = ? AND request = ?",
      session,
      request,
    );
    return rows.length ? (rows[0] as unknown as MutationLogEntry) : null;
  }

  /** Inside a transaction: record a committed mutation's result and drop expired ones. */
  logMutation(entry: MutationLogEntry, now: number): void {
    this.sql.exec(
      "INSERT INTO cvx_mutation_log (session, request, result, ts, at) VALUES (?, ?, ?, ?, ?)",
      entry.session,
      entry.request,
      entry.result,
      entry.ts,
      entry.at,
    );
    this.sql.exec("DELETE FROM cvx_mutation_log WHERE at < ?", now - MUTATION_LOG_RETENTION_MS);
  }

  mutationLog(): MutationLogEntry[] {
    return this.sql.exec(
      "SELECT session, request, result, ts, at FROM cvx_mutation_log ORDER BY session, request",
    ) as unknown as MutationLogEntry[];
  }

  /** Inside a transaction: make the replay records exactly `entries`. */
  replaceMutationLog(entries: MutationLogEntry[]): void {
    this.sql.exec("DELETE FROM cvx_mutation_log");
    for (const entry of entries)
      this.sql.exec(
        "INSERT INTO cvx_mutation_log (session, request, result, ts, at) VALUES (?, ?, ?, ?, ?)",
        entry.session,
        entry.request,
        entry.result,
        entry.ts,
        entry.at,
      );
  }

  /**
   * Inside a transaction: make the application tables' numbers exactly
   * `numbers` (system tables keep theirs). Call `reload()` after it commits.
   */
  replaceRegistry(numbers: Map<string, number>): void {
    this.sql.exec("DELETE FROM cvx_tables WHERE substr(name, 1, 1) != '_'");
    for (const [name, number] of numbers)
      this.sql.exec("INSERT INTO cvx_tables (name, number) VALUES (?, ?)", name, number);
  }

  /** Register a table number (from imported Convex IDs or a fresh assignment). */
  registerTable(name: string, number: number): void {
    const existing = this.tableNumbers.get(name);
    if (existing === number) return;
    if (existing !== undefined)
      throw new Error(`Table ${name} already uses number ${existing}, not ${number}`);
    const owner = this.tableNames.get(number);
    if (owner !== undefined) throw new Error(`Table number ${number} already belongs to ${owner}`);
    this.sql.exec("INSERT INTO cvx_tables (name, number) VALUES (?, ?)", name, number);
    this.tableNumbers.set(name, number);
    this.tableNames.set(number, name);
  }

  tableNumber(name: string): number {
    const existing = this.tableNumbers.get(name);
    if (existing !== undefined) return existing;
    const number =
      SYSTEM_TABLE_NUMBERS[name] ??
      Math.max(
        FIRST_USER_TABLE_NUMBER - 1,
        ...[...this.tableNumbers.values()].filter((n) => n >= FIRST_USER_TABLE_NUMBER),
      ) + 1;
    this.registerTable(name, number);
    return number;
  }

  /** Table name → Convex table number for every table that has one. */
  registeredTables(): Map<string, number> {
    return new Map(this.tableNumbers);
  }

  tableOf(id: string): string | null {
    const decoded = decodeDocumentId(id);
    if (!decoded) return null;
    return this.tableNames.get(decoded.tableNumber) ?? null;
  }

  isId(id: string, table: string): boolean {
    const decoded = decodeDocumentId(id);
    if (!decoded) return false;
    const owner = this.tableNames.get(decoded.tableNumber);
    // A table that has never been written has no number yet; accept well-formed IDs for it.
    return owner === undefined ? !this.tableNumbers.has(table) : owner === table;
  }

  newId(table: string): string {
    return newDocumentId(this.tableNumber(table));
  }

  nextCreationTime(now: number): number {
    const candidate = now > this.lastCreationTime ? now : this.lastCreationTime + 1 / 1024;
    this.lastCreationTime = candidate;
    return candidate;
  }

  /** Keep new creation times above imported ones. */
  observeCreationTime(creationTime: number): void {
    if (creationTime > this.lastCreationTime) this.lastCreationTime = creationTime;
  }

  getCommitted(id: string): Doc | null {
    const rows = this.sql.exec("SELECT id, ct, doc FROM cvx_documents WHERE id = ?", id);
    return rows.length ? rowToDoc(rows[0]) : null;
  }

  /** Iterate committed documents of an index range in key order. */
  *scan(
    index: IndexDef,
    range: Range,
    order: "asc" | "desc",
  ): Generator<{ key: string; doc: Doc }> {
    let lower = range.lower;
    let upper = range.upper;
    let lowerOp = ">=";
    let upperOp = "<";
    for (;;) {
      const rows = this.sql.exec(
        `SELECT i.k AS k, d.id AS id, d.ct AS ct, d.doc AS doc FROM cvx_index i JOIN cvx_documents d ON d.id = i.id WHERE i.ix = ? AND i.k ${lowerOp} ? AND i.k ${upperOp} ? ORDER BY i.k ${order === "asc" ? "ASC" : "DESC"} LIMIT ${PAGE}`,
        index.name,
        lower,
        upper,
      );
      for (const row of rows) yield { key: row.k as string, doc: rowToDoc(row) };
      if (rows.length < PAGE) return;
      const last = rows[rows.length - 1].k as string;
      if (order === "asc") {
        lower = last;
        lowerOp = ">";
      } else {
        upper = last;
        upperOp = "<";
      }
    }
  }

  countTable(table: string): number {
    const [{ n }] = this.sql.exec("SELECT COUNT(*) AS n FROM cvx_documents WHERE tbl = ?", table);
    return n as number;
  }

  validate(
    table: string,
    document: Doc,
    isId: IdChecker = (id, name) => this.isId(id, name),
  ): void {
    if (!this.schema.schemaValidation) return;
    const documentType = this.schema.tables.get(table)?.documentType;
    if (!documentType) return;
    checkDocument(documentType, document, isId);
  }

  /** Apply committed writes. Must run inside `sql.transaction`. */
  applyWrite(table: string, before: Doc | null, after: Doc | null): void {
    for (const index of indexesFor(this.schema, table)) {
      const oldKey = before ? documentKey(index, before) : null;
      const newKey = after ? documentKey(index, after) : null;
      if (oldKey === newKey) continue;
      if (oldKey !== null)
        this.sql.exec("DELETE FROM cvx_index WHERE ix = ? AND k = ?", index.name, oldKey);
      if (newKey !== null)
        this.sql.exec(
          "INSERT INTO cvx_index (ix, k, id) VALUES (?, ?, ?)",
          index.name,
          newKey,
          after!._id,
        );
    }
    if (after) {
      // The whole row follows `after`, like its index keys: a restore may give
      // an existing ID the creation time recorded in the snapshot.
      this.sql.exec(
        "INSERT INTO cvx_documents (id, tbl, ct, doc) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET ct = excluded.ct, doc = excluded.doc",
        after._id,
        table,
        after._creationTime,
        serializeFields(after),
      );
    } else if (before) {
      this.sql.exec("DELETE FROM cvx_documents WHERE id = ?", before._id);
    }
  }

  *allDocuments(table: string): Generator<Doc> {
    for (const { doc } of this.scan(
      indexesFor(this.schema, table)[1],
      { lower: "", upper: KEY_MAX_SUFFIX },
      "asc",
    )) {
      yield doc;
    }
  }

  tables(): string[] {
    return this.sql
      .exec("SELECT DISTINCT tbl FROM cvx_documents ORDER BY tbl")
      .map((row) => row.tbl as string);
  }
}
