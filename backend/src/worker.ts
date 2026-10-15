/**
 * chrondle-backend Worker: routes Convex client traffic (WebSocket sync and
 * HTTP API) to the single ChrondleBackend Durable Object. The hourly Cron
 * Trigger re-arms the Durable Object alarm (watchdog) and, once a day at
 * BACKUP_HOUR_UTC, writes a backup to the private R2 bucket.
 */
import { ChrondleBackend, type Env } from "./durableObject";
import { preflight } from "./protocol/http";

export { ChrondleBackend };

const PRIMARY = "primary";
const BACKUP_HOUR_UTC = 3;

function backend(env: Env) {
  return env.BACKEND.get(env.BACKEND.idFromName(PRIMARY), { locationHint: "enam" });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (request.method === "OPTIONS") return preflight(request);
    if (path.startsWith("/api/") || path.startsWith("/_backend/"))
      return backend(env).fetch(request);
    await request.body?.cancel();
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const stub = backend(env);
    if (new Date(controller.scheduledTime).getUTCHours() === BACKUP_HOUR_UTC && env.BACKUPS) {
      const result = await stub.backup();
      const counts = Object.fromEntries(
        Object.entries(result.manifest).map(([table, summary]) => [table, summary.count]),
      );
      console.log(`[backup] wrote ${result.key} at ts ${result.ts}`, JSON.stringify(counts));
    }
    const status = await stub.wake();
    console.log("[watchdog]", JSON.stringify(status));
  },
} satisfies ExportedHandler<Env>;
