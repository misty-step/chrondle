import assert from "node:assert/strict";

export function assertHtml(
  path: string,
  response: { status: number; headers: Pick<Headers, "get"> },
  html: string,
  status: number,
  markers: string[],
) {
  assert.equal(response.status, status, `${path}: unexpected status`);
  assert.equal(
    response.headers.get("content-type")?.split(";", 1)[0],
    "text/html",
    `${path}: unexpected content type`,
  );
  // React inserts empty separator comments between adjacent text nodes.
  const markup = html.replaceAll("<!-- -->", "");
  for (const marker of ["</html>", ...markers]) {
    assert(markup.includes(marker), `${path}: missing ${marker}`);
  }
  // RSC can stream an exception after sending HTTP 200 headers.
  for (const match of html.replaceAll('\\"', '"').matchAll(/"digest"\s*:\s*"([^"]*)"/g)) {
    assert(
      status === 404 && match[1] === "NEXT_HTTP_ERROR_FALLBACK;404",
      `${path}: streamed render error ${match[1]}`,
    );
  }
}

export function assertRuntimeLogs(logs: { level: string; message: string }[]) {
  for (const log of logs) {
    let applicationLevel: unknown;
    try {
      applicationLevel = JSON.parse(log.message)?.level;
    } catch {
      // Next/workerd diagnostics are plain text.
    }
    assert(
      !["error", "fatal"].includes(log.level) &&
        applicationLevel !== "error" &&
        applicationLevel !== "fatal" &&
        !/EvalError|code generation from strings|disallowed.*codegen/i.test(log.message),
      `Worker runtime error: ${log.message}`,
    );
  }
}
