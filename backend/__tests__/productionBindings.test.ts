import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../scripts/production-bindings.mjs", import.meta.url));
const operator = JSON.stringify({
  issuer: "https://synthetic.cloudflareaccess.com",
  audience: "synthetic",
  identities: [{ kind: "machine", clientId: "synthetic-production-machine" }],
});
const settings = {
  STRIPE_SYNC_SECRET: "synthetic-production-sync-secret",
  OPENROUTER_API_KEY: "synthetic-provider",
  OPENAI_GPT5_ENABLED: "true",
};
function run(overrides: Record<string, string | undefined> = {}, args: string[] = []) {
  return spawnSync("node", [script, ...args], {
    env: {
      PATH: process.env.PATH,
      BACKEND_PRODUCTION_OPERATOR_ACCESS: operator,
      BACKEND_PRODUCTION_ENV: JSON.stringify(settings),
      ...overrides,
    },
    encoding: "utf8",
  });
}

describe("runtime-only production backend bindings", () => {
  it("preserves all integration values exactly and binds only the chosen operator", () => {
    const result = run({
      BACKEND_PREVIEW_OPERATOR_ACCESS: "wrong-preview",
      BACKEND_RESTORE_OPERATOR_ACCESS: "wrong-restore",
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({ ...settings, BACKEND_OPERATOR_ACCESS: operator });
  });

  it("preflight validates without emitting any payload", () => {
    const result = run({}, ["--check"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it.each([
    undefined,
    "",
    "not-json",
    "null",
    "[]",
    "{}",
    JSON.stringify({
      issuer: "http://synthetic.cloudflareaccess.com",
      audience: "synthetic",
      identities: [{ kind: "machine", clientId: "synthetic" }],
    }),
    JSON.stringify({
      issuer: "https://synthetic.invalid",
      audience: "synthetic",
      identities: [{ kind: "machine", clientId: "synthetic" }],
    }),
    JSON.stringify({
      issuer: "https://synthetic.cloudflareaccess.com",
      audience: "",
      identities: [{ kind: "machine", clientId: "synthetic" }],
    }),
    JSON.stringify({
      issuer: "https://synthetic.cloudflareaccess.com",
      audience: "synthetic",
      identities: [],
    }),
    JSON.stringify({
      issuer: "https://synthetic.cloudflareaccess.com",
      audience: "synthetic",
      identities: [{ kind: "human", email: "not-an-email" }],
    }),
  ])("rejects invalid operator %s without cross-environment fallback", (value) => {
    const result = run({
      BACKEND_PRODUCTION_OPERATOR_ACCESS: value,
      BACKEND_PREVIEW_OPERATOR_ACCESS: operator,
      BACKEND_RESTORE_OPERATOR_ACCESS: operator,
    });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("Invalid production backend bindings; no payload emitted\n");
  });

  it.each([{}, { STRIPE_SYNC_SECRET: "" }, { STRIPE_SYNC_SECRET: "short" }])(
    "refuses incomplete existing backend requirements without disclosing values",
    (incomplete) => {
      const result = run({
        BACKEND_PRODUCTION_ENV: JSON.stringify({
          OPENROUTER_API_KEY: "private-canary",
          ...incomplete,
        }),
      });
      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("Invalid production backend bindings; no payload emitted\n");
    },
  );

  it.each([
    undefined,
    "",
    "private-canary-not-json",
    "null",
    "[]",
    "{}",
    '{"OPENAI_GPT5_ENABLED":true}',
    '{"BAD-NAME":"private-canary"}',
  ])("rejects invalid integration map %s without disclosing it", (value) => {
    const result = run({ BACKEND_PRODUCTION_ENV: value });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("Invalid production backend bindings; no payload emitted\n");
  });

  it.each([
    "BACKEND",
    "BACKUPS",
    "ENVIRONMENT",
    "EXPOSE_ERRORS",
    "REVISION",
    "BACKEND_OPERATOR_ACCESS",
    "BACKEND_ADMIN_TOKEN",
    "EXTRA_AUTH_PROVIDERS",
  ])("refuses reserved binding %s before emitting anything", (name) => {
    const result = run({
      BACKEND_PRODUCTION_ENV: JSON.stringify({ ...settings, [name]: "private-canary" }),
    });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain("private-canary");
  });
});
