#!/usr/bin/env bun
/**
 * Move Chrondle data between Convex and the Cloudflare backend, losslessly.
 *
 *   bun backend/scripts/convex-snapshot.ts to-backup <convex-export.zip> <out.ndjson> --as-of <ISO time>
 *   bun backend/scripts/convex-snapshot.ts to-convex <snapshot.ndjson> <out.zip>
 *   bun backend/scripts/convex-snapshot.ts manifest <file.zip|file.ndjson>
 *   bun backend/scripts/convex-snapshot.ts compare <a.json> <b.json>
 *
 * `to-backup` needs `--as-of`, the time Convex stopped running functions (its
 * pause): every cron occurrence up to then counts as run by Convex, later ones
 * run on the new backend. `to-convex` refuses snapshots with pending or
 * running scheduled functions, which Convex cannot import.
 *
 * Both write `<out>.manifest.json`: per-table counts and canonical-record
 * SHA-256 (plus the runtime summary for backend snapshots), the numbers the
 * backend reports from `/_backend/admin/import`, `/manifest` and `/export`.
 * `compare` exits 1 on any difference. The runbook is in
 * docs/adr/0001-cloudflare-backend.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as crons from "../../convex/crons";
import {
  mismatches,
  parse,
  serialize,
  summarize,
  type Manifest,
  type RuntimeSummary,
  type Snapshot,
} from "../src/engine/backup";
import { parseCrons, previousOccurrence } from "../src/engine/scheduler";
import { readSnapshot, writeSnapshot } from "../src/migration/convexSnapshot";
import { readZip, writeZip } from "../src/migration/zip";

type Summarized = { manifest: Manifest; runtime?: RuntimeSummary };

const [command, ...rest] = process.argv.slice(2);
const positional = rest.filter((arg, i) => !arg.startsWith("--") && !rest[i - 1]?.startsWith("--"));
const option = (name: string) => {
  const index = rest.indexOf(`--${name}`);
  return index === -1 ? undefined : rest[index + 1];
};

function load(path: string, cronCursors = new Map<string, number>()): Snapshot {
  if (path.endsWith(".zip"))
    return readSnapshot(readZip(new Uint8Array(readFileSync(path))), cronCursors);
  return parse(readFileSync(path, "utf8").split("\n"));
}

function loadSummary(path: string): Summarized {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Summarized | Manifest;
  return "manifest" in parsed && typeof parsed.manifest === "object"
    ? (parsed as Summarized)
    : { manifest: parsed as Manifest };
}

function report(summary: Summarized): string {
  const tables = Object.entries(summary.manifest).map(([table, s]) => `${table}=${s.count}`);
  const jobs = summary.runtime?.scheduledFunctions.count;
  return [...tables, ...(jobs === undefined ? [] : [`_scheduled_functions=${jobs}`])].join(" ");
}

function save(out: string, body: string | Uint8Array, summary: Summarized, extra = {}) {
  writeFileSync(out, body, { mode: 0o600 });
  writeFileSync(`${out}.manifest.json`, `${JSON.stringify({ ...summary, ...extra }, null, 2)}\n`, {
    mode: 0o600,
  });
  console.log(`wrote ${out}: ${report(summary)}`);
}

switch (command) {
  case "to-backup": {
    const asOf = Date.parse(option("as-of") ?? "");
    if (Number.isNaN(asOf)) {
      console.error("to-backup needs --as-of <ISO time Convex was paused>");
      process.exit(2);
    }
    const cursors = new Map(
      parseCrons(crons as never).map((cron) => [
        cron.name,
        previousOccurrence(cron.schedule, asOf),
      ]),
    );
    const snapshot = load(positional[0], cursors);
    save(positional[1], [...serialize(snapshot)].join(""), summarize(snapshot));
    break;
  }
  case "to-convex": {
    const snapshot = load(positional[0]);
    const { entries, dropped } = writeSnapshot(snapshot);
    save(positional[1], writeZip(entries), { manifest: summarize(snapshot).manifest }, { dropped });
    console.log(
      `left out (Convex cannot import them): ${dropped.finishedJobs} finished job records, ${dropped.cronCursors} cron cursors, ${dropped.mutationLog} replay records`,
    );
    break;
  }
  case "manifest": {
    const summary = summarize(load(positional[0]));
    const shown = positional[0].endsWith(".zip") ? { manifest: summary.manifest } : summary;
    console.log(JSON.stringify(shown, null, 2));
    break;
  }
  case "compare": {
    const differences = mismatches(loadSummary(positional[0]), loadSummary(positional[1]));
    console.log(
      differences.length === 0 ? "manifests match" : `MISMATCH in: ${differences.join(", ")}`,
    );
    process.exit(differences.length === 0 ? 0 : 1);
    break;
  }
  default:
    console.error("usage: convex-snapshot.ts to-backup|to-convex|manifest|compare …");
    process.exit(2);
}
