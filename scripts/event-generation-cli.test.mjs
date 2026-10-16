// @vitest-environment node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { test } from "vitest";

function invoke(script, args, url, token = "synthetic-operator") {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["--import", "tsx", `scripts/${script}.ts`, ...args], {
      env: {
        PATH: process.env.PATH,
        NEXT_PUBLIC_CONVEX_URL: url,
        CONVEX_OPERATOR_TOKEN: token,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (data) => (output += data));
    child.stderr.on("data", (data) => (output += data));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });
}

test.each([
  ["test-event-generation", "--year"],
  ["test-event-generation-bulk", "--years"],
])(
  "%s rejects dry-run before transport and preserves authorized recovery",
  async (script, yearFlag) => {
    const requests = [];
    let deny = false;
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      const call = JSON.parse(body);
      requests.push({ url: request.url, auth: request.headers.authorization, ...call });
      response.setHeader("Content-Type", "application/json");
      if (deny) {
        response.writeHead(401).end("synthetic authorization denied");
        return;
      }
      const value =
        call.path === "lib/workSelector:testSelectWorkYears"
          ? { years: [1969, 1914] }
          : {
              status: "success",
              events: [{ event_text: "Synthetic transport fixture", domain: "science" }],
              metadata: { attempts: 1 },
              usage: {},
            };
      response.end(JSON.stringify({ status: "success", value }));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const target = [yearFlag, "1969"];

    try {
      for (const args of [
        ["--dry-run"],
        ["--dry-run", ...target],
        [...target, "--dry-run"],
        ["--count", "2", "--dry-run"],
        ["--verbose", "--dry-run"],
        ["--dry-run=true"],
      ]) {
        const result = await invoke(script, args, url);
        assert.equal(result.code, 1, result.output);
        assert.match(result.output, /unknown option '--dry-run(?:=true)?'/);
        assert.equal(requests.length, 0, "rejected dry-run must never reach the backend");
      }

      const help = await invoke(script, ["--help"], url, "");
      assert.equal(help.code, 0, help.output);
      assert.doesNotMatch(help.output, /dry-run/);
      const missingToken = await invoke(script, target, url, "");
      assert.equal(missingToken.code, 1, missingToken.output);
      assert.match(missingToken.output, /CONVEX_OPERATOR_TOKEN is not set/);
      assert.equal(requests.length, 0);

      const success = await invoke(script, [...target, "--verbose"], url);
      assert.equal(success.code, 0, success.output);
      assert.match(success.output, /Synthetic transport fixture/);
      assert.deepEqual(
        requests.map(({ url, auth, path, args }) => ({ url, auth, path, args })),
        [
          {
            url: "/api/action",
            auth: "Bearer synthetic-operator",
            path: "actions/eventGeneration/orchestrator:testGenerateYearEvents",
            args: [{ year: 1969 }],
          },
        ],
      );

      deny = true;
      const denied = await invoke(script, target, url);
      assert.equal(denied.code, 1, denied.output);
      assert.match(denied.output, /synthetic authorization denied/);
      deny = false;
      const recovery = await invoke(script, ["--count", "2"], url);
      assert.equal(recovery.code, 0, recovery.output);
      assert.deepEqual(
        requests.slice(2).map(({ path, args }) => ({ path, args })),
        [
          { path: "lib/workSelector:testSelectWorkYears", args: [{ count: 2 }] },
          {
            path: "actions/eventGeneration/orchestrator:testGenerateYearEvents",
            args: [{ year: 1969 }],
          },
          {
            path: "actions/eventGeneration/orchestrator:testGenerateYearEvents",
            args: [{ year: 1914 }],
          },
        ],
      );
      assert.ok(requests.every(({ auth }) => auth === "Bearer synthetic-operator"));
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
  30000,
);
