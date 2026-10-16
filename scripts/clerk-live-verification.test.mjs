// @vitest-environment node
import assert from "node:assert/strict";
import { withVerificationUser } from "./clerk-live-verification.mjs";
const { test } = process.env.VITEST ? await import("vitest") : await import("node:test");
const key = "sk_live_notarealkeycanary";
function provider(tokenStatus = 200) {
  let deleted = false;
  const calls = [];
  const fetchImpl = async (url, options) => {
    assert.equal(new URL(url).origin, "https://api.clerk.com");
    assert.equal(options.headers.Authorization, `Bearer ${key}`);
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    const path = new URL(url).pathname;
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ path, method: options.method, body });
    if (path === "/v1/users" && options.method === "POST") {
      assert.deepEqual(body, { email_address: ["chrondle-verify+123-1@mistystep.io"], skip_password_requirement: true,
        public_metadata: { fleet_verification_user: true, verification_run: "123-1" } });
      return Response.json({ id: "user_Verification" });
    }
    if (path === "/v1/users/user_Verification") {
      if (options.method === "DELETE") { deleted = true; return Response.json({ deleted: true }); }
      assert.equal(options.method, "GET");
      return deleted ? new Response("private-canary", { status: 404 }) : Response.json({ public_metadata: { fleet_verification_user: true } });
    }
    assert.equal(path, "/v1/sign_in_tokens");
    assert.equal(options.method, "POST");
    assert.deepEqual(body, { user_id: "user_Verification", expires_in_seconds: 300 });
    return Response.json(tokenStatus === 200 ? { token: "private-ticket-canary-not-a-real-token" } : { errors: [{ message: "private-canary" }] }, { status: tokenStatus });
  };
  return { fetchImpl, calls };
}
test("two short-lived tickets drive fresh sessions; deletes and reads back only its own user", async () => {
  const { fetchImpl, calls } = provider();
  const visits = [];
  const result = await withVerificationUser({ key, run: "123-1", fetchImpl, visit: async (args) => visits.push(args) });
  assert.deepEqual(visits.map((v) => v.returning), [false, true]);
  assert.ok(visits.every((v) => new URL(v.ticketUrl).origin === "https://www.chrondle.app"));
  assert.equal(calls.length, 6);
  assert.equal(result.verification_user_deleted_and_readback_404, true);
  assert.ok(!JSON.stringify(result).includes(key));
  assert.ok(!JSON.stringify(result).includes("private-ticket"));
  assert.ok(!JSON.stringify(result).includes("mistystep.io"));
});
test("browser failure still deletes the verification user and verifies absence", async () => {
  const { fetchImpl, calls } = provider();
  await assert.rejects(withVerificationUser({ key, run: "123-1", fetchImpl, visit: async () => { throw new Error("browser failed"); } }), /browser failed/);
  assert.deepEqual(calls.slice(-2).map((c) => c.method), ["DELETE", "GET"]);
});
test("disabled/refused sign-in tokens stop without retrying and clean up", async () => {
  const { fetchImpl, calls } = provider(403);
  await assert.rejects(withVerificationUser({ key, run: "123-1", fetchImpl, visit: async () => assert.fail("must not visit") }), (e) => e.message.includes("HTTP 403") && !e.message.includes("private-canary"));
  assert.equal(calls.filter((c) => c.path === "/v1/sign_in_tokens").length, 1);
  assert.deepEqual(calls.slice(-2).map((c) => c.method), ["DELETE", "GET"]);
});
test("wrong key or run fails before any third-party request", async () => {
  let calls = 0;
  for (const args of [{ key: "sk_test_wrong", run: "123-1" }, { key, run: "not-a-run" }]) {
    await assert.rejects(withVerificationUser({ ...args, fetchImpl: async () => calls++, visit: async () => {} }));
  }
  assert.equal(calls, 0);
});
test("transport failures never echo response content or credentials", async () => {
  await assert.rejects(withVerificationUser({ key, run: "123-1", fetchImpl: async () => { throw new Error(key); }, visit: async () => {} }), (e) => !e.message.includes(key));
});
