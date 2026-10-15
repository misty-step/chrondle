/**
 * The unmodified convex@1.45 clients against the Cloudflare host's protocol
 * layer (SyncSession / HTTP API) and the real Chrondle functions + schema.
 * Production mode: errors are redacted exactly like Convex production.
 */
import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schema from "../../convex/schema";
import { convexModules } from "../src/convexModules.gen";
import type { Engine } from "../src/engine/engine";
import { eventually, InProcessServer, makeEngine, syntheticIssuer } from "./support";

type Issuer = Awaited<ReturnType<typeof syntheticIssuer>>;
type AnyDoc = Record<string, any>;

const api = anyApi;
const YEARS = [1969, 1989];

let issuer: Issuer;
let engine: Engine;
let server: InProcessServer;
let clients: ConvexClient[] = [];

beforeEach(async () => {
  issuer = await syntheticIssuer();
  engine = makeEngine(schema, convexModules);
  server = new InProcessServer(engine, issuer.verifier());
});

afterEach(async () => {
  await Promise.all(clients.map((client) => client.close()));
  clients = [];
});

function connect(): ConvexClient {
  const client = new ConvexClient("https://backend.chrondle.test", { webSocketConstructor: server.WebSocket, unsavedChangesWarning: false });
  clients.push(client);
  return client;
}

async function signIn(client: ConvexClient, claims: Record<string, unknown>): Promise<void> {
  const states: boolean[] = [];
  client.setAuth(() => issuer.sign(claims), (authenticated) => states.push(authenticated));
  await eventually(() => states, (seen) => seen.includes(true));
}

function watch(client: ConvexClient, query: any, args: Record<string, unknown>) {
  const state = { value: undefined as any, error: undefined as Error | undefined, updates: 0 };
  client.onUpdate(
    query,
    args,
    (value) => {
      state.value = value;
      state.updates++;
    },
    (error) => {
      state.error = error;
    },
  );
  return state;
}

async function seedEvents() {
  for (const year of YEARS) {
    const events = Array.from({ length: 6 }, (_, i) => `Synthetic event ${i + 1} of ${year}`);
    await engine.runMutation("events:importYearEvents", { year, events }, null, { visibility: "internal" });
  }
}

const docs = (table: string) => [...engine.store.allDocuments(table)] as AnyDoc[];

async function playerWithPuzzle(client: ConvexClient, subject: string) {
  await seedEvents();
  await signIn(client, { sub: subject, email: `${subject}@example.test` });
  const user = await client.mutation(api.users.getOrCreateCurrentUser, {});
  await client.mutation(api.puzzles.ensureTodaysPuzzle, {});
  const puzzle = await client.query(api.puzzles.getDailyPuzzle, {});
  const wrong = YEARS.find((year) => year !== puzzle.targetYear)!;
  return { user, puzzle, wrong };
}

describe("ConvexClient over the sync protocol", () => {
  it("pushes the daily puzzle to subscribers when a mutation creates it", async () => {
    await seedEvents();
    const client = connect();
    const daily = watch(client, api.puzzles.getDailyPuzzle, {});
    await eventually(() => daily.updates, (count) => count >= 1);
    expect(daily.value).toBeNull();

    await client.mutation(api.puzzles.ensureTodaysPuzzle, {});

    const puzzle = await eventually(() => daily.value, (value) => value !== null);
    expect(puzzle.date).toBe(new Date().toISOString().slice(0, 10));
    expect(puzzle.puzzleNumber).toBe(1);
    expect(YEARS).toContain(puzzle.targetYear);
    expect(puzzle.events).toHaveLength(6);
    expect(puzzle._id).toMatch(/^[0-9a-z]{31,37}$/);
    // Generation schedules historical context exactly as on Convex.
    expect(docs("_scheduled_functions").map((job) => job.name)).toContain("actions/historicalContext:generateHistoricalContext");
  });

  it("signs a player in, persists guesses and completion, and updates streak stats live", async () => {
    const client = connect();
    const { user, puzzle, wrong } = await playerWithPuzzle(client, "user_synthetic_1");
    expect(user).toMatchObject({ clerkId: "user_synthetic_1", email: "user_synthetic_1@example.test", currentStreak: 0, totalPlays: 0 });

    const me = watch(client, api.users.getCurrentUser, {});
    const play = watch(client, api.puzzles.getUserPlay, { puzzleId: puzzle._id, userId: user._id });
    await eventually(() => me.value, (value) => value?._id === user._id);

    expect(await client.mutation(api.puzzles.submitGuess, { puzzleId: puzzle._id, guess: wrong })).toEqual({
      correct: false,
      guesses: [wrong],
      targetYear: puzzle.targetYear,
    });
    await eventually(() => play.value, (value) => value?.guesses?.length === 1);

    const winning = await client.mutation(api.puzzles.submitGuess, { puzzleId: puzzle._id, guess: puzzle.targetYear });
    expect(winning.correct).toBe(true);
    const finished = await eventually(() => play.value, (value) => typeof value?.completedAt === "number");
    expect(finished.guesses).toEqual([wrong, puzzle.targetYear]);
    const stats = await eventually(() => me.value, (value) => value?.currentStreak === 1);
    expect(stats).toMatchObject({ currentStreak: 1, longestStreak: 1, lastCompletedDate: puzzle.date });

    await expect(client.mutation(api.puzzles.submitGuess, { puzzleId: puzzle._id, guess: wrong })).rejects.toThrow(/Server Error/);
    expect(docs("plays")).toHaveLength(1);
  });

  it("rejects internal functions, anonymous writes and non-admins like Convex production", async () => {
    const client = connect();
    await expect(client.mutation(api.events.importYearEvents, { year: 1, events: [] })).rejects.toThrow(/^\[CONVEX M\(events:importYearEvents\)\] \[Request ID: [0-9a-f]{16}\] Server Error/);
    await expect(client.mutation(api.users.getOrCreateCurrentUser, {})).rejects.toThrow(/Server Error/);
    await expect(client.query(api.puzzles.getPuzzleById, { puzzleId: "not-an-id" })).rejects.toThrow(/Server Error/);

    const anonymous = await client.query(api.admin.events.getEventStats, {}).catch((error) => error);
    expect(anonymous).toBeInstanceOf(ConvexError);
    expect(anonymous.data).toBe("Unauthorized");

    await signIn(client, { sub: "user_plain" });
    const forbidden = await client.query(api.admin.events.getEventStats, {}).catch((error) => error);
    expect(forbidden).toBeInstanceOf(ConvexError);
    expect(forbidden.data).toBe("Forbidden: admin only");

    const admin = connect();
    await signIn(admin, { sub: "user_admin", public_metadata: { role: "admin" } });
    await expect(admin.query(api.admin.events.getEventStats, {})).resolves.toBeTypeOf("object");

    const forged = connect();
    const states: boolean[] = [];
    forged.setAuth(async () => "not.a.jwt", (authenticated) => states.push(authenticated));
    await eventually(() => states, (seen) => seen.includes(false));
    expect(docs("users")).toHaveLength(0);
  });

  it("serializes concurrent sign-ins: fifteen parallel getOrCreateCurrentUser calls make one user", async () => {
    const sessions = [connect(), connect(), connect()];
    for (const client of sessions) await signIn(client, { sub: "user_same", email: "same@example.test" });
    const results = await Promise.all(
      sessions.flatMap((client) => Array.from({ length: 5 }, () => client.mutation(api.users.getOrCreateCurrentUser, {}))),
    );
    expect(new Set(results.map((user) => user._id)).size).toBe(1);
    expect(docs("users")).toHaveLength(1);
  });

  it("replays a mutation whose response was lost after reconnecting, applying it exactly once", async () => {
    const client = connect();
    const { user, puzzle, wrong } = await playerWithPuzzle(client, "user_retry");
    let lost = 0;
    server.dropOutgoing = (message) => message.type === "MutationResponse" && lost++ === 0;

    const pending = client.mutation(api.puzzles.submitGuess, { puzzleId: puzzle._id, guess: wrong });
    await eventually(() => lost, (count) => count === 1);
    server.dropAll();

    expect(await pending).toEqual({ correct: false, guesses: [wrong], targetYear: puzzle.targetYear });
    const sent = server.fromClients.filter((message) => message.type === "Mutation" && message.udfPath === "puzzles:submitGuess");
    expect(sent).toHaveLength(2);
    expect(sent[1].requestId).toBe(sent[0].requestId);
    const play = await client.query(api.puzzles.getUserPlay, { puzzleId: puzzle._id, userId: user._id });
    expect(play.guesses).toEqual([wrong]);
  }, 20_000);

  it("queues a mutation made while offline and delivers it when the network returns", async () => {
    const client = connect();
    const { user, puzzle, wrong } = await playerWithPuzzle(client, "user_offline");
    server.offline = true;
    server.dropAll();

    const pending = client.mutation(api.puzzles.submitGuess, { puzzleId: puzzle._id, guess: wrong });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(server.fromClients.filter((message) => message.udfPath === "puzzles:submitGuess")).toHaveLength(0);

    server.offline = false;
    expect((await pending).guesses).toEqual([wrong]);
    const play = await client.query(api.puzzles.getUserPlay, { puzzleId: puzzle._id, userId: user._id });
    expect(play.guesses).toEqual([wrong]);
  }, 30_000);
});

describe("ConvexHttpClient over the HTTP API", () => {
  it("serves queries, mutations, auth and application errors", async () => {
    await seedEvents();
    const http = new ConvexHttpClient("https://backend.chrondle.test", { fetch: server.fetch });
    expect(await http.query(api.puzzles.getDailyPuzzle, {})).toBeNull();
    await http.mutation(api.puzzles.ensureTodaysPuzzle, {});
    expect((await http.query(api.puzzles.getDailyPuzzle, {})).puzzleNumber).toBe(1);

    await expect(http.mutation(api.users.getOrCreateCurrentUser, {})).rejects.toThrow(/Server Error/);
    http.setAuth(await issuer.sign({ sub: "user_http", email: "http@example.test" }));
    expect(await http.mutation(api.users.getOrCreateCurrentUser, {})).toMatchObject({ clerkId: "user_http" });

    const forbidden = await http.query(api.admin.events.getEventStats, {}).catch((error) => error);
    expect(forbidden).toBeInstanceOf(ConvexError);
    expect(forbidden.data).toBe("Forbidden: admin only");

    http.setAuth("not.a.jwt");
    await expect(http.query(api.puzzles.getDailyPuzzle, {})).rejects.toThrow(/InvalidAuthHeader/);
  });
});
