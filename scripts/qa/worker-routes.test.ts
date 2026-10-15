// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { assertHtml, assertRuntimeLogs } from "./worker-route-contracts";

const response = (status = 200, contentType = "text/html; charset=utf-8") => ({
  status,
  headers: new Headers({ "content-type": contentType }),
});

describe("built Worker release route check", () => {
  it("rejects wrong status/media/empty or missing notes instead of accepting any 200", () => {
    expect(() =>
      assertHtml("/changelog", response(), "Changelog</html>", 200, ["Changelog"]),
    ).not.toThrow();
    for (const status of [302, 404, 500, 503]) {
      expect(() =>
        assertHtml("/changelog", response(status), "Changelog</html>", 200, ["Changelog"]),
      ).toThrow();
    }
    expect(() =>
      assertHtml("/changelog", response(200, "application/json"), "Changelog</html>", 200, [
        "Changelog",
      ]),
    ).toThrow();
    expect(() => assertHtml("/changelog", response(), "</html>", 200, ["Release 1.7.3"])).toThrow();
    expect(() => assertHtml("/changelog", response(), "", 200, [])).toThrow();
    expect(() =>
      assertHtml("/releases/1.2.3", response(), "<h1>v<!-- -->1.2.3</h1></html>", 200, [
        "v1.2.3</h1>",
      ]),
    ).not.toThrow();
  });

  it("rejects streamed failures after 200, permitting only the intended 404 control flow", () => {
    for (const digest of ['"digest":"123"', '\\"digest\\":\\"123\\"']) {
      expect(() => assertHtml("/changelog", response(), `</html>${digest}`, 200, [])).toThrow(
        "streamed render error",
      );
    }
    expect(() =>
      assertHtml(
        "/unknown",
        response(404),
        '</html>"digest":"NEXT_HTTP_ERROR_FALLBACK;404"',
        404,
        [],
      ),
    ).not.toThrow();
    expect(() => assertHtml("/unknown", response(404), '</html>"digest":"123"', 404, [])).toThrow();
  });

  it("rejects native and structured application errors even if caught by rendering", () => {
    for (const log of [
      { level: "error", message: "ENOENT /bundle/CHANGELOG.md" },
      { level: "log", message: '{"level":"error","message":"render failed"}' },
      { level: "warn", message: "EvalError: Code generation from strings disallowed" },
    ]) {
      expect(() => assertRuntimeLogs([log])).toThrow("Worker runtime error");
    }
    expect(() =>
      assertRuntimeLogs([{ level: "warn", message: "Informational warning" }]),
    ).not.toThrow();
  });

  it("runs on PR CI and the same built bytes before production activation, preserving backend and Stripe checks", () => {
    const ci = parse(readFileSync(".github/workflows/ci.yml", "utf8"));
    const steps = ci.jobs["worker-routes"].steps;
    const commands = steps.map((step: { run?: string }) => step.run);
    expect(commands.indexOf("bun run test:worker-routes")).toBeGreaterThan(
      commands.indexOf("bun run build:cf"),
    );
    expect(commands).toContain("bun run test:worker-routes");
    expect(ci.jobs["worker-routes"]["continue-on-error"]).not.toBe(true);
    expect(ci.jobs["merge-gate"].needs).toContain("worker-routes");
    const deploy = parse(readFileSync(".github/workflows/deploy.yml", "utf8"));
    const production = deploy.jobs.cloudflare.steps.map((step: { run?: string }) => step.run);
    const check = production.indexOf("bun run test:worker-routes");
    expect(check).toBeGreaterThan(production.indexOf("bun run build:cf"));
    expect(check).toBeLessThan(
      production.indexOf('bunx wrangler deploy --env production --message "$GITHUB_SHA"'),
    );
    expect(deploy.jobs.cloudflare.needs).toBe("backend");
    expect(production).toContain("node scripts/verify-webhook-redirect.mjs");
    const runner = readFileSync("scripts/qa/worker-routes.ts", "utf8");
    expect(runner).toContain("...releases.map");
    expect(runner).toContain('"/releases/9999.0.0"');
    expect(runner).toContain("outboundService:");
    expect(runner).toContain('env: "production"');
  });
});
