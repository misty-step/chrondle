/**
 * In-memory SQLite for tests: `bun:sqlite` when Vitest runs under Bun (CI's
 * Dagger image), `node:sqlite` under Node. Same Sql contract as the Durable
 * Object adapter.
 */
import { createRequire } from "node:module";
import type { Sql, SqlRow, SqlValue } from "../src/engine/store";

const require = createRequire(import.meta.url);

export function memorySql(): Sql {
  if (process.versions.bun) {
    const { Database } = require("bun:sqlite");
    const db = new Database(":memory:");
    return {
      exec: (query: string, ...params: SqlValue[]) => db.query(query).all(...params) as SqlRow[],
      transaction: <T>(fn: () => T): T => db.transaction(fn)(),
    };
  }
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(":memory:");
  let depth = 0;
  return {
    exec: (query: string, ...params: SqlValue[]) => db.prepare(query).all(...params) as SqlRow[],
    transaction: <T>(fn: () => T): T => {
      if (depth > 0) return fn();
      depth++;
      db.exec("BEGIN");
      try {
        const result = fn();
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      } finally {
        depth--;
      }
    },
  };
}
