import {
  actionGeneric,
  defineSchema,
  defineTable,
  internalMutationGeneric,
  makeFunctionReference,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v, type Value } from "convex/values";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import chrondleSchema from "../../convex/schema";
import {
  mismatches,
  parse,
  readState,
  restore,
  serialize,
  summarize,
  type Snapshot,
} from "../src/engine/backup";
import { decodeDocumentId } from "../src/engine/ids";
import {
  formatExportJson,
  parseExportJson,
  readSnapshot,
  writeSnapshot,
} from "../src/migration/convexSnapshot";
import { readZip, writeZip } from "../src/migration/zip";
import { makeEngine } from "./support";

const schema = defineSchema({
  users: defineTable({ name: v.string(), streak: v.number(), visits: v.optional(v.int64()) }),
  plays: defineTable({
    userId: v.id("users"),
    guesses: v.array(v.number()),
    blob: v.optional(v.bytes()),
  }),
  emptied: defineTable({ text: v.string() }),
});

const modules = {
  seed: {
    run: mutationGeneric({
      args: {},
      handler: async (ctx) => {
        const ada = await ctx.db.insert("users", {
          name: 'Ada "Countess" Lovelace ✓',
          streak: 3,
          visits: 9n,
        });
        await ctx.db.insert("users", { name: "Grace", streak: -0 });
        await ctx.db.insert("plays", {
          userId: ada,
          guesses: [1066, 1.5, 1e21, 1e-7],
          blob: new Uint8Array([0, 255, 7]).buffer,
        });
        await ctx.db.delete(await ctx.db.insert("emptied", { text: "gone" }));
      },
    }),
    addUser: mutationGeneric({
      args: { name: v.string() },
      handler: (ctx, { name }) => ctx.db.insert("users", { name, streak: 0 }),
    }),
    count: queryGeneric({
      args: {},
      handler: async (ctx) => (await ctx.db.query("users").collect()).length,
    }),
    later: mutationGeneric({
      args: { delayMs: v.number() },
      handler: (ctx, { delayMs }) =>
        ctx.scheduler.runAfter(delayMs, makeFunctionReference<"mutation">("seed:touch"), {}),
    }),
    touch: internalMutationGeneric({ args: {}, handler: async () => null }),
    ping: actionGeneric({ args: {}, handler: async () => "pong" }),
  },
};

async function seeded() {
  const engine = makeEngine(schema, modules);
  await engine.runMutation("seed:run", {}, null);
  return engine;
}

/** The backend's own snapshot of an engine, as GET /export serves it, parsed back. */
const backendSnapshot = (engine: ReturnType<typeof makeEngine>): Snapshot =>
  parse([...serialize(readState(engine))].join("").split("\n"));

/** Convex snapshot ZIP bytes for an engine, via the same path the CLI uses. */
function snapshotZip(engine: ReturnType<typeof makeEngine>) {
  return writeZip(writeSnapshot(backendSnapshot(engine)).entries);
}

const NO_CRONS = new Map<string, number>();

/** A fresh, paused backend, like a new production database. */
function emptyTarget(...args: Parameters<typeof makeEngine>) {
  const engine = makeEngine(...args);
  engine.pauseIfNew();
  return engine;
}

describe("export JSON (Convex ConvexExportJSON) values", () => {
  it("writes float64 with a fraction and int64 bare, like Convex's exporter", () => {
    expect(formatExportJson(3)).toBe("3.0");
    expect(formatExportJson(-0)).toBe("-0.0");
    expect(formatExportJson(1.5)).toBe("1.5");
    expect(formatExportJson(1e21)).toBe("1e+21");
    expect(formatExportJson(3n)).toBe("3");
    expect(formatExportJson(Number.NaN)).toBe(JSON.stringify({ $float: "AAAAAAAA+H8=" }));
    expect(formatExportJson(new Uint8Array([1, 2, 3]).buffer)).toBe('{"$bytes":"AQID"}');
    expect(formatExportJson({ a: [1, "x", null, true], b: { c: 2n } })).toBe(
      '{"a":[1.0,"x",null,true],"b":{"c":2}}',
    );
    expect(() => formatExportJson(2n ** 63n)).toThrow(/int64 out of range/);
  });

  it("reads bare integers as int64 and fractional numbers as float64", () => {
    const parsed = parseExportJson(
      '{"i":7,"f":7.0,"neg":-0.0,"e":2.5e3,"big":{"$float":"AAAAAAAA8H8="}}',
    ) as Record<string, Value>;
    expect(parsed.i).toBe(7n);
    expect(parsed.f).toBe(7);
    expect(Object.is(parsed.neg, -0)).toBe(true);
    expect(parsed.e).toBe(2500);
    expect(parsed.big).toBe(Number.POSITIVE_INFINITY);
  });

  it("round-trips every value shape exactly", () => {
    const values: Value[] = [
      0,
      -0,
      3,
      1.25,
      -1e-7,
      1e21,
      Number.NaN,
      Number.NEGATIVE_INFINITY,
      0n,
      -(2n ** 63n),
      2n ** 63n - 1n,
      "",
      'é"\\\n',
      true,
      null,
      [],
      {},
      { nested: [{ deep: [1n, 2.5] }] },
    ];
    for (const value of values) {
      const again = parseExportJson(formatExportJson(value));
      if (typeof value === "number") expect(Object.is(again, value)).toBe(true);
      else expect(again).toEqual(value);
    }
    const bytes = parseExportJson(formatExportJson(new Uint8Array([9, 8, 7]).buffer));
    expect(new Uint8Array(bytes as ArrayBuffer)).toEqual(new Uint8Array([9, 8, 7]));
  });
});

describe("Convex snapshot ⇄ backup", () => {
  it("keeps ids, creation times, table numbers and the manifest through ZIP and back", async () => {
    const source = await seeded();
    const before = summarize(readState(source));
    const snapshot = readSnapshot(readZip(snapshotZip(source)), NO_CRONS);
    expect(mismatches({ manifest: before.manifest }, summarize(snapshot))).toEqual([]);
    expect(snapshot.tableNumbers.get("emptied")).toBe(before.manifest.emptied.tableNumber);

    const target = emptyTarget(schema, modules);
    const restored = await restore(target, parse([...serialize(snapshot)].join("").split("\n")));
    expect(mismatches(before, restored)).toEqual([]);
    await target.resume();
    expect(await target.runQuery("seed:count", {}, null)).toBe(2);
    // New documents keep minting IDs in the tables Convex numbered.
    const id = (await target.runMutation("seed:addUser", { name: "New" }, null)).value as string;
    expect(decodeDocumentId(id)?.tableNumber).toBe(before.manifest.users.tableNumber);
  });

  it("takes the cron cursors from the caller, since Convex cannot export them", async () => {
    const cursors = new Map([["generate daily puzzle at UTC midnight", 1792022400000]]);
    const snapshot = readSnapshot(readZip(snapshotZip(await seeded())), cursors);
    expect(summarize(snapshot).runtime).toMatchObject({
      cronCursors: { "generate daily puzzle at UTC midnight": 1792022400000 },
      scheduledFunctions: { count: 0 },
      mutationLog: { count: 0 },
    });
    const lines = [...serialize(snapshot)].join("");
    expect(lines).toContain(
      '{"cron":"generate daily puzzle at UTC midnight","lastOccurrence":1792022400000}',
    );
  });

  it("refuses to hand Convex scheduled functions that have not run, and says what it left out", async () => {
    const source = await seeded();
    await source.runMutation("seed:later", { delayMs: 60_000 }, null);
    source.fence();
    expect(() => writeSnapshot(backendSnapshot(source))).toThrow(
      /1 scheduled function\(s\) have not run \(seed:touch pending\)/,
    );

    // Once the job has run, only its history is left out.
    const settled = await seeded();
    await settled.runMutation("seed:later", { delayMs: 0 }, null, {
      dedupe: { session: "s", request: 1 },
    });
    const finished = backendSnapshot(settled);
    finished.scheduledFunctions = finished.scheduledFunctions.map((job) => ({
      ...job,
      state: { kind: "success" },
    }));
    finished.cronCursors.set("any", 1);
    const { entries, dropped } = writeSnapshot(finished);
    expect(dropped).toEqual({ finishedJobs: 1, cronCursors: 1, mutationLog: 1 });
    expect([...entries.keys()].filter((path) => path.startsWith("_"))).toEqual([
      "_tables/documents.jsonl",
    ]);
  });

  it("writes the layout npx convex import reads", async () => {
    const entries = readZip(snapshotZip(await seeded()));
    expect([...entries.keys()]).toEqual([
      "_tables/documents.jsonl",
      "users/documents.jsonl",
      "users/generated_schema.jsonl",
      "plays/documents.jsonl",
      "plays/generated_schema.jsonl",
      "emptied/documents.jsonl",
      "emptied/generated_schema.jsonl",
    ]);
    const decode = (path: string) => new TextDecoder().decode(entries.get(path));
    expect(decode("users/generated_schema.jsonl")).toBe('"uniform"\n');
    expect(decode("emptied/documents.jsonl")).toBe("");
    const tables = decode("_tables/documents.jsonl")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(tables.map((t: { name: string }) => t.name)).toEqual(["users", "plays", "emptied"]);
    const user = decode("users/documents.jsonl")
      .split("\n")
      .find((line) => line.includes("Ada"))!;
    expect(user).toContain('"streak":3.0');
    expect(user).toContain('"visits":9');
  });

  it("refuses snapshots this backend cannot hold", () => {
    const encode = (text: string) => new TextEncoder().encode(text);
    const base = () =>
      new Map([["_tables/documents.jsonl", encode('{"name":"users","id":10001}\n')]]);
    expect(() => readSnapshot(new Map(), NO_CRONS)).toThrow(/_tables/);
    expect(() =>
      readSnapshot(
        new Map([...base(), ["_storage/documents.jsonl", encode('{"_id":"x"}\n')]]),
        NO_CRONS,
      ),
    ).toThrow(/file storage/);
    expect(() =>
      readSnapshot(
        new Map([...base(), ["_components/x/users/documents.jsonl", encode("")]]),
        NO_CRONS,
      ),
    ).toThrow(/components/);
    expect(() =>
      readSnapshot(new Map([...base(), ["ghosts/documents.jsonl", encode("")]]), NO_CRONS),
    ).toThrow(/missing from/);
    expect(
      readSnapshot(new Map([...base(), ["_storage/documents.jsonl", encode("")]]), NO_CRONS)
        .documents.size,
    ).toBe(0);
  });

  it("detects a corrupted archive", async () => {
    const archive = snapshotZip(await seeded());
    const tampered = archive.slice();
    tampered[30 + "_tables/documents.jsonl".length + 3] ^= 0xff; // inside the first entry's data
    expect(() => readZip(tampered)).toThrow();
    expect(() => readZip(new Uint8Array(10))).toThrow(/Not a ZIP/);
  });

  // A genuine `npx convex export` (open-source backend precompiled-2026-10-06,
  // synthetic data): streamed entries with ZIP64 extra fields, float64 written
  // as "0.0", fractional _creationTime, empty tables listed in _tables.
  const genuine = new Uint8Array(
    Buffer.from(
      readFileSync(new URL("./fixtures/convex-export.zip.base64", import.meta.url), "utf8"),
      "base64",
    ),
  );

  it("reads a real Convex export and restores it under Chrondle's schema", async () => {
    const snapshot = readSnapshot(readZip(genuine), NO_CRONS);
    expect(Object.fromEntries(snapshot.tableNumbers)).toEqual({
      events: 10001,
      generation_logs: 10002,
      groupsPlays: 10003,
      groupsPuzzles: 10004,
      orderPlays: 10005,
      orderPuzzles: 10006,
      plays: 10007,
      puzzles: 10008,
      users: 10009,
    });
    const [user] = snapshot.documents.get("users")!;
    expect(user.clerkId).toBe("user_fixture_ada");
    expect(user.currentStreak).toBe(0); // "0.0" is float64, not int64
    expect(user._creationTime % 1).not.toBe(0);

    const engine = emptyTarget(chrondleSchema, {});
    const restored = await restore(engine, parse([...serialize(snapshot)].join("").split("\n")));
    expect(mismatches(summarize(snapshot), restored)).toEqual([]);
    expect(restored.manifest.events.count).toBe(6);

    // And back out as the archive npx convex import reads, unchanged.
    const again = readSnapshot(readZip(writeZip(writeSnapshot(snapshot).entries)), NO_CRONS);
    expect(mismatches(summarize(snapshot), summarize(again))).toEqual([]);
  });
});

describe("paused writes (one-writer maintenance)", () => {
  it("refuses mutations and actions, keeps queries, and survives a restart as stored state", async () => {
    const engine = await seeded();
    engine.fence();
    await expect(engine.runMutation("seed:addUser", { name: "Late" }, null)).rejects.toThrow(
      /paused/,
    );
    await expect(engine.runAction("seed:ping", {}, null)).rejects.toThrow(/paused/);
    expect(await engine.runQuery("seed:count", {}, null)).toBe(2);
    expect(engine.store.getMeta("writesPaused")).toBe("1");
    // Imports are how data arrives while paused.
    const restored = await restore(engine, backendSnapshot(engine));
    expect(restored.manifest.users.count).toBe(2);
    await engine.resume();
    await engine.runMutation("seed:addUser", { name: "Late" }, null);
    expect(await engine.runQuery("seed:count", {}, null)).toBe(3);
  });
});
