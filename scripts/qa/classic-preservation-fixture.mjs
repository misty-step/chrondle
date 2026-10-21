// Synthetic loopback backend: no credentials or production network access.
import { serve } from "bun";
const ids = { A: "a".repeat(32), B: "b".repeat(32), C: "c".repeat(32) };
function puzzle(key) {
  return {
    _id: ids[key],
    _creationTime: 1,
    targetYear: 2000,
    events: Array.from({ length: 6 }, (_, i) => `Synthetic clue ${i + 1}`),
    puzzleNumber: { A: 42, B: 41, C: 43 }[key],
    date: { A: "2026-10-21", B: "2026-10-20", C: "2026-10-22" }[key],
  };
}
function query(path, args) {
  if (path.includes("orderPuzzles") && path.includes("getOrderPuzzle"))
    return {
      _id: "e".repeat(32),
      _creationTime: 1,
      date: args.date ?? "2026-10-21",
      puzzleNumber: 42,
      seed: "synthetic",
      events: [{ id: "synthetic-order", year: 2000, text: "Synthetic order clue" }],
    };
  if (path.includes("getPuzzleByDate")) return puzzle(args.date === "2026-10-22" ? "C" : "A");
  if (path.includes("getPuzzleByNumber")) return puzzle(args.puzzleNumber === 41 ? "B" : "A");
  if (path.includes("getCurrentUser")) return null;
  if (path.includes("getUserPlay")) return null;
  if (path.includes("getTotalPuzzles")) return 43;
  if (path.includes("getPuzzleStats")) return { totalPlays: 0, averageGuesses: 0, winRate: 0 };
  return null;
}
serve({
  hostname: "127.0.0.1",
  port: 43162,
  async fetch(request, server) {
    if (request.headers.get("upgrade") === "websocket") {
      if (
        server.upgrade(request, {
          data: { version: { querySet: 0, identity: 0, ts: "AAAAAAAAAAA=" } },
        })
      )
        return;
    }
    if (request.method === "OPTIONS")
      return new Response(null, {
        headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
      });
    const body = await request.json().catch(() => ({}));
    return Response.json(
      { status: "success", value: query(body.path ?? "", body.args ?? {}), logLines: [] },
      { headers: { "Access-Control-Allow-Origin": "*" } },
    );
  },
  websocket: {
    message(ws, raw) {
      const msg = JSON.parse(String(raw));
      if (msg.type === "Connect" || msg.type === "Event") return;
      if (msg.type === "Mutation" || msg.type === "Action") {
        ws.send(
          JSON.stringify({
            type: `${msg.type}Response`,
            requestId: msg.requestId,
            success: false,
            result: "Synthetic fixture forbids writes",
            logLines: [],
          }),
        );
        return;
      }
      const end = { ...ws.data.version };
      const modifications = [];
      if (msg.type === "Authenticate") end.identity = msg.baseVersion + 1;
      if (msg.type === "ModifyQuerySet") {
        end.querySet = msg.newVersion;
        for (const change of msg.modifications) {
          modifications.push(
            change.type === "Remove"
              ? { type: "QueryRemoved", queryId: change.queryId }
              : {
                  type: "QueryUpdated",
                  queryId: change.queryId,
                  value: query(change.udfPath, change.args[0] ?? {}),
                  logLines: [],
                  journal: null,
                },
          );
        }
      }
      ws.send(
        JSON.stringify({
          type: "Transition",
          startVersion: ws.data.version,
          endVersion: end,
          modifications,
        }),
      );
      ws.data.version = end;
    },
  },
});
