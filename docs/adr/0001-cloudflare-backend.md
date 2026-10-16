# ADR 0001: Run the Convex functions on a Cloudflare Worker and SQLite Durable Object

- Status: Accepted. Isolated synthetic preview, private restore, production preparation and private native reverse-import are verified. Final one-writer data migration and cutover are pending.
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
- A queued mutation is admitted before it queues. Fencing aborts the host's wait for old handlers and readers, releases their locks and rejects every later syscall and commit from their epoch. Their JavaScript cannot be forcibly stopped, so this does not undo external provider effects already started; scheduled actions remain at-most-once and are never replayed after interruption.
- Table numbers are staged with the transaction (including nested savepoints), not persisted by ID allocation. SQLite owns the committed registry; there is no registry cache to publish ahead of a commit or leave stale after rollback.
- Each query and each sync transition reads exactly one committed state: a commit waits for running readers, and new readers wait for a pending commit.
- A subscription re-runs only when its read set intersects a commit.
- Mutation results are recorded per session and request, so a client that replays a mutation after reconnecting gets the original result. Each mutation runs exactly once. The records are kept for 24 hours.
- Every write belongs to a unit of work admitted while writes are live: a client request, a scheduled job or a cron dispatch. Imports and restores are the only other writers, and they run only while writes are paused. Pausing stops admitting units, lets the admitted ones finish until a deadline, then fences them: a unit admitted before the pause can never write again, even after writes resume. When a pause is acknowledged, nothing can change the data except an import or restore.

### Protocols

- `backend/src/protocol/sync.ts` serves the WebSocket sync protocol at `/api/<version>/sync`: query sets, transitions (chunked above 512 KiB), mutations, actions, authentication, token expiry and pings.
- `backend/src/protocol/http.ts` serves `/api/query`, `/api/mutation` and `/api/action`. It uses the same JSON shapes, the same 401 bodies for bad tokens, and CORS that reflects the request origin, as Convex does.

### Auth

- The providers come from `convex/auth.config.ts`: Clerk OIDC discovery and JWKS, with issuer and `applicationID` audience checks.
- `customJwt` providers are supported, including data-URI JWKS.
- `EXTRA_AUTH_PROVIDERS` accepts a schema-validated synthetic issuer only when `ENVIRONMENT` is explicitly `preview` or `development`. Missing, misspelled and production environments ignore it; malformed configuration leaves the normal providers intact and logs no configuration contents.
- Each provider has one JWKS refresh in flight. Unknown signing keys can trigger at most one refresh per 30 seconds, including failed attempts. OIDC discovery and JWKS `Cache-Control: max-age` and `Age` bound freshness (10 minutes if unspecified, capped at one day). `no-cache` revalidates and `no-store` retains no keys. A failed refresh keeps the last good, already-known keys for at most five minutes after expiry, or a shorter `stale-if-error`; `must-revalidate`, `no-cache` and `no-store` forbid stale use. That grace never extends on failure, and a successful rotation immediately removes old keys. Fetches time out after 10 seconds. HTTP and sync consumer tests cover cold/concurrent refresh, unknown kids, rotation, expiry, outage and recovery.

### Scheduler and crons

- Jobs live in `_scheduled_functions` and are committed in the same transaction as the mutation that scheduled them.
- Due jobs start right after that commit. The Durable Object alarm covers future jobs, crons and restarts. An hourly Worker cron trigger (`17 * * * *`) re-arms the alarm as a watchdog.
- A scheduled mutation runs exactly once. If the function throws, the job fails, as on Convex. If the engine or storage fails instead, the job stays pending and is retried: at once, then after 1 s, doubling up to 5 minutes. The attempt count is stored with the job, so a restart keeps the backoff.
- An action is marked `inProgress` first and runs at most once. If a restart interrupts it, it is marked failed with Convex's `Transient error while executing action`, as on Convex. An action still running when a pause takes effect is failed the same way.
- A cron occurrence is dispatched as a job in the same transaction that advances the cron's stored cursor, so a restart on either side of the dispatch neither loses nor repeats it. A cron with no cursor (new) starts at its next occurrence. Occurrences missed while writes were paused run once when writes resume, as on Convex, which schedules a cron's next run from the current time rather than replaying each missed period.
- Finished job records are pruned after 7 days.

### Backups

- Every day at 03:17 UTC the Worker writes an NDJSON export to a private R2 bucket (`BACKUPS`) and keeps the last 30.
- An export is one committed state: the application tables plus the runtime state that goes with them, which is the scheduled functions, the cron cursors and the mutation replay records. Restoring it brings back that state's queued work and replay results, and drops any queued or recorded after it. An action that was running when the export was taken is restored as failed, never re-run.
- Each export has a manifest with per-table document counts and the SHA-256 of canonical records. Table numbers are included even for empty tables. A runtime summary gives the jobs per state, the cron cursors and the number of replay records.
- A restore checks its recorded application and runtime checksums before storing anything; malformed or incomplete R2 manifests are refused. An import requires the sender's SHA-256 of the exact UTF-8 NDJSON in `X-Backend-Sha256`; export returns that header. Both validate document IDs, table numbers and schema, then replace everything in one transaction. Result checksums are checked again inside that transaction, so even a discrepancy during replacement rolls back all documents, registry, jobs, cursors, replay results and the committed timestamp. A rejected snapshot changes nothing.

### Operator API

`/_backend/admin/*` replaces the Convex dashboard and `npx convex run`: `manifest`, `backup`, `restore`, `export`, `import`, `pause`, `resume`, `run` and `scheduler`. Hosted environments require a signed Cloudflare Access application assertion; unauthorized callers get the same 404 as an unknown path. The app's public game paths retain their Clerk/anonymous contract, with no Access requirement.

`BACKEND_OPERATOR_ACCESS` contains one JSON configuration: exact HTTPS Access issuer, application `audience`, and `identities`, a list of `{ "kind": "human", "email": "<exact owner email>" }` or `{ "kind": "machine", "clientId": "<named service-token ClientID>" }`. Human identities require a nonempty subject and the exact configured email, not a provider subject that can change. Per [Cloudflare's documented service-token shape](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/#service-token-authentication), machines require `sub=""` and `common_name` exactly equal to a pinned machine ClientID. Both require `type="app"`, issuer/audience/signature/time validation through the shared verifier, and an unexpired token. Every other empty-sub token is refused; ordinary game auth still refuses all empty subjects.

Missing or invalid configuration fails closed without logging its contents. `BACKEND_ADMIN_TOKEN` is accepted only with explicit `ENVIRONMENT=development` on a loopback request, never as a hosted fallback. Before deployment, provision/read back the Access application and policies for the exact admin path and every alternate origin, pin the actual named machine identity and exact owner email, then prove a real service-token allow and anonymous refusal. Human-policy readback is the proof; no access to the owner's email is needed. Local RSA/SQLite consumer tests are not that hosted proof.

`POST /pause` is the barrier described under Consistency. It waits up to `settleMs` (default 60 s, at most 15 minutes) for running work and due jobs to finish, then fences writes and fails any action still running. It answers `{"writes": "paused", "settled", "interrupted"}`: `settled` is false when the deadline cut work off, and `interrupted` lists the failed jobs. `GET /export`, `POST /import` and `POST /restore` answer 409 unless writes are paused.

The same deadline bounds jobs first started by the drain itself. Pause, resume, export, import and restore are serialized end-to-end, including R2 reads and interruption bookkeeping. A persistence failure never acknowledges a pause or opens writes: the instance fails closed and a retried pause must persist the barrier before it can succeed. If storage remains unavailable, do not cut over or import; keep the old writer authoritative until a pause succeeds and survives restart.

### Environments

All three are defined in `backend/wrangler.jsonc`. Each has its own script, Durable Object namespace and bucket, so preview data is physically separate from production.

| Environment  | Script                     | Bucket                             |
| ------------ | -------------------------- | ---------------------------------- |
| default      | `chrondle-backend-dev`     | `chrondle-backend-dev-backups`     |
| `preview`    | `chrondle-backend-preview` | `chrondle-backend-preview-backups` |
| `production` | `chrondle-backend`         | `chrondle-backend-backups`         |

The isolated preview uses `chrondle-backend-preview.mistystep.io`, with Access
covering `/_backend/admin` and its subpaths. Its `workers.dev` and immutable
preview URLs are disabled; public game endpoints remain public. The preview
workflow deploys only its own script, namespace and bucket, using the existing
scoped CD credential and the `Preview` environment's operator configuration and
synthetic public JWKS. The synthetic private signer and named machine credential
never enter CI. This does not change any production frontend domain or backend
binding. Production preparation uses `chrondle-backend.mistystep.io`; its provider and
immutable origins are disabled too. The serving frontend still uses Convex.

The same workflow deploys `chrondle-preview.mistystep.io` as the separate
`chrondle-preview` frontend Worker after the backend preview. Its public build
inputs come from `env.preview.vars` in the frontend Wrangler configuration, the
same values used at runtime. Thus browser sync, SSR/HTTP and the generated CSP
all point at the isolated backend without browser interception. It uses the
existing CI Clerk **test** publishable key; no production Clerk, payment, model,
email or analytics credentials are bound. Clerk's middleware requires a server
key even on anonymous routes, so the runtime receives the existing repository
Clerk key only if it is explicitly test-mode (`sk_test_`); a missing or production
key stops provisioning rather than falling back to a live account. The key is
never passed to installation or compilation. This slice supports anonymous game
journeys, not authenticated account or successful payment/provider acceptance.
Those paths still require their sandbox bindings and separate verification.
The frontend's provider and immutable preview URLs are disabled. Neither this
frontend nor its backend has production routes or a production data binding.

Preview webhook signing and gateway secrets are generated only for this preview,
kept in the operator's encrypted password store and the GitHub `Preview`
environment, and bound at runtime by the existing preview workflow. Stripe
signature verification uses the SDK's static verifier, not an API-key-bearing
client. Successful synthetic signed deliveries prove the real HTTP verification,
gateway and persistence paths; they do not prove a real checkout or provider
delivery. Subscription updates still retrieve Stripe's current state, rather
than trusting an older event payload. Without sandbox API access, that upstream
read is a labeled fixture in consumer tests, never a live key on the preview.
The production Stripe webhook host and signing secret are unchanged.

### Private restore rehearsal

Before final migration, an encrypted production snapshot is restored to the
separate `restore` environment: `chrondle-backend-restore.mistystep.io`, its own
Worker and Durable Object namespace, and `chrondle-backend-restore-backups`.
The entire hostname is protected by its own Access application, carrying the
existing Glass human policy and one specifically named recovery-drill machine.
Provider and immutable preview URLs are disabled. The public synthetic preview
never receives private records or a binding to this target.

The existing isolated-preview workflow's explicit `private_restore` dispatch
selects only this backend and the GitHub `Restore` environment. It binds only
`BACKEND_RESTORE_OPERATOR_ACCESS`; no frontend, synthetic game identity, provider
key, webhook gateway or cron is deployed. Runtime `ENVIRONMENT=production`
keeps a new database paused and ignores extra synthetic auth providers. The
operator verifies the whole-host denial, named-machine allow, exact revision,
paused state and physically distinct bindings before any private import.

On Mirrodin only, decrypt the hash-verified age object into process memory,
convert it to canonical NDJSON, import with the exact byte checksum, then export
and compare every table's count, number and canonical-record checksum. Keep
records, credentials and raw error bodies out of evidence and CI. Never resume
this target or invoke provider actions; a drill is not a final one-writer snapshot
or a production cutover. No automatic plaintext product backup is created here.
Retire only these named drill resources after durable recovery evidence, keeping
the authorized encrypted snapshot and its pass identity.

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
- `node backend/scripts/verify-backend.mjs check --url <backend>` drives the real `convex@1.45.0` clients against a running backend. It checks authentication, live sync, play and streak, invalid access, concurrency, exactly-once replay, scheduler delivery, paused writes, backup to verified restore, and export to import. It also pauses while four players are mid-guess and checks that every acknowledged guess, and nothing else, is in the export. Finally it checks that a queued job travels through export and import, waits while paused and runs once after resuming. Without `--full` it only reads, so it is safe against production.
- After that synthetic full check on a local preview, `node backend/scripts/verify-maintenance.mjs <local-url> <persist-to> <output-dir>` injects corrupt documents, registry, jobs, cursors and replay results into actual local R2, verifies rejected restores leave the full export and timestamp unchanged, checks import checksum/schema refusal and recovers through valid import/resume. It refuses non-loopback URLs. `backend/__tests__/dataSafety.test.ts` additionally injects faults at each replacement stage, pause/fence/resume persistence, stuck handlers/readers, queued work and a fenced-allocation/import registry race. These are controlled interleavings and retained-SQLite restarts, not a claim of captured process crashes.

## Cutover and rollback

The cutover is a backend configuration change. The frontend's DNS and routes stay the same.

### Prepare without cutting over

The existing `deploy.yml` has an explicit `prepare_cloudflare_backend` dispatch
(default false), using the same exact-revision CI/secret-scan gate, production
concurrency group, protected `Production` environment and scoped deploy token.
Dispatch a ref at the independently reviewed merge with green push checks, not
a later generated changelog commit that has no checks:

`gh workflow run deploy.yml --ref <reviewed-green-ref> -f prepare_cloudflare_backend=true`

This path deploys only the separate backend. It skips Convex deployment, Stripe
provider reads and every frontend build, activation, domain and rollback step.
Normal push releases retain their existing behavior. A new production database
starts paused; preparation never pauses or resumes either existing writer,
imports data or changes a frontend backend URL. Repeating the dispatch preserves
existing data and pause state rather than resetting them.

Before dispatch, provision Access only for this hostname's `/_backend/admin`
surface with the current Glass human policy and one separately named production
machine. Do not reuse preview or recovery-drill identities. Store its exact
operator JSON as `BACKEND_PRODUCTION_OPERATOR_ACCESS` in GitHub `Production`.
Transfer the existing Convex runtime settings, unchanged, into the single
`BACKEND_PRODUCTION_ENV` JSON secret there using the chief-only authorized
credential path, with values only in process memory. This is a configuration
migration, not new provider keys or calls; no test key replaces a live one.

`backend/scripts/production-bindings.mjs` validates the runtime binding payload
without printing it during preflight, then emits it only to Wrangler's secret
bulk stdin after compilation. It refuses malformed maps, non-string values and
overrides of runtime/control/auth bindings, including synthetic auth or a bearer
fallback. Provisioning and hosted authorization share the exact operator schema;
the existing central backend environment requirements validate mandatory sync
settings. Neither contract is copied into the provisioning script. Installation
and compilation receive no provider/operator credentials.
CI reads back the exact public backend revision and exercises read-only clients.
Outside CI, prove the named operator allow, anonymous and foreign-machine
denials, distinct resources and paused state before any import. Neither a green
preparation run nor an empty database proves final migration or cutover.

### Move the single writer

The existing `Production` environment's `NEXT_PUBLIC_CONVEX_URL` is the single
serving-backend setting. Release validation accepts only the existing production
Convex origin or the production Cloudflare origin, never the development or
synthetic preview. The same setting chooses the compatible backend deployment,
feeds the frontend compiler, and is explicitly bound to the frontend Worker.
There is no independent source default that can silently disagree with a build.
The hosting doctor requires that setting too. Changing it does not change any
frontend hostname or the canonical Stripe webhook URL/signing secret.

Ordinary releases still deploy Convex while that setting names Convex. Once it
names Cloudflare, they deploy the already prepared production backend with its
existing runtime bindings instead. Preparation remains backend-only. Neither
path imports data or changes a persisted pause state. A failed web activation
automatically restores the prior web Worker only when its actual runtime backend
origin matches the candidate; crossing a backend boundary requires the explicit
accepted-write-preserving recovery below, never an automatic backend resume.

Source can be independently reviewed and shipped with the setting still on
Convex. Only after final one-writer reconciliation may an operator change the
setting and run the existing release workflow at that reviewed, green revision.
This is not permission to pause the old writer while waiting for a source review.

A production database starts with writes paused: it serves queries but refuses every mutation, action, scheduled job and cron until an operator resumes it. Writes stay paused across restarts. The switch is `POST /_backend/admin/pause` and `POST /_backend/admin/resume`. A pause answers only once the work already running has finished or been cut off, and `import`, `restore` and `export` work only while writes are paused. Together these keep one writer at every step.

`bun backend/scripts/convex-snapshot.ts` converts between a Convex snapshot ZIP (`npx convex export` and `npx convex import`) and the backend's NDJSON, keeping every `_id`, `_creationTime` and table number. It also tells int64 (`3`) from float64 (`3.0`). Each conversion writes a manifest with the same per-table counts and canonical-record SHA-256s the backend reports, and `compare` exits non-zero on any difference.

A Convex snapshot carries only the application tables. `to-backup --as-of <time>` takes the time Convex was paused and sets the cron cursors from it: every occurrence up to then counts as run on Convex, and later ones run on the backend. `to-convex` refuses a snapshot with pending or running scheduled functions, because Convex cannot import them. It reports the finished job records, cron cursors and replay records it leaves out.

1. Prepare `chrondle-backend` through the existing CI dispatch above, prove its operator Access and paused state, and read back its production integration bindings. Keep the existing Convex writer and frontend configuration unchanged until the final consistent data move.
2. Make Convex the only writer, then move the data:
   - Pause the `fleet-goldfish-183` deployment outside the puzzle and event-generation cron windows, and note the time. Check that the dashboard's Schedules page shows no pending scheduled functions, since Convex's export does not carry them. If it shows any, resume Convex until they have run, then pause again and note the new time.
   - Run `npx convex export`, then `convex-snapshot.ts to-backup --as-of <the pause time>`.
   - Compute SHA-256 over the exact NDJSON bytes and POST them to `/_backend/admin/import` with `X-Backend-Sha256: <that digest>`. Missing, malformed or mismatched checksums return 400 without changing anything.
   - Run `compare` on the conversion manifest and the import response.
3. Set `Production`'s `NEXT_PUBLIC_CONVEX_URL` to the production backend, redeploy
   the reviewed frontend through the existing workflow, and resume writes on the
   backend. The source compatibility slice may ship first while the setting
   remains on Convex. There is no production Wrangler URL/default to edit or
   parallel backend selector. `scripts/host-cd.py` remains an inactive native-web
   recovery path pinned to Convex; it is usable only after the data-preserving
   reverse migration, not as an automatic Cloudflare-backend rollback.
4. Keep Convex paused but intact until the new backend has been proven with real user paths.

**Rollback before any write is accepted on Cloudflare:** restore the previous `NEXT_PUBLIC_CONVEX_URL` and resume Convex.

**Rollback after writes on Cloudflare, keeping those writes:**

1. Pause writes on the backend.
2. Save `GET /_backend/admin/export` and `GET /_backend/admin/manifest`.
3. Run `convex-snapshot.ts to-convex`, then `compare` its manifest with the backend's. If it refuses because scheduled functions are still pending, resume writes until they have run, then start again from step 1.
4. Run `npx convex import --replace-all` into Convex, and compare a fresh `npx convex export` the same way.
5. Resume Convex and switch the URL back.

This whole loop was rehearsed against the open-source Convex backend with synthetic data, and the manifests matched at every hop:

1. Convex export, then import into the backend.
2. A new player wrote on the backend.
3. Export, then `npx convex import --replace-all`.
4. Convex served that player under the same `_id`.

Sizing: export, import and backup hold the whole dataset in memory. Production's public aggregates (October 2026) are 430 puzzles, 12,233 events and 83 completed signed-in plays, which is a few MB and far below the Durable Object's 128 MB. Revisit streaming if the NDJSON passes about 30 MB.
