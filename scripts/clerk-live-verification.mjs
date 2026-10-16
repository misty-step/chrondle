// Bounded operator journey: only the newly created fleet verification identity.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function withVerificationUser({ key, run, fetchImpl = fetch, visit, observe = () => {} }) {
  assert.match(key ?? "", /^sk_live_[A-Za-z0-9_-]+$/);
  assert.match(run ?? "", /^\d+-\d+$/);
  const calls = [];
  async function request(method, path, body) {
    let response;
    try {
      response = await fetchImpl(`https://api.clerk.com/v1${path}`, {
        method, redirect: "error", signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { throw new Error("Clerk transport failed; raw error suppressed"); }
    const call = { method, operation: path.replace(/user_[A-Za-z0-9]+/g, "verification-user"), http: response.status };
    calls.push(call);
    observe(call);
    if (response.status === 404 && method === "GET") return null;
    if (!response.ok) throw new Error(`Clerk ${method} operation refused (HTTP ${response.status}); no raw provider body retained`);
    try { return await response.json(); }
    catch { throw new Error("Clerk response was not JSON; raw body suppressed"); }
  }
  const user = await request("POST", "/users", {
    email_address: [`chrondle-verify+${run}@mistystep.io`],
    skip_password_requirement: true,
    public_metadata: { fleet_verification_user: true, verification_run: run },
  });
  assert.match(user.id ?? "", /^user_[A-Za-z0-9]+$/);
  let deleted = false;
  try {
    const readback = await request("GET", `/users/${user.id}`);
    assert.equal(readback?.public_metadata?.fleet_verification_user, true);
    for (const returning of [false, true]) {
      const ticket = await request("POST", "/sign_in_tokens", { user_id: user.id, expires_in_seconds: 300 });
      assert.equal(typeof ticket.token, "string");
      assert.ok(ticket.token.length > 20);
      // Mask before handing the URL to the browser; never persist a ticket,
      // session, storageState, trace, HAR, or raw provider response as evidence.
      const ticketUrl = `https://www.chrondle.app/sign-in?__clerk_ticket=${encodeURIComponent(ticket.token)}&__clerk_status=sign_in`;
      if (process.env.GITHUB_ACTIONS === "true") {
        process.stdout.write(`::add-mask::${ticket.token}\n::add-mask::${ticketUrl}\n`);
      }
      await visit({ ticketUrl, returning, userId: user.id });
    }
  } finally {
    const deletion = await request("DELETE", `/users/${user.id}`);
    assert.equal(deletion.deleted, true);
    assert.equal(await request("GET", `/users/${user.id}`), null);
    deleted = true;
  }
  return { calls, verification_user_deleted_and_readback_404: deleted };
}

async function main() {
  const { chromium, expect } = await import("@playwright/test");
  const { ConvexHttpClient } = await import("convex/browser");
  const { anyApi } = await import("convex/server");
  const origin = "https://www.chrondle.app";
  const backend = process.env.NEXT_PUBLIC_CONVEX_URL;
  assert.ok(["https://fleet-goldfish-183.convex.cloud", "https://chrondle-backend.mistystep.io"].includes(backend));
  const out = "clerk-live-proof";
  await mkdir(out, { recursive: true });
  const report = { started_at: new Date().toISOString(), backend, journeys: [], provider_calls: [], result: "failed" };
  const browser = await chromium.launch({ headless: true });
  let firstAccount;
  let firstStats;
  let stage = "create-verification-user";
  try {
    const provider = await withVerificationUser({
      key: process.env.CLERK_SECRET_KEY,
      run: `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`,
      observe: (call) => report.provider_calls.push(call),
      visit: async ({ ticketUrl, returning, userId }) => {
        stage = returning ? "returning-sign-in" : "first-sign-in";
        const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, timezoneId: "UTC", colorScheme: returning ? "dark" : "light" });
        try {
          const page = await context.newPage();
          const sockets = [];
          let pageErrors = 0;
          page.on("pageerror", () => pageErrors++);
          page.on("websocket", (socket) => sockets.push(new URL(socket.url()).hostname));
          const response = await page.goto(ticketUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
          assert.equal(response.status(), 200);
          await page.waitForFunction(() => window.Clerk?.user?.id && window.Clerk?.session, null, { timeout: 60000 });
          assert.equal(await page.evaluate(() => window.Clerk.user.id), userId);
          // The ordinary live page's Clerk session issues the same configured
          // Convex JWT used by its provider. No injected issuer or JWT is used.
          const token = await page.evaluate(() => window.Clerk.session.getToken({ template: "convex" }));
          assert.equal(typeof token, "string");
          const client = new ConvexHttpClient(backend, { logger: false });
          client.setAuth(token);
          stage = returning ? "returning-account-readback" : "first-JIT-provisioning";
          await page.goto(`${origin}/classic`, { waitUntil: "domcontentloaded", timeout: 60000 });
          await expect.poll(async () => (await client.query(anyApi.users.getCurrentUser, {}))?.clerkId, { timeout: 45000 }).toBe(userId);
          const account = await client.query(anyApi.users.getCurrentUser, {});
          if (returning) {
            assert.equal(account._id, firstAccount);
            assert.deepEqual(await client.query(anyApi.users.getUserStats, {}), firstStats);
          } else {
            firstAccount = account._id;
            assert.equal(account.totalPlays, 0);
            assert.equal(account.currentStreak, 0);
            const start = page.getByRole("textbox", { name: "Start year" });
            const end = page.getByRole("textbox", { name: "End year" });
            await expect(start).toBeEditable({ timeout: 30000 });
            await start.fill("1900");
            await end.fill("1949x");
            await expect(page.getByRole("button", { name: /lock in range/i })).toBeDisabled();
            await end.fill("1949");
            await expect(page.getByText("50 years wide")).toBeVisible();
            await page.getByRole("button", { name: /lock in range/i }).click();
            await expect(page.getByTestId("results-focus-anchor")).toBeFocused({ timeout: 30000 });
            await expect.poll(async () => (await client.query(anyApi.users.getUserStats, {}))?.recentPlays?.length, { timeout: 30000 }).toBe(1);
            firstStats = await client.query(anyApi.users.getUserStats, {});
          }
          await page.screenshot({ path: `${out}/${returning ? "returning-dark" : "first-light"}-classic.png`, fullPage: true });
          stage = "server-rendered-settings";
          await page.goto(`${origin}/settings`, { waitUntil: "domcontentloaded", timeout: 60000 });
          await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible({ timeout: 30000 });
          assert.equal(new URL(page.url()).pathname, "/settings");
          await page.screenshot({ path: `${out}/${returning ? "returning-dark" : "first-light"}-settings.png`, fullPage: true });
          const anonymous = new ConvexHttpClient(backend, { logger: false });
          assert.equal(await anonymous.query(anyApi.users.getCurrentUser, {}), null);
          assert.equal(await anonymous.query(anyApi.users.getUserByClerkId, { clerkId: userId }), null);
          assert.deepEqual(await anonymous.query(anyApi.users.userExists, { clerkId: userId }), { exists: false });
          assert.ok(sockets.length > 0 && sockets.every((host) => host === new URL(backend).hostname));
          report.journeys.push({ returning, authenticated_with_live_Clerk: true, JIT_account_present: true,
            same_account_and_progress: returning ? true : null, persisted_classic_plays: firstStats.recentPlays.length,
            invalid_guess_refused: !returning, settings_rendered_with_session: true, anonymous_account_denied: true,
            backend_socket_hosts: [...new Set(sockets)], page_errors: pageErrors });
        } finally { await context.close(); }
      },
    });
    Object.assign(report, provider, { result: "passed" });
  } catch (error) {
    // Assertion/Playwright errors can contain tokens, URLs, emails and records.
    // Preserve the failing stage, not their message/stack or a failure trace.
    report.failure_stage = stage;
    report.error_class = error.constructor.name;
    if (/^Clerk /.test(error.message)) report.safe_error = error.message;
    process.exitCode = 1;
  } finally {
    await browser.close();
    report.finished_at = new Date().toISOString();
    await writeFile(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
