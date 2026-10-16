#!/usr/bin/env node
// Verify a running chrondle-backend with the real convex@1.45 clients.
//
//   node backend/scripts/verify-backend.mjs issuer <dir>
//       Create a synthetic RS256 issuer: <dir>/issuer.json (private, 0600) and
//       <dir>/providers.json, the backend's EXTRA_AUTH_PROVIDERS value (public
//       JWKS as a data URI). Preview/local only; production ignores it.
//   node backend/scripts/verify-backend.mjs check --url <backend> [--full <issuer dir>] [--out report.json]
//       Read-only checks are safe against production. --full also writes
//       synthetic data (local BACKEND_ADMIN_TOKEN, or the isolated preview's
//       CF_ACCESS_CLIENT_ID + CF_ACCESS_CLIENT_SECRET): sign-in, play, streaks,
//       invalid access, concurrency, exactly-once retry, scheduler delivery,
//       backup/restore, export/import, the pause barrier under concurrent
//       writes and a queued job carried through export/import.
import { generateKeyPairSync, createSign, createHash, randomUUID } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { anyApi as api } from "convex/server";
import { ConvexError } from "convex/values";

const [command, ...rest] = process.argv.slice(2);
const option = (name) => {
  const index = rest.indexOf(`--${name}`);
  return index === -1 ? undefined : rest[index + 1];
};

// ------------------------------------------------------------------ issuer

function createIssuer(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const issuer = `https://synthetic-issuer.chrondle.invalid/${randomUUID()}`;
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = {
    ...publicKey.export({ format: "jwk" }),
    kid: "synthetic-1",
    alg: "RS256",
    use: "sig",
  };
  const jwks = `data:text/plain;charset=utf-8;base64,${Buffer.from(JSON.stringify({ keys: [jwk] })).toString("base64")}`;
  const providers = [
    { type: "customJwt", issuer, jwks, algorithm: "RS256", applicationID: "convex" },
  ];
  writeFileSync(
    join(dir, "issuer.json"),
    JSON.stringify({ issuer, privateKey: privateKey.export({ format: "pem", type: "pkcs8" }) }),
    { mode: 0o600 },
  );
  chmodSync(join(dir, "issuer.json"), 0o600);
  writeFileSync(join(dir, "providers.json"), JSON.stringify(providers));
  console.log(`Synthetic issuer ${issuer}\nEXTRA_AUTH_PROVIDERS: ${join(dir, "providers.json")}`);
}

function signer(dir) {
  const { issuer, privateKey } = JSON.parse(readFileSync(join(dir, "issuer.json"), "utf8"));
  const b64 = (value) => Buffer.from(value).toString("base64url");
  return (claims) => {
    const now = Math.floor(Date.now() / 1000);
    const input = `${b64(JSON.stringify({ alg: "RS256", kid: "synthetic-1", typ: "JWT" }))}.${b64(
      JSON.stringify({ iss: issuer, aud: "convex", iat: now, exp: now + 600, ...claims }),
    )}`;
    return `${input}.${createSign("RSA-SHA256").update(input).sign(privateKey, "base64url")}`;
  };
}

// ------------------------------------------------------------------ checks

const results = [];
async function check(name, run) {
  const started = Date.now();
  try {
    const detail = await run();
    results.push({ name, ok: true, ms: Date.now() - started, detail: detail ?? null });
  } catch (error) {
    results.push({
      name,
      ok: false,
      ms: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  const last = results[results.length - 1];
  console.log(
    `${last.ok ? "PASS" : "FAIL"} ${name} (${last.ms}ms)${last.detail ? ` — ${JSON.stringify(last.detail)}` : ""}`,
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function eventually(read, predicate, label, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (predicate(value)) return value;
    if (Date.now() > deadline)
      throw new Error(`timed out waiting for ${label}; last ${JSON.stringify(value)}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const clients = [];
function connect(webSocketConstructor) {
  const client = new ConvexClient(url, {
    unsavedChangesWarning: false,
    ...(webSocketConstructor ? { webSocketConstructor } : {}),
  });
  clients.push(client);
  return client;
}

async function signIn(client, sign, claims) {
  const states = [];
  client.setAuth(
    async () => sign(claims),
    (authenticated) => states.push(authenticated),
  );
  await eventually(
    () => states,
    (seen) => seen.includes(true),
    "authentication",
  );
}

function watch(client, query, args) {
  const state = { value: undefined, updates: 0 };
  client.onUpdate(query, args, (value) => {
    state.value = value;
    state.updates++;
  });
  return state;
}

const url = option("url")?.replace(/\/$/, "");
const post = (path, body, headers = {}) =>
  fetch(`${url}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

async function readOnlyChecks() {
  await check("version endpoint identifies the backend", async () => {
    const body = await (await fetch(`${url}/_backend/version`)).json();
    assert(body.service === "chrondle-backend", `unexpected ${JSON.stringify(body)}`);
    return body;
  });
  await check("ConvexHttpClient public query", async () => {
    const puzzle = await new ConvexHttpClient(url).query(api.puzzles.getDailyPuzzle, {});
    return puzzle ? { puzzleNumber: puzzle.puzzleNumber, date: puzzle.date } : null;
  });
  await check("unknown function fails like Convex production (200, redacted)", async () => {
    const response = await post("/api/query", {
      path: "nonexistent:fn",
      format: "convex_encoded_json",
      args: [{}],
    });
    const body = await response.json();
    assert(
      response.status === 200 && body.status === "error",
      `got ${response.status} ${JSON.stringify(body)}`,
    );
    assert(
      /^\[Request ID: [0-9a-f]{16}\] Server Error$/.test(body.errorMessage) &&
        !("errorData" in body),
      JSON.stringify(body),
    );
  });
  await check("malformed token is 401 InvalidAuthHeader like Convex", async () => {
    const response = await post(
      "/api/query",
      { path: "puzzles:getTotalPuzzles", format: "convex_encoded_json", args: [{}] },
      { Authorization: "Bearer not.a.jwt" },
    );
    const body = await response.json();
    assert(
      response.status === 401 && body.code === "InvalidAuthHeader",
      `got ${response.status} ${JSON.stringify(body)}`,
    );
  });
  await check("CORS preflight reflects the app origin", async () => {
    const response = await fetch(`${url}/api/query`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://chrondle.app",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,convex-client",
      },
    });
    assert(
      response.headers.get("access-control-allow-origin") === "https://chrondle.app",
      "origin not reflected",
    );
    assert(
      response.headers.get("access-control-allow-credentials") === "true",
      "credentials not allowed",
    );
  });
  await check("ConvexClient WebSocket subscription delivers a result", async () => {
    const daily = watch(connect(), api.puzzles.getDailyPuzzle, {});
    await eventually(
      () => daily.updates,
      (count) => count > 0,
      "first query result",
    );
    return daily.value ? { puzzleNumber: daily.value.puzzleNumber } : null;
  });
  await check("admin API is invisible without the admin token", async () => {
    const response = await fetch(`${url}/_backend/admin/manifest`, { redirect: "manual" });
    const location = response.headers.get("location");
    const accessDenied =
      response.status === 302 &&
      location &&
      new URL(location).hostname.endsWith(".cloudflareaccess.com");
    assert(response.status === 404 || accessDenied, `got ${response.status}`);
  });
}

async function fullChecks(issuerDir) {
  const hostname = new URL(url).hostname;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  assert(
    local || url === "https://chrondle-backend-preview.mistystep.io",
    "--full writes synthetic data only to loopback or the isolated hosted preview",
  );
  const operatorHeaders = local
    ? { Authorization: `Bearer ${process.env.BACKEND_ADMIN_TOKEN ?? ""}` }
    : {
        "CF-Access-Client-ID": process.env.CF_ACCESS_CLIENT_ID ?? "",
        "CF-Access-Client-Secret": process.env.CF_ACCESS_CLIENT_SECRET ?? "",
      };
  assert(
    local
      ? process.env.BACKEND_ADMIN_TOKEN
      : process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET,
    "--full requires the local bearer or the isolated preview's named Access credentials",
  );
  const sign = signer(issuerDir);
  const admin = async (method, path, body) => {
    const response = await fetch(`${url}/_backend/admin${path}`, {
      method,
      headers: { ...operatorHeaders, "Content-Type": "application/json" },
      redirect: "error",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok)
      throw new Error(`admin ${path} -> ${response.status} ${JSON.stringify(json)}`);
    return json;
  };
  const run = (path, args = {}) =>
    admin("POST", "/run", { path, args }).then((result) => result.value);
  const nonce = randomUUID().slice(0, 8);
  let puzzle;

  await check("admin token is required and checked", async () => {
    const wrong = await fetch(`${url}/_backend/admin/manifest`, {
      headers: { Authorization: "Bearer wrong" },
      redirect: "manual",
    });
    assert(
      wrong.status === 404 || (!local && wrong.status === 302),
      `wrong token got ${wrong.status}`,
    );
    return { tables: Object.keys((await admin("GET", "/manifest")).manifest).length };
  });

  await check("seed synthetic events through the admin run API", async () => {
    for (const year of [1066, 1215]) {
      await run("events:importYearEvents", {
        year,
        events: Array.from({ length: 6 }, (_, i) => `Synthetic ${year} event ${i + 1}`),
      });
    }
    return (await run("events:getAvailableYears")).length;
  });

  await check("daily puzzle is created and pushed to a live subscription", async () => {
    const client = connect();
    const daily = watch(client, api.puzzles.getDailyPuzzle, {});
    await eventually(
      () => daily.updates,
      (count) => count > 0,
      "initial daily puzzle",
    );
    await client.mutation(api.puzzles.ensureTodaysPuzzle, {});
    puzzle = await eventually(
      () => daily.value,
      (value) => value?.date === new Date().toISOString().slice(0, 10),
      "pushed puzzle",
    );
    return { puzzleNumber: puzzle.puzzleNumber, date: puzzle.date, events: puzzle.events.length };
  });

  await check("sign in, play, persist guesses and update streak live", async () => {
    const client = connect();
    await signIn(client, sign, {
      sub: `user_play_${nonce}`,
      email: `play_${nonce}@example.invalid`,
    });
    const user = await client.mutation(api.users.getOrCreateCurrentUser, {});
    const me = watch(client, api.users.getCurrentUser, {});
    const play = watch(client, api.puzzles.getUserPlay, { puzzleId: puzzle._id, userId: user._id });
    const wrong = puzzle.targetYear === 1066 ? 1215 : 1066;
    assert(
      (await client.mutation(api.puzzles.submitGuess, { puzzleId: puzzle._id, guess: wrong }))
        .correct === false,
      "wrong guess accepted",
    );
    await eventually(
      () => play.value,
      (value) => value?.guesses?.length === 1,
      "first guess pushed",
    );
    assert(
      (
        await client.mutation(api.puzzles.submitGuess, {
          puzzleId: puzzle._id,
          guess: puzzle.targetYear,
        })
      ).correct,
      "right guess rejected",
    );
    const finished = await eventually(
      () => play.value,
      (value) => typeof value?.completedAt === "number",
      "completion pushed",
    );
    const stats = await eventually(
      () => me.value,
      (value) => value?.currentStreak === 1,
      "streak pushed",
    );
    return {
      guesses: finished.guesses.length,
      currentStreak: stats.currentStreak,
      lastCompletedDate: stats.lastCompletedDate,
    };
  });

  await check("invalid access is refused like Convex production", async () => {
    const client = connect();
    const internal = await client
      .mutation(api.events.importYearEvents, { year: 1, events: [] })
      .then(
        () => "allowed",
        (error) => error.message,
      );
    assert(/Server Error/.test(internal), `internal function reachable: ${internal}`);
    const anonymous = await client.mutation(api.users.getOrCreateCurrentUser, {}).then(
      () => "allowed",
      (error) => error.message,
    );
    assert(/Server Error/.test(anonymous), `anonymous write allowed: ${anonymous}`);
    await signIn(client, sign, { sub: `user_plain_${nonce}` });
    const forbidden = await client
      .query(api.admin.events.getEventStats, {})
      .catch((error) => error);
    assert(
      forbidden instanceof ConvexError && forbidden.data === "Forbidden: admin only",
      `admin query: ${forbidden}`,
    );
    const forged = connect();
    const states = [];
    forged.setAuth(
      async () => "not.a.jwt",
      (authenticated) => states.push(authenticated),
    );
    await eventually(
      () => states,
      (seen) => seen.includes(false),
      "forged token rejection",
    );
    return { internal, forbidden: forbidden.data };
  });

  await check("parallel sign-ins create exactly one user", async () => {
    const sessions = [connect(), connect(), connect()];
    for (const client of sessions) await signIn(client, sign, { sub: `user_race_${nonce}` });
    const users = await Promise.all(
      sessions.flatMap((client) =>
        Array.from({ length: 5 }, () => client.mutation(api.users.getOrCreateCurrentUser, {})),
      ),
    );
    const ids = new Set(users.map((user) => user._id));
    assert(ids.size === 1, `created ${ids.size} users`);
    return { calls: users.length, users: ids.size };
  });

  await check("a mutation whose response is lost is replayed and applied once", async () => {
    const sockets = new Set();
    let armed = false;
    let swallowed = 0;
    class FlakySocket extends WebSocket {
      constructor(target) {
        super(target);
        sockets.add(this);
      }
      set onmessage(handler) {
        super.onmessage = (event) => {
          if (armed && JSON.parse(event.data).type === "MutationResponse") {
            armed = false;
            swallowed++;
            for (const socket of sockets) socket.close();
            return;
          }
          handler(event);
        };
      }
    }
    const client = connect(FlakySocket);
    await signIn(client, sign, { sub: `user_retry_${nonce}` });
    const user = await client.mutation(api.users.getOrCreateCurrentUser, {});
    armed = true;
    const wrong = puzzle.targetYear === 1066 ? 1215 : 1066;
    const result = await client.mutation(api.puzzles.submitGuess, {
      puzzleId: puzzle._id,
      guess: wrong,
    });
    const play = await client.query(api.puzzles.getUserPlay, {
      puzzleId: puzzle._id,
      userId: user._id,
    });
    assert(swallowed === 1, "no response was dropped");
    assert(play.guesses.length === 1, `guess applied ${play.guesses.length} times`);
    return { result: result.guesses, stored: play.guesses };
  });

  await check("scheduled function is delivered by the backend", async () => {
    const status = await eventually(
      () => admin("GET", "/scheduler"),
      (value) =>
        value.recentJobs.some(
          (job) =>
            job.name === "actions/historicalContext:generateHistoricalContext" &&
            job.state.kind !== "pending" &&
            job.state.kind !== "inProgress",
        ),
      "historical context job to run",
      90_000,
    );
    const job = status.recentJobs.find(
      (candidate) => candidate.name === "actions/historicalContext:generateHistoricalContext",
    );
    return {
      state: job.state.kind,
      error: job.state.error ?? null,
      nextWake: status.nextWake && new Date(status.nextWake).toISOString(),
      crons: status.crons.length,
    };
  });

  const raw = (method, path, body) =>
    fetch(`${url}/_backend/admin${path}`, {
      method,
      headers: {
        ...operatorHeaders,
        "Content-Type": "application/json",
        ...(path === "/import"
          ? { "X-Backend-Sha256": createHash("sha256").update(body).digest("hex") }
          : {}),
      },
      body,
      redirect: "error",
    });
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const records = (ndjson) =>
    ndjson
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));

  await check("paused writes: backup → restore and export → import are lossless", async () => {
    const backup = await admin("POST", "/backup");
    const client = connect();
    await signIn(client, sign, { sub: `user_after_backup_${nonce}` });
    await client.mutation(api.users.getOrCreateCurrentUser, {});
    // Probe the owner's account through real auth, including after restore
    // removes its row. Operator invocation is not a public-query auth bypass.
    const reader = new ConvexHttpClient(url);
    reader.setAuth(sign({ sub: `user_after_backup_${nonce}` }));
    const exists = async () => (await reader.query(api.users.userExists, {})).exists;
    assert(await exists(), "post-backup user missing before restore");
    const live = await raw("POST", "/restore", JSON.stringify({ key: backup.key }));
    assert(live.status === 409, `restore with writes live got ${live.status}, want 409`);
    const liveExport = await raw("GET", "/export");
    assert(liveExport.status === 409, `export with writes live got ${liveExport.status}, want 409`);

    const paused = await admin("POST", "/pause", {});
    assert(paused.writes === "paused" && paused.settled, `pause: ${JSON.stringify(paused)}`);
    let refused = false;
    try {
      await client.mutation(api.users.getOrCreateCurrentUser, {});
    } catch {
      refused = true;
    }
    assert(refused, "a mutation was accepted while writes were paused");
    const restored = await admin("POST", "/restore", { key: backup.key });
    assert(restored.verified, `restore mismatches ${JSON.stringify(restored.mismatches)}`);
    const [before, exported] = [
      await admin("GET", "/manifest"),
      await (await raw("GET", "/export")).text(),
    ];
    const importResponse = await raw("POST", "/import", exported);
    const imported = await importResponse.json();
    assert(
      importResponse.ok && imported.verified,
      `import -> ${importResponse.status} ${JSON.stringify(imported)}`,
    );
    assert(
      JSON.stringify({ manifest: imported.manifest, runtime: imported.runtime }) ===
        JSON.stringify({ manifest: before.manifest, runtime: before.runtime }),
      "export → import changed the data or runtime state",
    );
    assert((await admin("POST", "/resume")).writes === "live", "resume did not stick");
    assert(!(await exists()), "post-backup user survived restore");
    await client.mutation(api.users.getOrCreateCurrentUser, {});
    assert(await exists(), "writes were not accepted after resume");
    return {
      key: backup.key,
      exportBytes: exported.length,
      tables: Object.fromEntries(
        Object.entries(restored.manifest).map(([table, summary]) => [table, summary.count]),
      ),
      jobs: restored.runtime.scheduledFunctions.states,
    };
  });

  await check(
    "pause is a barrier: every acknowledged write is exported, none lands after",
    async () => {
      const wrong = puzzle.targetYear === 1066 ? 1215 : 1066;
      const players = await Promise.all(
        [0, 1, 2, 3].map(async (i) => {
          const client = connect();
          await signIn(client, sign, { sub: `user_barrier_${nonce}_${i}` });
          const user = await client.mutation(api.users.getOrCreateCurrentUser, {});
          return { client, user, acknowledged: 0 };
        }),
      );
      // Every player keeps guessing while the pause is requested; each answer is recorded.
      let firstAcknowledged;
      const acknowledgedOnce = new Promise((resolve) => (firstAcknowledged = resolve));
      const playing = Promise.all(
        players.map(async (player) => {
          for (let k = 0; k < 5; k++) {
            try {
              await player.client.mutation(api.puzzles.submitGuess, {
                puzzleId: puzzle._id,
                guess: wrong,
              });
              player.acknowledged++;
              firstAcknowledged();
            } catch {
              return;
            }
          }
        }),
      );
      // Pause mid-stream: right after the first answer, with most guesses still to come.
      await acknowledgedOnce;
      const paused = await admin("POST", "/pause", {});
      await playing;
      const atPause = await (await raw("GET", "/export")).text();
      const guesses = new Map(
        records(atPause)
          .filter((record) => record.table === "plays" && record.document?.puzzleId === puzzle._id)
          .map((record) => [record.document.userId, (record.document.guesses ?? []).length]),
      );
      for (const { user, acknowledged } of players)
        assert(
          (guesses.get(user._id) ?? 0) === acknowledged,
          `player ${user._id}: ${acknowledged} acknowledged, ${guesses.get(user._id) ?? 0} stored`,
        );
      await sleep(2000);
      const later = await (await raw("GET", "/export")).text();
      assert(later === atPause, "state changed after the pause was acknowledged");
      return {
        settled: paused.settled,
        acknowledged: players.map((player) => player.acknowledged),
        refusedAfterPause: players.filter((player) => player.acknowledged < 5).length,
      };
    },
  );

  await check(
    "a queued job travels export → import, waits while paused, runs once after resume",
    async () => {
      // Writes are still paused from the barrier check.
      const lines = (await (await raw("GET", "/export")).text())
        .split("\n")
        .filter((l) => l.trim());
      const index = lines.findIndex((line) => line.startsWith('{"scheduledFunction":'));
      assert(index !== -1, "no scheduled function record to queue");
      // Re-queue an existing job record as a due-in-2s, idempotent puzzle generation.
      const queued = {
        ...JSON.parse(lines[index]).scheduledFunction,
        _creationTime: Date.now(),
        name: "puzzles:generateDailyPuzzle",
        args: [{ date: puzzle.date }],
        scheduledTime: Date.now() + 2000,
        state: { kind: "pending" },
      };
      for (const field of ["completedTime", "attempts", "retryAfter"]) delete queued[field];
      lines[index] = JSON.stringify({ scheduledFunction: queued });
      const response = await raw("POST", "/import", `${lines.join("\n")}\n`);
      const imported = await response.json();
      assert(
        response.ok && imported.verified,
        `import -> ${response.status} ${JSON.stringify(imported)}`,
      );
      const stateOf = async () =>
        (await admin("GET", "/scheduler")).recentJobs.find(
          (candidate) => candidate.id === queued._id,
        )?.state.kind;
      await sleep(4000);
      assert((await stateOf()) === "pending", `ran while paused: ${await stateOf()}`);
      await admin("POST", "/resume");
      const final = await eventually(stateOf, (state) => state === "success", "queued job to run");
      const status = await admin("GET", "/scheduler");
      return {
        job: queued._id,
        state: final,
        records: status.recentJobs.filter((candidate) => candidate.id === queued._id).length,
        writes: status.writes,
      };
    },
  );
}

// ------------------------------------------------------------------ main

if (command === "issuer" && rest[0]) {
  createIssuer(rest[0]);
} else if (command === "check" && url) {
  const started = new Date().toISOString();
  await readOnlyChecks();
  if (option("full")) await fullChecks(option("full"));
  await Promise.all(clients.map((client) => client.close()));
  const report = {
    url,
    started,
    finished: new Date().toISOString(),
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
  if (option("out")) writeFileSync(option("out"), JSON.stringify(report, null, 2));
  console.log(`${report.passed} passed, ${report.failed} failed`);
  process.exit(report.failed ? 1 : 0);
} else {
  console.error(
    "usage: verify-backend.mjs issuer <dir> | check --url <backend> [--full <issuer dir>] [--out <file>]",
  );
  process.exit(2);
}
