# ADR 0001: Run the Convex functions on a Cloudflare Worker and SQLite Durable Object

- Status: Accepted. The backend is built and verified locally. Preview, data migration and cutover are pending.
- Date: 2026-10-15
- Scope: the Chrondle application backend (`convex/`), not the frontend Worker or release/CD policy.

## Context

Chrondle's frontend already runs on Cloudflare as the `chrondle` Worker (OpenNext). Its backend is Convex Cloud, using the production deployment `fleet-goldfish-183` and the development deployment `handsome-raccoon-955`. The backend does five jobs:

- Browsers subscribe to queries and run mutations over the Convex WebSocket sync protocol.
- Server code calls the HTTP API through `ConvexHttpClient`: Clerk and Stripe webhooks, checkout, sitemap, health and SSR preloads.
- Five crons run, including daily puzzle generation and LLM event generation at 02:00 UTC.
- `ctx.scheduler.runAfter` jobs run, such as historical context and the puzzle judge.
- It stores all users, plays, puzzles and events.

Every boundary that serves the app must move onto Cloudflare's own compute and data services. Self-hosting Convex on a VM, or proxying to Convex, does not count. Browser and API behavior must stay the same, and Clerk, Stripe, Resend, OpenRouter and PostHog stay as integrations. Both the browser bundle and the server code use `convex@1.45.0`.

## Decision

Keep the `convex/` functions and every client unchanged. Add `backend/`, a Worker named `chrondle-backend` that serves the Convex 1.45 client protocols and runs the existing functions inside one SQLite-backed Durable Object. Moving the backend then only requires changing `NEXT_PUBLIC_CONVEX_URL`.

### Execution

- The `convex` package registers functions that call `globalThis.Convex.syscall`/`asyncSyscall`. `backend/src/engine/engine.ts` implements those syscalls, the same host interface Convex's own runtime provides. The functions run unmodified: the reads, index ranges and filters, writes, `runQuery`/`runMutation`/`runAction`, the scheduler and auth identity.
- `backend/scripts/generate-modules.mjs` generates the module map from `convex/`. The map is not committed. Wrangler builds, Vitest and `backend:type-check` all regenerate it.
- Argument and return validators, the `ConvexError` data and the redaction of other errors to `Server Error` with a request ID all behave like production Convex. They were checked against recorded `fleet-goldfish-183` responses.

### Data

- One Durable Object holds all data: class `ChrondleBackend`, name `primary`, location hint `enam`.
- Documents live in `cvx_documents` and index entries in `cvx_index`. Index keys use an order-preserving encoding, so every Convex index range becomes a string interval.
- Document IDs use the Convex ID v6 format with the same table numbers. Existing IDs, including IDs already in URLs and client storage, stay valid after import. The codec was checked against a real production ID.

### Consistency

- Mutations run one at a time.
- Each query and each sync transition reads exactly one committed state: a commit waits for running readers, and new readers wait for a pending commit.
- A subscription re-runs only when its read set intersects a commit.
- Mutation results are recorded per session and request, so a client that replays a mutation after reconnecting gets the original result. Each mutation runs exactly once.

### Protocols

- `backend/src/protocol/sync.ts` serves the WebSocket sync protocol at `/api/<version>/sync`: query sets, transitions (chunked above 512 KiB), mutations, actions, authentication, token expiry and pings.
- `backend/src/protocol/http.ts` serves `/api/query`, `/api/mutation` and `/api/action`. It uses the same JSON shapes, the same 401 bodies for bad tokens, and CORS that reflects the request origin, as Convex does.

### Auth

- The providers come from `convex/auth.config.ts`: Clerk OIDC discovery and JWKS, with issuer and `applicationID` audience checks.
- `customJwt` providers are supported, including data-URI JWKS.
- `EXTRA_AUTH_PROVIDERS` lets a synthetic preview issuer run outside production. The production environment ignores it.

### Scheduler and crons

- Jobs live in `_scheduled_functions` and are committed in the same transaction as the mutation that scheduled them.
- Due jobs start right after that commit. The Durable Object alarm covers future jobs, crons and restarts. An hourly Worker cron trigger (`17 * * * *`) re-arms the alarm as a watchdog.
- A scheduled mutation runs exactly once. An action is marked `inProgress` first and runs at most once. If a restart interrupts it, it is marked failed. These are Convex's semantics.
- Finished job records are pruned after 7 days.

### Backups

- Every day at 03:17 UTC the Worker writes an NDJSON export to a private R2 bucket (`BACKUPS`) and keeps the last 30.
- Each export has a manifest with per-table document counts and the SHA-256 of canonical records. Table numbers are included even for empty tables.
- A restore checks the result against the manifest and reports any mismatching table.

### Operator API

`/_backend/admin/*` replaces the Convex dashboard and `npx convex run`: `manifest`, `backup`, `restore`, `run` and `scheduler`. It requires `BACKEND_ADMIN_TOKEN`, and callers without it get the same 404 as an unknown path.

### Environments

All three are defined in `backend/wrangler.jsonc`. Each has its own script, Durable Object namespace and bucket, so preview data is physically separate from production.

| Environment  | Script                     | Bucket                             |
| ------------ | -------------------------- | ---------------------------------- |
| default      | `chrondle-backend-dev`     | `chrondle-backend-dev-backups`     |
| `preview`    | `chrondle-backend-preview` | `chrondle-backend-preview-backups` |
| `production` | `chrondle-backend`         | `chrondle-backend-backups`         |

Preview and production are served on their `workers.dev` hostnames, so no DNS records change.

## Alternatives considered

1. **Run the open-source Convex backend on a VM or container.** Rejected: the migration contract excludes VM-hosted Convex, and it would not use Cloudflare data services.
2. **Rewrite the functions for D1 and replace the client hooks.** Rejected: it would rewrite about 80 modules and every data hook in `src/`, and change realtime behavior. That is a product rewrite rather than a hosting move, with no way to compare against the current behavior.
3. **Use D1 with a separate realtime coordinator.** Rejected: one Durable Object already provides a single writer, synchronous SQLite transactions, WebSockets and alarms. D1 would need a second coordinator for ordering and push. Chrondle's load fits one object.
4. **Proxy to Convex.** Rejected: excluded by the migration contract.

## Consequences

- All writes go through one single-threaded object in one region. That is enough for Chrondle's current traffic. Sharding would only be needed if write volume grew by orders of magnitude.
- The repository now owns the Convex 1.45 protocol surface it uses. Before any upgrade of the `convex` package, `bun run backend:test` must pass. It runs the repository's own `convex-test` suites against this engine and drives the real `ConvexClient` and `ConvexHttpClient` against the protocol layer.
- Features Chrondle does not use are rejected with a clear error: file storage, text and vector search, and `.paginate()`. If a function starts using one, it fails in tests rather than silently changing behavior.
- `"use node"` actions run in the Workers runtime with `nodejs_compat`. The only Node file API in use is the optional leaky-phrases file read in `convex/lib/qualityValidator.ts`. It already falls back to an empty list when the file is missing, which is also what happens on Convex.
- Operators use `/_backend/admin/*` and Workers logs in place of the Convex dashboard.

## Verification

- `bun run backend:test` runs the engine, ID codec, scheduler, backup and auth unit tests, the repository's Convex suites against this engine, and the real Convex clients against the protocol layer. The root `vitest.config.ts` runs it in CI as the `backend` project.
- `node backend/scripts/verify-backend.mjs check --url <backend>` drives the real `convex@1.45.0` clients against a running backend. It checks authentication, live sync, play and streak, invalid access, concurrency, exactly-once replay, scheduler delivery, and backup to verified restore. Without `--full` it only reads, so it is safe against production.

## Cutover and rollback

The cutover is a backend configuration change. The frontend's DNS and routes stay the same.

1. Deploy `chrondle-backend` with `wrangler deploy -c backend/wrangler.jsonc --env production`. Set the secrets `BACKEND_ADMIN_TOKEN`, `CLERK_SYNC_SECRET` and `STRIPE_SYNC_SECRET`, plus the LLM, email and observability keys the functions read today.
2. Make Convex the only writer: pause the `fleet-goldfish-183` deployment, export it, import into the Durable Object, and reconcile per-table counts and canonical-record SHA-256s.
3. Point `NEXT_PUBLIC_CONVEX_URL` at the backend and redeploy the frontend. These files pin the Convex URL and change in the same commit:
   - `wrangler.jsonc` (frontend vars)
   - `scripts/host-cd.py`
   - `src/lib/env.schema.ts` and `scripts/verify-env-config.mjs`, which require `convex.cloud`
   - `scripts/verify-hosting-parity.mjs`
4. Keep Convex paused but intact until the new backend has been proven with real user paths.

Rollback before any write is accepted on Cloudflare: restore the previous `NEXT_PUBLIC_CONVEX_URL` and resume Convex.

Rollback after writes on Cloudflare: make the Durable Object read-only, export it, convert the export to a Convex snapshot (same IDs and table numbers), and run `npx convex import --replace` into Convex. Reconcile the same checksums, then switch the URL back. Accepted writes are kept.
