// @vitest-environment node
import { describe, expect, it } from "vitest";
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


});
