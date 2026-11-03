#!/usr/bin/env node
// chrondle-verify: drive the real chrondle web app the way a player does and
// write evidence. See ../SKILL.md for the contract; run from the repo root:
//
//   node .agents/skills/chrondle-verify/scripts/chrondle-verify.mjs <command> [options]
//
// Commands: doctor | daily | order | streak | states | sign-in | all
// Options:  --base <url>   app origin (default https://www.chrondle.app)
//           --out <dir>    evidence dir (default ~/.cache/tmp/chrondle-verify/<UTC date>)
//           --headed       show the browser
//
// Production rule: anonymous play never writes the backend (submits need a
// signed-in user), so daily/order/streak/states are safe on production. The
// signed-in owner context only reads: it never submits a guess. Every browser
// context proxies the backend socket and drops any Convex mutation or action
// outside an allowlist before it leaves the machine; analytics are blocked.
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";

const OWNER_EMAIL = "phraznikov@gmail.com";
const OWNER_CODE_SENDER = "chrondle.app"; // Clerk prod mails from noreply@chrondle.app
const FASTMAIL_SESSION = "https://api.fastmail.com/jmap/session";
// Clerk production domain cname_targets / dns_targets (Clerk Backend API GET /v1/domains).
// Without the mail records Clerk says "code sent" and nothing arrives.
const CLERK_DNS = {
  "clerk.chrondle.app": "frontend-api.clerk.services",
  "accounts.chrondle.app": "accounts.clerk.services",
  "clkmail.chrondle.app": "mail.h8zn0um1i4rl.clerk.services",
  "clk._domainkey.chrondle.app": "dkim1.h8zn0um1i4rl.clerk.services",
  "clk2._domainkey.chrondle.app": "dkim2.h8zn0um1i4rl.clerk.services",
};

// Every answer year the app received this run (any object carrying
// targetYear, dated or not, e.g. the admin dashboard's); snap() redacts them.
const ANSWERS = new Set();

const args = process.argv.slice(2);
const VALUED = new Set(["--base", "--out"]);
const command = args.find((a, i) => !a.startsWith("--") && !VALUED.has(args[i - 1])) ?? "help";
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const BASE = opt("base", "https://www.chrondle.app").replace(/\/$/, "");
const OUT = opt(
  "out",
  join(homedir(), ".cache/tmp/chrondle-verify", new Date().toISOString().slice(0, 10)),
);
const HEADED = args.includes("--headed");
const IS_PROD = /(^|\.)chrondle\.app$/.test(new URL(BASE).hostname);
const BACKEND_SOCKET = /chrondle-backend|convex\.cloud/;

// Mutations an agent run may cause. Anything else from a verify context fails
// the run: on production it would be a write the skill does not allow.
const ALLOWED_MUTATIONS = {
  anonymous: new Set(["puzzles:ensurePuzzleForDate", "orderPuzzles:ensureOrderPuzzleForDate"]),
  owner: new Set([
    "puzzles:ensurePuzzleForDate",
    "orderPuzzles:ensureOrderPuzzleForDate",
    "users:getOrCreateCurrentUser",
  ]),
};

function localDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

class Transcript {
  constructor(feature) {
    this.feature = feature;
    this.report = {
      feature,
      base: BASE,
      started_at: new Date().toISOString(),
      steps: [],
      result: "failed",
    };
  }
  step(action, result, extra = {}) {
    const s = { at: new Date().toISOString(), action, result, ...extra };
    this.report.steps.push(s);
    console.log(`[${this.feature}] ${action} -> ${result}`);
  }
  async finish(ok, error) {
    this.report.result = ok ? "passed" : "failed";
    if (error)
      this.report.error = String(error.message ?? error)
        .split("\n")[0]
        .slice(0, 300);
    this.report.finished_at = new Date().toISOString();
    await writeFile(join(OUT, `${this.feature}.json`), `${JSON.stringify(this.report, null, 2)}\n`);
    console.log(
      `[${this.feature}] ${this.report.result.toUpperCase()} -> ${join(OUT, `${this.feature}.json`)}`,
    );
    return ok;
  }
}

async function newContext(browser, kind, contextOptions = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ...contextOptions,
  });
  const record = {
    kind,
    mutations: [],
    blocked: [],
    sockets: 0,
    puzzles: new Map(),
    pageErrors: [],
  };
  // Synthetic plays must not reach production analytics.
  await context.route(/^https?:\/\/[^/]+\/ingest(\/|\?|$)|posthog\.com/, (r) => r.abort());
  // Proxy the backend socket: record every mutation/action and drop the ones
  // the allowlist does not cover, so a disallowed write never reaches the server.
  const allowed = ALLOWED_MUTATIONS[kind];
  await context.routeWebSocket(BACKEND_SOCKET, (ws) => {
    record.sockets += 1;
    const server = ws.connectToServer();
    ws.onMessage((message) => {
      const msg = parseFrame(message);
      if (msg && (msg.type === "Mutation" || msg.type === "Action")) {
        record.mutations.push(msg.udfPath);
        if (!allowed.has(msg.udfPath)) {
          record.blocked.push(msg.udfPath);
          return;
        }
      }
      server.send(message);
    });
    server.onMessage((message) => {
      const msg = parseFrame(message);
      if (msg) collectPuzzles(msg, record.puzzles);
      ws.send(message);
    });
  });
  context.on("page", (page) =>
    page.on("pageerror", (e) => record.pageErrors.push(String(e.message).slice(0, 200))),
  );
  return { context, record };
}

function parseFrame(message) {
  try {
    return JSON.parse(String(message));
  } catch {
    return null;
  }
}

// Test-side knowledge only: the puzzle objects the app itself received over its
// own backend socket. Nothing here adds an answer surface to the product.
function collectPuzzles(node, into) {
  if (!node || typeof node !== "object") return;
  if (typeof node.targetYear === "number") {
    ANSWERS.add(node.targetYear);
    if (typeof node.date === "string") into.set(node.date, node);
  }
  for (const v of Object.values(node)) collectPuzzles(v, into);
}

// Runs after every journey, pass or fail. Returns an error if the page tried a
// write outside the allowlist (the proxy already dropped it).
function checkWrites(record, t) {
  const sent = [...new Set(record.mutations)];
  const blocked = [...new Set(record.blocked)];
  const result = blocked.length
    ? `BLOCKED disallowed: ${blocked.join(", ")}`
    : record.sockets === 0
      ? "no backend socket observed"
      : `only allowed (${sent.join(", ") || "none"})`;
  t.step("check backend writes", result, {
    backend_sockets: record.sockets,
    mutations_sent: sent,
    mutations_blocked: blocked,
  });
  return blocked.length
    ? new Error(`page attempted disallowed writes: ${blocked.join(", ")}`)
    : null;
}

// Wraps a journey: the write check runs in every outcome.
async function journey(t, record, context, body) {
  let failure = null;
  try {
    await body();
  } catch (e) {
    failure = e;
  }
  try {
    const writes = checkWrites(record, t);
    failure ??= writes;
    return await t.finish(!failure, failure ?? undefined);
  } finally {
    await context.close();
  }
}

async function snap(page, name, { clip, ariaRoot } = {}) {
  // Evidence is public: never show a puzzle's answer. Mask every element that
  // shows a year the app received as an answer, and scrub the year and its era
  // from the ARIA text.
  const years = [...ANSWERS].map((y) => String(Math.abs(y)));
  const pattern = years.length ? new RegExp(`\\b(${years.join("|")})\\b`) : null;
  const mask = pattern ? [page.getByText(pattern)] : [];
  await page.screenshot({ path: join(OUT, `${name}.png`), mask, maskColor: "#888", clip });
  let aria = await (ariaRoot ?? page.locator("body")).ariaSnapshot().catch(() => "");
  if (pattern)
    aria = aria.replace(
      new RegExp(`-?\\b(${years.join("|")})\\b(\\s*(BCE|BC|CE|AD)\\b)?`, "g"),
      "[answer]",
    );
  await writeFile(join(OUT, `${name}.aria.txt`), aria);
  return [`${name}.png`, `${name}.aria.txt`];
}

async function headerPuzzleNumber(page) {
  const label = page.locator('header [aria-label^="Puzzle "]').first();
  await expect(label).toBeVisible({ timeout: 45000 });
  return Number((await label.getAttribute("aria-label")).replace(/\D/g, ""));
}

async function galleryNumber(page, mode) {
  const card = page.getByRole("button", { name: new RegExp(mode, "i") });
  await expect(card.getByText(/Puzzle #\d+/)).toBeVisible({ timeout: 45000 });
  return Number((await card.getByText(/Puzzle #\d+/).textContent()).match(/#(\d+)/)[1]);
}

async function waitForPuzzle(record, date, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (record.puzzles.has(date)) return record.puzzles.get(date);
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`app never received the puzzle for ${date}`);
}

async function winClassic(page, targetYear) {
  const start = page.getByRole("textbox", { name: "Start year" });
  const end = page.getByRole("textbox", { name: "End year" });
  await expect(start).toBeEditable({ timeout: 30000 });
  const era = targetYear < 0 ? /BC/i : /AD/i;
  const year = String(Math.abs(targetYear));
  for (const [input, group] of [
    [start, "Start year era"],
    [end, "End year era"],
  ]) {
    await input.clear();
    await input.fill(year);
    await page.getByRole("radiogroup", { name: group }).getByRole("radio", { name: era }).click();
    await input.blur();
  }
  const submit = page.getByRole("button", { name: /lock in|submit range/i });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByTestId("results-focus-anchor")).toBeFocused({ timeout: 30000 });
}

// ---------------------------------------------------------------- doctor

async function doctor() {
  const t = new Transcript("doctor");
  const problems = [];
  const check = async (name, fn) => {
    try {
      const r = await fn();
      t.step(name, `ok: ${r}`);
    } catch (e) {
      problems.push(name);
      t.step(name, `FAIL: ${String(e.message ?? e).slice(0, 200)}`);
    }
  };
  await check("app origin answers", async () => {
    const r = await fetch(`${BASE}/`, { redirect: "manual" });
    if (r.status !== 200) throw new Error(`GET / -> ${r.status}`);
    return `GET ${BASE}/ 200`;
  });
  await check("health endpoint", async () => {
    const r = await fetch(`${BASE}/api/health`);
    if (!r.ok) throw new Error(`GET /api/health -> ${r.status}`);
    return "GET /api/health 200";
  });
  await check("owner-only routes gated", async () => {
    for (const p of ["/settings", "/admin/dashboard"]) {
      const r = await fetch(`${BASE}${p}`, { redirect: "manual" });
      const loc = r.headers.get("location") ?? "";
      if (![302, 303, 307, 308].includes(r.status) || !loc.includes("/sign-in"))
        throw new Error(`${p} -> ${r.status} ${loc}`);
    }
    return "/settings and /admin/dashboard redirect signed-out visitors to /sign-in";
  });
  if (IS_PROD) {
    await check("Clerk DNS records (sign-in and code email delivery)", async () => {
      const bad = [];
      for (const [host, target] of Object.entries(CLERK_DNS)) {
        const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${host}&type=CNAME`, {
          headers: { accept: "application/dns-json" },
        });
        const got = ((await r.json()).Answer ?? []).map((a) => a.data.replace(/\.$/, ""));
        if (!got.includes(target))
          bad.push(`${host} -> ${got.join(",") || "missing"} (want ${target})`);
      }
      if (bad.length) throw new Error(bad.join("; "));
      return `all ${Object.keys(CLERK_DNS).length} Clerk CNAMEs resolve to their targets`;
    });
    await check("Clerk production instance accepts owner email-code sign-in", async () => {
      const env = await (await fetch("https://clerk.chrondle.app/v1/environment")).json();
      const email = env.user_settings?.attributes?.email_address ?? {};
      if (env.display_config?.instance_environment_type !== "production")
        throw new Error("Clerk instance is not production");
      if (!email.used_for_first_factor || !email.first_factors?.includes("email_code"))
        throw new Error(`email first factors: ${JSON.stringify(email.first_factors)}`);
      return `production instance; email first factors ${email.first_factors.join(",")}`;
    });
  }
  await check("browser launches and app reaches its backend", async () => {
    const browser = await chromium.launch({ headless: !HEADED });
    try {
      const { context, record } = await newContext(browser, "anonymous");
      const page = await context.newPage();
      await page.goto(`${BASE}/classic`);
      const n = await headerPuzzleNumber(page);
      if (record.sockets === 0) throw new Error("no backend socket opened");
      const today = localDate(new Date());
      const puzzle = await waitForPuzzle(record, today);
      if (puzzle.puzzleNumber !== n)
        throw new Error(`header #${n} but backend sent #${puzzle.puzzleNumber}`);
      return `/classic shows today's puzzle #${n} (${today}) from the live backend`;
    } finally {
      await browser.close();
    }
  });
  if (process.env.CLERK_SECRET_KEY) {
    await check("owner identity configured (Clerk)", async () => {
      const r = await fetch(
        `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(OWNER_EMAIL)}`,
        { headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` } },
      );
      if (!r.ok) throw new Error(`Clerk users lookup -> ${r.status}`);
      const users = await r.json();
      if (users.length !== 1) throw new Error(`${users.length} Clerk users have ${OWNER_EMAIL}`);
      const meta = users[0].public_metadata ?? {};
      const admin =
        meta.role === "admin" || (Array.isArray(meta.roles) && meta.roles.includes("admin"));
      if (!admin) throw new Error(`${OWNER_EMAIL} lacks publicMetadata.role "admin"`);
      return `${OWNER_EMAIL} is the single Clerk user with that email and has role admin`;
    });
  } else {
    t.step(
      "owner identity configured (Clerk)",
      "skipped: CLERK_SECRET_KEY unset (see SKILL.md Doctor)",
    );
  }
  if (process.env.FASTMAIL_API_TOKEN) {
    await check("owner inbox reachable (sign-in)", async () => {
      await jmapSession();
      return `JMAP session ok for the Fastmail account that receives ${OWNER_EMAIL}`;
    });
  } else {
    t.step(
      "owner inbox reachable (sign-in)",
      "skipped: FASTMAIL_API_TOKEN unset; sign-in needs it (see SKILL.md)",
    );
  }
  const ok = problems.length === 0;
  return t.finish(ok, ok ? undefined : new Error(`failed checks: ${problems.join("; ")}`));
}

// ---------------------------------------------------------------- daily (Classic)

async function daily(browser) {
  const t = new Transcript("daily-puzzle");
  const { context, record } = await newContext(browser, "anonymous");
  return journey(t, record, context, async () => {
    const page = await context.newPage();
    await page.goto(`${BASE}/?all=1`);
    const gallery = await galleryNumber(page, "Classic");
    t.step("open gallery /?all=1", `Classic card shows Puzzle #${gallery}`);
    await page.getByRole("button", { name: /classic/i }).click();
    await page.waitForURL(/\/classic/);
    const header = await headerPuzzleNumber(page);
    t.step("choose Classic card", `/classic header shows #${header}`);
    if (header !== gallery) throw new Error(`gallery #${gallery} != header #${header}`);
    const today = localDate(new Date());
    const puzzle = await waitForPuzzle(record, today);
    t.step(
      "puzzle resolved by local date",
      `${today} -> #${puzzle.puzzleNumber}, ${puzzle.events?.length ?? "?"} events`,
    );
    if (puzzle.puzzleNumber !== header)
      throw new Error("backend puzzle number differs from header");
    t.step("capture pre-guess board", "screenshot", { files: await snap(page, "daily-before") });

    const start = page.getByRole("textbox", { name: "Start year" });
    const end = page.getByRole("textbox", { name: "End year" });
    await expect(start).toBeEditable({ timeout: 30000 });
    await start.fill("1900");
    await end.fill("1949x");
    await expect(page.getByRole("button", { name: /lock in range/i })).toBeDisabled();
    t.step("type invalid end year 1949x", "Lock in range disabled");
    await end.fill("1949");
    await expect(page.getByText("50 years wide")).toBeVisible();
    await expect(page.getByRole("button", { name: /lock in range/i })).toBeEnabled();
    t.step("type range 1900-1949", "live width '50 years wide' shown; Lock in range enabled");

    await winClassic(page, puzzle.targetYear);
    t.step("lock in a one-year range containing the answer", "results panel focused");
    const hook = page.getByLabel("Come back tomorrow");
    await expect(hook).toBeVisible({ timeout: 20000 });
    await expect(hook).toContainText(/new puzzle in/i);
    t.step("read completion", "'Come back tomorrow' return hook with countdown visible");
    await expect(page.getByLabel(/current streak: 1 day/i).first()).toBeVisible();
    t.step("read streak", "anonymous streak shows 1 day");
    t.step("capture completed board", "screenshot", { files: await snap(page, "daily-after") });
  });
}

// ---------------------------------------------------------------- order

async function order(browser) {
  const t = new Transcript("order-puzzle");
  const { context, record } = await newContext(browser, "anonymous");
  return journey(t, record, context, async () => {
    const page = await context.newPage();
    await page.goto(`${BASE}/?all=1`);
    const gallery = await galleryNumber(page, "Order");
    t.step("open gallery /?all=1", `Order card shows Puzzle #${gallery}`);
    await page.getByRole("button", { name: /order/i }).click();
    await page.waitForURL(/\/order/);
    const header = await headerPuzzleNumber(page);
    t.step("choose Order card", `/order header shows #${header}`);
    if (header !== gallery) throw new Error(`gallery #${gallery} != header #${header}`);
    const items = page.getByRole("list").locator("li");
    await expect(items.first()).toBeVisible({ timeout: 30000 });
    const count = await items.count();
    const moved = await items.nth(0).locator("p").first().innerText();
    const down = items.nth(0).getByRole("button", { name: /move .* down/i });
    await down.focus();
    await page.keyboard.press("Enter");
    await expect(items.nth(1).locator("p").first()).toHaveText(moved);
    await expect(page.locator('[aria-live="polite"]')).toContainText(/moved to position 2 of/i);
    t.step(
      `move first of ${count} events down with the keyboard stepper`,
      "event now at position 2; live region announced it",
    );
    t.step("capture board", "screenshot", { files: await snap(page, "order") });
  });
}

// ---------------------------------------------------------------- streak (anonymous, clock-shifted)

async function streak(browser) {
  const t = new Transcript("streak");
  const { context, record } = await newContext(browser, "anonymous");
  return journey(t, record, context, async () => {
    const page = await context.newPage();
    // Only past dates: their puzzles already exist, so no generation is
    // triggered (the backend generates at most yesterday..tomorrow UTC).
    const at = (daysAgo) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      d.setHours(12, 0, 0, 0);
      return d;
    };
    const [day1, day2, today] = [at(3), at(2), at(0)];
    const streakInHeader = page.locator('header [aria-label^="Current streak"]');

    await page.clock.install({ time: day1 });
    await page.goto(`${BASE}/classic`);
    const p1 = await waitForPuzzle(record, localDate(day1));
    await winClassic(page, p1.targetYear);
    await expect(page.getByLabel(/current streak: 1 day/i).first()).toBeVisible();
    t.step(
      `browser clock at ${localDate(day1)} noon; win that day's puzzle #${p1.puzzleNumber}`,
      "streak shows 1 day",
    );

    await page.clock.setSystemTime(day2);
    await page.goto(`${BASE}/classic`);
    const p2 = await waitForPuzzle(record, localDate(day2));
    await winClassic(page, p2.targetYear);
    await expect(page.getByLabel(/current streak: 2 day/i).first()).toBeVisible();
    t.step(
      `clock to ${localDate(day2)} noon (next day); win puzzle #${p2.puzzleNumber}`,
      "streak shows 2 days",
    );
    await expect(page.getByLabel("Come back tomorrow")).toContainText(/make it 3/i);
    t.step("read return hook", "stake reads 'make it 3'");
    t.step("capture", "screenshot", { files: await snap(page, "streak-day2") });

    // Reload proves the streak persisted (browser storage), not just in memory.
    await page.reload();
    await expect(streakInHeader).toHaveAttribute("aria-label", /current streak: 2 day/i, {
      timeout: 30000,
    });
    t.step("reload /classic", "header still shows 2-day streak");

    // Missed day: return two days later, before playing. The header must not
    // keep advertising the broken streak.
    await page.clock.setSystemTime(today);
    await page.goto(`${BASE}/classic`);
    await headerPuzzleNumber(page);
    // Same view and handle that showed the streak after the reload above; wait
    // until the game is interactive (hydrated) plus a settle margin.
    await expect(page.getByRole("textbox", { name: "Start year" })).toBeEditable({
      timeout: 30000,
    });
    await page.waitForTimeout(5000);
    const shown = (await streakInHeader.count())
      ? await streakInHeader.first().getAttribute("aria-label")
      : "no streak";
    t.step(
      `clock to ${localDate(today)} (${localDate(at(1))} missed); open /classic before playing`,
      `header shows: ${shown}`,
    );
    t.step("capture missed day", "screenshot", { files: await snap(page, "streak-missed-day") });
    if (shown !== "no streak")
      throw new Error(`streak broken by a missed day, but header shows "${shown}"`);
  });
}

// ---------------------------------------------------------------- states that break

async function states(browser) {
  const t = new Transcript("states");
  let ok = true;
  const sub = async (name, fn) => {
    const { context, record } = await newContext(browser, "anonymous", fn.contextOptions);
    try {
      const page = await context.newPage();
      await fn(page, context, record);
    } catch (e) {
      ok = false;
      t.step(name, `FAIL: ${String(e.message).split("\n")[0].slice(0, 200)}`);
    } finally {
      if (checkWrites(record, t)) ok = false;
      await context.close();
    }
  };

  await sub("signed-out", async (page) => {
    for (const p of ["/settings", "/admin/dashboard"]) {
      await page.goto(`${BASE}${p}`);
      await page.waitForURL(/\/sign-in/, { timeout: 30000 });
      await expect(page.getByRole("button", { name: /continue/i }).first()).toBeVisible({
        timeout: 30000,
      });
      t.step(
        `signed out, open ${p}`,
        `redirected to ${new URL(page.url()).pathname}${new URL(page.url()).search}; sign-in form shown`,
      );
    }
    t.step("capture signed-out redirect", "screenshot", {
      files: await snap(page, "states-signed-out"),
    });
  });

  const mobile = async (page) => {
    await page.goto(`${BASE}/classic`);
    await headerPuzzleNumber(page);
    await expect(page.getByRole("textbox", { name: "Start year" })).toBeVisible({ timeout: 30000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    t.step(
      "390x844 phone, open /classic",
      `puzzle and range inputs visible; horizontal overflow ${overflow}px`,
    );
    t.step("capture mobile", "screenshot", { files: await snap(page, "states-mobile") });
    if (overflow > 1) throw new Error(`page overflows horizontally by ${overflow}px`);
  };
  mobile.contextOptions = {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  };
  await sub("mobile width", mobile);

  await sub("slow network", async (page, context) => {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 400,
      downloadThroughput: (400 * 1024) / 8,
      uploadThroughput: (400 * 1024) / 8,
    });
    const started = Date.now();
    await page.goto(`${BASE}/classic`, { timeout: 120000 });
    const n = await headerPuzzleNumber(page);
    await expect(page.getByRole("textbox", { name: "Start year" })).toBeEditable({
      timeout: 90000,
    });
    t.step(
      "400 kbps / 400 ms RTT, open /classic",
      `puzzle #${n} playable after ${Math.round((Date.now() - started) / 1000)}s`,
    );
  });

  await sub("backend down", async (page) => {
    // Page-level routes take precedence over the context's socket proxy.
    await page.routeWebSocket(BACKEND_SOCKET, (ws) => ws.close());
    await page.route(BACKEND_SOCKET, (route) => route.abort());
    await page.goto(`${BASE}/classic`);
    await page.waitForTimeout(15000);
    const body = await page.locator("body").innerText();
    const numbered = await page.locator('header [aria-label^="Puzzle "]').count();
    t.step(
      "backend socket refused, open /classic, wait 15s",
      `page alive (${body.length} chars of text); puzzle number shown: ${numbered > 0}`,
    );
    t.step("capture backend-down", "screenshot", {
      files: await snap(page, "states-backend-down"),
    });
    if (body.trim().length === 0) throw new Error("blank page with backend down");
    if (/Application error/i.test(body)) throw new Error("framework crash page with backend down");
    // The player must be told something is wrong, not shown a dead form.
    const told =
      /can.?t (reach|connect)|connection|offline|unavailable|try again|retry|reload/i.test(body);
    t.step(
      "look for a visible problem message",
      told ? "message shown" : "none: dead form with no clue and no explanation",
    );
    if (!told) throw new Error("backend down: no visible message, only an inert form");
  });

  await sub("empty data", async (page) => {
    await page.goto(`${BASE}/archive/puzzle/999999`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(20000);
    const body = await page.locator("body").innerText();
    t.step(
      "open archive puzzle #999999 (does not exist), wait 20s",
      body.slice(0, 160).replace(/\s+/g, " "),
    );
    t.step("capture missing puzzle", "screenshot", {
      files: await snap(page, "states-missing-puzzle"),
    });
    if (/Application error/i.test(body))
      throw new Error("framework crash page for a missing puzzle");
    if (/Loading puzzle/i.test(body))
      throw new Error("missing puzzle still shows 'Loading puzzle…' after 20s");
    if (!/not found|doesn.?t exist|no puzzle|404/i.test(body))
      throw new Error("missing puzzle shows no not-found state");
  });

  return t.finish(ok, ok ? undefined : new Error("one or more states failed; see steps"));
}

// ---------------------------------------------------------------- owner sign-in

async function jmapSession() {
  const r = await fetch(FASTMAIL_SESSION, {
    headers: { Authorization: `Bearer ${process.env.FASTMAIL_API_TOKEN}` },
  });
  if (!r.ok) throw new Error(`Fastmail JMAP session -> ${r.status}`);
  const s = await r.json();
  return { apiUrl: s.apiUrl, accountId: s.primaryAccounts["urn:ietf:params:jmap:mail"] };
}

// Newest Clerk code mailed to the owner after `since`. Returns { code, receivedAt }.
async function waitForOwnerCode(since, { exclude = new Set(), timeout = 180000 } = {}) {
  const { apiUrl, accountId } = await jmapSession();
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const r = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FASTMAIL_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
        methodCalls: [
          [
            "Email/query",
            {
              accountId,
              filter: { from: OWNER_CODE_SENDER, to: OWNER_EMAIL, after: since },
              sort: [{ property: "receivedAt", isAscending: false }],
              limit: 5,
            },
            "q",
          ],
          [
            "Email/get",
            {
              accountId,
              "#ids": { resultOf: "q", name: "Email/query", path: "/ids" },
              properties: ["subject", "receivedAt", "from"],
            },
            "g",
          ],
        ],
      }),
    });
    const list = (await r.json()).methodResponses?.[1]?.[1]?.list ?? [];
    for (const m of list) {
      const code = m.subject?.match(/\b(\d{6})\b/)?.[1];
      if (code && !exclude.has(code))
        return { code, receivedAt: m.receivedAt, from: m.from?.[0]?.email };
    }
    await new Promise((res) => setTimeout(res, 4000));
  }
  throw new Error(
    `no Clerk code for ${OWNER_EMAIL} reached the owner inbox within ${timeout / 1000}s`,
  );
}

async function requestCode(page) {
  await page.goto(`${BASE}/sign-in`);
  const email = page.getByLabel(/email address/i);
  await expect(email).toBeVisible({ timeout: 30000 });
  await email.fill(OWNER_EMAIL);
  const since = new Date(Date.now() - 5000).toISOString().replace(/\.\d+Z$/, "Z");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const codeInput = page.locator('input[name="code"], input[autocomplete="one-time-code"]').first();
  await expect(codeInput).toBeAttached({ timeout: 30000 });
  return { since, codeInput };
}

async function enterCode(page, codeInput, code) {
  await codeInput.focus();
  await page.keyboard.type(code, { delay: 60 });
}

async function signIn(browser) {
  const t = new Transcript("sign-in");
  if (!process.env.FASTMAIL_API_TOKEN) {
    t.step(
      "read owner inbox credential",
      "FASTMAIL_API_TOKEN unset; run under `pass-env run -e FASTMAIL_API_TOKEN=workstation/FASTMAIL_API_TOKEN --`",
    );
    return t.finish(false, new Error("owner inbox credential missing"));
  }
  // Fresh profile: no anonymous play state, so signing in merges nothing.
  const { context, record } = await newContext(browser, "owner");
  return journey(t, record, context, async () => {
    const page = await context.newPage();
    const { since, codeInput } = await requestCode(page);
    t.step(`open /sign-in, enter owner email, Continue`, "Clerk asks for an email code");

    await enterCode(page, codeInput, "000000");
    await expect(page.getByText(/incorrect|invalid|is incorrect/i).first()).toBeVisible({
      timeout: 20000,
    });
    t.step("wrong code 000000", "Clerk rejects it and stays on the code step");
    t.step("capture wrong code", "screenshot", { files: await snap(page, "sign-in-wrong-code") });

    const mail = await waitForOwnerCode(since);
    t.step(
      "read the code from the owner inbox (Fastmail JMAP)",
      `code arrived from ${mail.from} at ${mail.receivedAt} (value withheld)`,
    );
    await codeInput.fill("");
    await enterCode(page, codeInput, mail.code);
    await page.waitForFunction(() => window.Clerk?.user?.id && window.Clerk?.session, null, {
      timeout: 60000,
    });
    const who = await page.evaluate(() => ({
      email: window.Clerk.user.primaryEmailAddress?.emailAddress,
      role: window.Clerk.user.publicMetadata?.role ?? null,
      roles: window.Clerk.user.publicMetadata?.roles ?? null,
    }));
    const isOwner = who.email === OWNER_EMAIL;
    const isAdmin =
      who.role === "admin" || (Array.isArray(who.roles) && who.roles.includes("admin"));
    t.step(
      "enter the real code",
      `owner session: email matches owner ${isOwner}; admin role ${isAdmin}`,
    );
    if (!isOwner) throw new Error("session belongs to a different identity");

    await page.goto(`${BASE}/settings`);
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible({
      timeout: 45000,
    });
    t.step("open /settings (signed-in only)", "Settings heading renders, no redirect");

    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState("domcontentloaded");
    const path = new URL(page.url()).pathname;
    if (path !== "/admin/dashboard")
      throw new Error(`owner redirected from /admin/dashboard to ${page.url()}`);
    await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible({
      timeout: 45000,
    });
    t.step("open /admin/dashboard (owner-only)", "Admin Dashboard heading renders for the owner");
    // Heading band only: no avatar (header) and no puzzle data (below).
    t.step("capture owner-only page", "screenshot", {
      files: await snap(page, "sign-in-admin-dashboard", {
        clip: { x: 0, y: 64, width: 1280, height: 180 },
        ariaRoot: page.getByRole("heading", { name: "Admin Dashboard" }),
      }),
    });

    await page.goto(`${BASE}/classic`);
    await headerPuzzleNumber(page);
    await page.waitForTimeout(3000);
    const streakLabel = await page
      .locator('header [aria-label^="Current streak"]')
      .first()
      .getAttribute("aria-label")
      .catch(() => null);
    t.step(
      "open /classic as owner (read only, no guess)",
      streakLabel
        ? `header shows '${streakLabel}' from the owner's account`
        : "header shows no streak (owner streak is 0)",
    );

    // Sign out (ends the session server-side), then a new sign-in attempt must
    // refuse the code already spent.
    await page.evaluate(() => window.Clerk.signOut());
    await page.waitForFunction(() => !window.Clerk?.user, null, { timeout: 30000 });
    await context.clearCookies();
    const second = await requestCode(page);
    t.step("sign out via Clerk; new sign-in attempt", "Clerk sent a fresh code");
    await enterCode(page, second.codeInput, mail.code);
    await expect(page.getByText(/incorrect|invalid|is incorrect/i).first()).toBeVisible({
      timeout: 20000,
    });
    const stillOut = await page.evaluate(() => !window.Clerk?.user);
    t.step("enter the previously used code", `rejected; still signed out ${stillOut}`);
    if (!stillOut) throw new Error("reused code produced a session");
  });
}

// ---------------------------------------------------------------- main

const COMMANDS = { daily, order, streak, states, "sign-in": signIn };

async function main() {
  if (command === "help" || !(command in COMMANDS || command === "doctor" || command === "all")) {
    console.log(
      "usage: chrondle-verify.mjs <doctor|daily|order|streak|states|sign-in|all> [--base URL] [--out DIR] [--headed]",
    );
    process.exit(command === "help" ? 0 : 2);
  }
  await mkdir(OUT, { recursive: true });
  console.log(
    `chrondle-verify ${command} base=${BASE} out=${OUT}${IS_PROD ? " (production: read-only rules apply)" : ""}`,
  );
  if (command === "doctor") process.exit((await doctor()) ? 0 : 1);
  const browser = await chromium.launch({ headless: !HEADED });
  const results = {};
  try {
    const run = command === "all" ? ["daily", "order", "streak", "states", "sign-in"] : [command];
    for (const name of run) results[name] = await COMMANDS[name](browser);
  } finally {
    await browser.close();
  }
  if (command === "all")
    await writeFile(
      join(OUT, "summary.json"),
      `${JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2)}\n`,
    );
  const failed = Object.entries(results)
    .filter(([, ok]) => !ok)
    .map(([n]) => n);
  console.log(failed.length ? `FAILED: ${failed.join(", ")}` : "ALL PASSED");
  process.exit(failed.length ? 1 : 0);
}

await main();
