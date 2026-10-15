#!/usr/bin/env bun
/**
 * Move Chrondle data between Convex and the Cloudflare backend, losslessly.
 *
 *   bun backend/scripts/convex-snapshot.ts to-backup <convex-export.zip> <out.ndjson>
 *   bun backend/scripts/convex-snapshot.ts to-convex <backup.ndjson> <out.zip>
 *   bun backend/scripts/convex-snapshot.ts manifest <file.zip|file.ndjson>
 *   bun backend/scripts/convex-snapshot.ts compare <a.json> <b.json>
 *
 * `to-backup` and `to-convex` also write `<out>.manifest.json`: per-table
 * counts and canonical-record SHA-256, the same numbers the backend reports
 * from `/_backend/admin/import`, `/manifest` and `/export`. `compare` exits 1
 * on any difference. The runbook is in docs/adr/0001-cloudflare-backend.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { Manifest } from "../src/engine/backup";
import {
  fromBackup,
  manifestMismatches,
  readSnapshot,
  snapshotManifest,
  toBackup,
  writeSnapshot,
  type Snapshot,
} from "../src/migration/convexSnapshot";
import { readZip, writeZip } from "../src/migration/zip";

function load(path: string): Snapshot {
  if (path.endsWith(".zip")) return readSnapshot(readZip(new Uint8Array(readFileSync(path))));
  return fromBackup(readFileSync(path, "utf8").split("\n"));
}

function loadManifest(path: string): Manifest {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Manifest | { manifest: Manifest };
  return "manifest" in parsed && typeof parsed.manifest === "object"
    ? (parsed.manifest as Manifest)
    : (parsed as Manifest);
}

function report(manifest: Manifest): string {
  return Object.entries(manifest)
    .map(([table, summary]) => `${table}=${summary.count}`)
    .join(" ");
}

function save(out: string, body: string | Uint8Array, snapshot: Snapshot) {
  writeFileSync(out, body, { mode: 0o600 });
  const manifest = snapshotManifest(snapshot);
  writeFileSync(`${out}.manifest.json`, `${JSON.stringify({ manifest }, null, 2)}\n`, {
    mode: 0o600,
  });
  console.log(`wrote ${out}: ${report(manifest)}`);
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case "to-backup": {
    const snapshot = load(args[0]);
    save(args[1], [...toBackup(snapshot)].join(""), snapshot);
    break;
  }
  case "to-convex": {
    const snapshot = load(args[0]);
    save(args[1], writeZip(writeSnapshot(snapshot)), snapshot);
    break;
  }
  case "manifest":
    console.log(JSON.stringify({ manifest: snapshotManifest(load(args[0])) }, null, 2));
    break;
  case "compare": {
    const mismatches = manifestMismatches(loadManifest(args[0]), loadManifest(args[1]));
    console.log(
      mismatches.length === 0 ? "manifests match" : `MISMATCH in: ${mismatches.join(", ")}`,
    );
    process.exit(mismatches.length === 0 ? 0 : 1);
    break;
  }
  default:
    console.error("usage: convex-snapshot.ts to-backup|to-convex|manifest|compare …");
    process.exit(2);
}
