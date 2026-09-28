// @vitest-environment node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, test, vi } from "vitest";
import { verifyCiBackend, verifyCiBuild } from "./verify-ci-backend.mjs";

const devUrl = "https://handsome-raccoon-955.convex.cloud";
const prodUrl = "https://fleet-goldfish-183.convex.cloud";
const scratch = [];

afterEach(() => {
  for (const path of scratch.splice(0)) rmSync(path, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function buildWith(chunks) {
  const root = join(homedir(), ".cache", "tmp");
  mkdirSync(root, { recursive: true });
  const directory = mkdtempSync(join(root, "chrondle-ci-guard-"));
  scratch.push(directory);
  mkdirSync(join(directory, "static", "chunks"), { recursive: true });
  for (const [name, source] of Object.entries(chunks)) {
    writeFileSync(join(directory, "static", "chunks", name), source);
  }
  return directory;
}

test("CI environment validation rejects the production Convex deployment", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-env-config.mjs", "ci"], {
    env: {
      PATH: process.env.PATH,
      NEXT_PUBLIC_CONVEX_URL: "https://fleet-goldfish-183.convex.cloud",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
      CLERK_SECRET_KEY: "sk_test_example",
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /CI Convex target must be.*development/);
});

test("CI accepts only its explicit development target, without deployment credentials", () => {
  verifyCiBackend({ NEXT_PUBLIC_CONVEX_URL: devUrl });
  for (const url of [
    undefined,
    prodUrl,
    `${devUrl}/`,
    `${devUrl}.example.com`,
    "http://localhost:3210",
  ]) {
    assert.throws(() => verifyCiBackend({ NEXT_PUBLIC_CONVEX_URL: url }), /CI Convex target/);
  }
  assert.throws(
    () => verifyCiBackend({ NEXT_PUBLIC_CONVEX_URL: devUrl, CONVEX_DEPLOY_KEY: "present" }),
    /must not receive a Convex deployment credential/,
  );
});

test("CI refuses a production-bound artifact even when its runtime points to development", () => {
  verifyCiBackend({ NEXT_PUBLIC_CONVEX_URL: devUrl });
  const directory = buildWith({
    "app.js": `const url = ${JSON.stringify(devUrl)}`,
    "lazy-client.js": `const url = ${JSON.stringify(prodUrl)}`,
  });
  assert.throws(() => verifyCiBuild(directory), /Production Convex URL/);
});

test("CI requires a development endpoint in the compiled client, not merely runtime env", () => {
  assert.throws(
    () => verifyCiBuild(buildWith({ "app.js": "const url = undefined" })),
    /must embed/,
  );
  verifyCiBuild(
    buildWith({
      "app.js": `const url = ${JSON.stringify(devUrl)}`,
      "sdk.js":
        'throw new Error("ConvexReactClient requires a URL like https://happy-otter-123.convex.cloud")',
    }),
  );
});

test.each([devUrl, prodUrl])(
  "security headers allow only the configured Convex origin: %s",
  async (url) => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", url);
    vi.resetModules();
    const { default: config } = await import("../next.config.ts");
    const routes = await config.headers();
    const policy = routes[0].headers.find(({ key }) => key === "Content-Security-Policy").value;
    const connect = policy.split("; ").find((directive) => directive.startsWith("connect-src "));
    assert.ok(connect.includes(url));
    assert.ok(connect.includes(url.replace("https:", "wss:")));
    assert.ok(!connect.includes(url === devUrl ? prodUrl : devUrl));
  },
);

test.each(["", "invalid-url"])(
  "unconfigured backends grant no Convex CSP origin: %j",
  async (url) => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", url);
    vi.resetModules();
    const { default: config } = await import("../next.config.ts");
    const routes = await config.headers();
    const policy = routes[0].headers.find(({ key }) => key === "Content-Security-Policy").value;
    assert.ok(!policy.includes(".convex.cloud"));
  },
);
