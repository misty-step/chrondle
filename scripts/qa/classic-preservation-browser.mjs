import { chromium, expect } from "@playwright/test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
const base = "http://localhost:43161";
const out = "/tmp/chrondle-361-browser";
const profile = await mkdtemp("/tmp/chrondle-361-profile-");
const evidence = { profile, steps: [], pageErrors: [], blocked: [] };
const ids = { A: "a".repeat(32), B: "b".repeat(32), C: "c".repeat(32) };
async function open() {
  const context = await chromium.launchPersistentContext(profile, { headless: true });
  await context.addCookies([
    { name: "__clerk_db_jwt", value: "synthetic-local-fixture", url: base },
    { name: "__client_uat", value: "0", url: base },
  ]);
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(url.hostname) && !url.pathname.startsWith("/ingest"))
      return route.continue();
    evidence.blocked.push(url.hostname + url.pathname);
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await context.routeWebSocket(/.*/, (ws) => {
    if (new URL(ws.url()).host !== "127.0.0.1:43162") throw new Error("Non-fixture socket refused");
    ws.connectToServer();
  });
  await context.addInitScript(() => {
    const clerk = {
      loaded: true,
      status: "ready",
      user: null,
      session: null,
      organization: null,
      telemetry: { record() {} },
      client: { sessions: [] },
      version: "synthetic",
      load: async () => {},
      addListener(fn) {
        fn({ user: null, session: null, organization: null, client: this.client });
        return () => {};
      },
      on(event, fn, options) {
        if (options?.notify) fn(event === "status" ? "ready" : "idle");
      },
      off() {},
      __unstable__updateProps() {},
      buildSignInUrl: () => "/sign-in",
      buildSignUpUrl: () => "/sign-up",
    };
    window.Clerk = new Proxy(clerk, {
      get(target, key) {
        return key in target ? target[key] : () => {};
      },
    });
  });
  context.on("page", (page) =>
    page.on("pageerror", (error) => evidence.pageErrors.push(error.message)),
  );
  return context;
}
async function pageFor(context, path, day = "21") {
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(`2026-10-${day}T12:00:00Z`));
  await page.goto(base + path);
  return page;
}
const input = (page, which) => page.getByRole("textbox", { name: `${which} year`, exact: true });
async function accept(page, hints) {
  await expect(input(page, "Start")).toBeEditable();
  for (let i = 0; i < hints; i++)
    await page.getByRole("button", { name: "Take hint", exact: true }).click();
  await input(page, "Start").fill("1990");
  await input(page, "End").fill("2010");
  await page.getByRole("button", { name: "Lock in range", exact: true }).click();
  await expect(page.getByTestId("results-focus-anchor")).toBeVisible();
}
async function saves(page) {
  return page.evaluate(() =>
    Object.entries(localStorage)
      .filter(([key]) => key.startsWith("chrondle-game-state"))
      .map(([, value]) => JSON.parse(value))
      .sort((a, b) => a.puzzleId.localeCompare(b.puzzleId)),
  );
}
async function verify(page, id, score, hints) {
  const state = (await saves(page)).find((state) => state.puzzleId === id);
  expect(state).toMatchObject({
    ranges: [{ start: 1990, end: 2010, score, hintsUsed: hints }],
    isComplete: true,
    hasWon: true,
  });
  await expect(page.getByTestId("results-focus-anchor")).toContainText(`${score} pts`);
  return state;
}
let context;
try {
  context = await open();
  const a = await pageFor(context, "/classic");
  const otherTab = await pageFor(context, "/classic");
  await expect(input(otherTab, "Start")).toBeEditable();
  await accept(a, 1);
  const saveA = await verify(a, ids.A, 84, 1);
  await expect(otherTab.getByTestId("results-focus-anchor")).toContainText("84 pts");
  evidence.steps.push(
    "A accepted with one hint; second tab observes completion through native storage event",
  );
  await a.goto(`${base}/archive/puzzle/41`);
  await accept(a, 2);
  const saveB = await verify(a, ids.B, 69, 2);
  await verify(otherTab, ids.A, 84, 1);
  await a.reload();
  await verify(a, ids.B, 69, 2);
  evidence.steps.push(
    "B accepted with two hints; A remains intact in second tab; B reload retains score and hint cost",
  );
  await context.close();
  context = await open();
  const restoredA = await pageFor(context, "/classic");
  await verify(restoredA, ids.A, 84, 1);
  const restoredB = await pageFor(context, "/archive/puzzle/41");
  await verify(restoredB, ids.B, 69, 2);
  expect((await saves(restoredA)).find((state) => state.puzzleId === ids.A)).toEqual(saveA);
  expect((await saves(restoredA)).find((state) => state.puzzleId === ids.B)).toEqual(saveB);
  const streakBefore = await restoredA.evaluate(() =>
    localStorage.getItem("chrondle-anonymous-streak"),
  );
  const next = await pageFor(context, "/classic", "22");
  await accept(next, 0);
  await verify(next, ids.C, 99, 0);
  const after = await saves(next);
  expect(after.find((state) => state.puzzleId === ids.A)).toEqual(saveA);
  expect(after.find((state) => state.puzzleId === ids.B)).toEqual(saveB);
  const streakAfterC = await next.evaluate(() => localStorage.getItem("chrondle-anonymous-streak"));
  await restoredA.clock.setFixedTime(new Date("2026-10-22T12:00:00Z"));
  await restoredA.goto(`${base}/archive/puzzle/42`);
  await verify(restoredA, ids.A, 84, 1);
  expect(await restoredA.evaluate(() => localStorage.getItem("chrondle-anonymous-streak"))).toBe(
    streakAfterC,
  );
  evidence.steps.push(
    "Browser process restarted with same synthetic profile; A/B restored exactly; next-day C retained both; restoring A did not change streak storage",
  );
  evidence.saves = after;
  evidence.streak = { before: streakBefore, afterC: streakAfterC };
  await mkdir(out, { recursive: true });
  await next.screenshot({ path: `${out}/next-day-C.png`, fullPage: true });
  // Separate legacy scenario within this disposable profile.
  await next.evaluate((legacy) => {
    localStorage.clear();
    localStorage.setItem("chrondle-game-state", JSON.stringify(legacy));
  }, saveA);
  const legacy = await pageFor(context, "/classic");
  await verify(legacy, ids.A, 84, 1);
  await legacy.goto(`${base}/archive/puzzle/41`);
  await accept(legacy, 2);
  await legacy.goto(`${base}/archive/puzzle/42`);
  await verify(legacy, ids.A, 84, 1);
  evidence.steps.push(
    "Legacy singleton restored, archive B accepted, legacy A restored without loss",
  );
  expect(evidence.pageErrors).toEqual([]);
  evidence.result = "PASS";
} catch (error) {
  evidence.result = "FAIL";
  evidence.error = String(error);
  throw error;
} finally {
  await context?.close();
  await mkdir(out, { recursive: true });
  await writeFile(`${out}/acceptance.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
}
