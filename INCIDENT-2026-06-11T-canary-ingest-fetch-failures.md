# INCIDENT: Canary TypeError Flood From PostHog Ingest Proxy

**Reported**: 2026-06-11 15:00 CDT
**Reporter**: Canary audit
**Status**: RESOLVED
**Severity**: P2 (production observability degradation, non-fatal app path)
**Duration**: 62 days undetected, remediated on 2026-06-11

---

## Executive Summary

Chrondle was healthy from a user-availability perspective, but Canary showed a long-running
production error flood: one `TypeError` group with sample message `fetch failed`, counted 2145
times in the prior 24 hours at the time of investigation. The root cause was the Next.js
PostHog proxy route at `src/app/(app)/ingest/[...path]/route.ts`: it forwarded browser analytics
traffic to PostHog with a raw upstream `fetch()` that had no local timeout and no error boundary.
When the upstream request hung or rejected, the route bubbled the failure into Next request error
capture, which then forwarded the raw `TypeError` into Canary.

The fix added a 10 second upstream timeout and converted PostHog network failures into bounded
`502` or `504` proxy responses instead of uncaught request errors. After deploying to production,
Vercel showed no `/ingest` error logs on the new deployment, `GET /api/health` remained `200`,
and Canary query data for `service=chrondle` over the last hour dropped to zero errors. The
historical 24 hour group still existed immediately after deploy, but its `last_seen` timestamp
remained frozen at `2026-06-11T13:54:43.160133295Z`, confirming that no new events were added
after the fix went live.

---

## Timeline (UTC)

| Time                | Event                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-10 06:46:58 | Canary first saw the `TypeError: fetch failed` group for `chrondle`                                                       |
| 2026-04-15 16:01:34 | The pre-fix production deployment that later served the failing route was created on Vercel                               |
| 2026-06-11 18:54:43 | Last pre-fix occurrence recorded in Canary for the historical error group                                                 |
| 2026-06-11 19:00    | Incident investigation began from Canary audit evidence (`2145` errors in 24h)                                            |
| 2026-06-11 19:10    | Production Vercel logs confirmed repeated failures on `/ingest/i/v0/e` and `/ingest/e` while `/api/health` stayed healthy |
| 2026-06-11 20:11    | Regression tests added for rejected and aborted upstream fetches                                                          |
| 2026-06-11 20:12    | Route patched to add upstream timeout and bounded `502/504` responses                                                     |
| 2026-06-11 20:13    | Full local test gate passed (`1958` tests green)                                                                          |
| 2026-06-11 20:17    | Fix committed on `fix/canary-ingest-fetch-failures` as `3fd9b3f` and pushed                                               |
| 2026-06-11 20:20    | Production deployment `dpl_C8sVyRYfuQkNdNByUMqjzeybXuYt` created and aliased                                              |
| 2026-06-11 20:21:58 | Post-deploy read-only verification showed `/api/health` = `200` and Canary `1h` window = zero errors                      |

---

## Root Cause Analysis

### The Actual Problem

The browser-side PostHog SDK is configured with `api_host: "/ingest"` in
`src/components/providers/PostHogProvider.tsx`, so production analytics traffic is intentionally
routed through Chrondle's proxy route rather than directly to PostHog.

That proxy route previously did this:

1. Accept `/ingest/*` traffic from the browser.
2. Build the upstream PostHog URL.
3. Call `await fetch(targetUrl, ...)`.
4. Return the upstream response.

The route did **not**:

- enforce a local timeout shorter than Vercel's runtime timeout
- catch upstream network failures
- convert upstream fetch failures into bounded HTTP responses

When PostHog upstream requests hung or rejected:

1. the route threw instead of returning a response
2. Next.js `onRequestError` captured the request failure
3. `src/instrumentation.ts` forwarded the error into Canary
4. Canary grouped the raw `TypeError: fetch failed`
5. the flood repeated on every affected analytics request while app health stayed green

### Why Health Stayed Green

`/api/health` checks Convex availability, not PostHog reachability. That meant the production app
could be functionally up while the observability/analytics proxy kept failing. This is why Canary
and Vercel logs, not health alone, were necessary to diagnose the issue.

### Evidence Chain

| Check                                        | Expected                           | Actual                                                              | Conclusion                               |
| -------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| Canary `24h` query before fix                | One active group                   | `TypeError`, `fetch failed`, count `2145`                           | Real flood confirmed                     |
| Canary `24h` group metadata                  | Recent `last_seen`                 | `2026-06-11T13:54:43.160133295Z`                                    | Active before deploy                     |
| Production Vercel logs on pre-fix deployment | Route-level failures               | repeated `POST /ingest/i/v0/e` and `/ingest/e` failures             | Failure path attributed to PostHog proxy |
| Production health                            | Healthy core app                   | HTTP `200` with `{ "status": "ok", "convex": "ok" }`                | App was up despite proxy failures        |
| Route code inspection                        | bounded failure handling           | raw upstream `fetch()` with no catch or timeout                     | Root cause in code path                  |
| Post-deploy Vercel logs on new deployment    | `/ingest` errors should stop       | zero `/ingest` error lines in 15m window                            | Error path stopped on new deploy         |
| Canary `1h` query after deploy               | zero active errors                 | `{ total_errors: 0, group_count: 0, groups: [] }`                   | Flood stopped                            |
| Canary `24h` query after deploy              | old group may persist historically | group still present, but `last_seen` unchanged from pre-deploy time | Historical residue only; no new events   |

---

## Why The Error Flooded

This route sits on a high-volume path:

- PostHog browser ingestion uses `/ingest/e` and `/ingest/i/v0/e`
- Chrondle's own `GameAnalytics` path can also use `/ingest/batch`
- every affected request had the potential to trigger the same uncaught failure pattern

A single missing timeout and catch on a hot proxy path therefore became an observability flood
instead of a contained degraded dependency.

---

## Fix Applied

### Code Change

`src/app/(app)/ingest/[...path]/route.ts`

- added `createTimeoutSignal(10_000)` around the upstream PostHog fetch
- caught upstream failures instead of letting them escape the route
- translated timeout/abort failures into `504`
- translated other upstream fetch failures into `502`
- preserved `HEAD` semantics with an empty body

### Regression Coverage

`src/app/(app)/ingest/[...path]/route.unit.test.ts`

- added a regression test for `TypeError("fetch failed")` returning `502`
- added a regression test for upstream `AbortError` returning `504`

---

## Verification

### Local Verification

```bash
bun run test -- src/app/(app)/ingest/[...path]/route.unit.test.ts
bun run type-check
bun run lint
bun run test
```

Results:

- targeted route regression test: passed
- `tsc --noEmit --incremental`: passed
- `eslint . --max-warnings=0`: passed
- full test suite: `150` test files passed, `1958` tests passed, `3` skipped

### Review Verification

- Independent fresh-context Grok review verdict: `NO_BLOCKERS`
- Claude review lane hung and was discarded as a failed lane, not a blocker

### Production Verification

Deployment:

- commit: `3fd9b3f` (`fix: bound ingest proxy upstream failures`)
- deployment id: `dpl_C8sVyRYfuQkNdNByUMqjzeybXuYt`
- deployment url: `https://chrondle-bxxf90nw2-misty-step.vercel.app`
- inspector: `https://vercel.com/misty-step/chrondle/C8sVyRYfuQkNdNByUMqjzeybXuYt`

Post-deploy checks:

```bash
curl -fsS -i https://www.chrondle.app/api/health
curl -sSI https://www.chrondle.app/ingest/batch
env -u VERCEL_TOKEN npx vercel logs --deployment dpl_C8sVyRYfuQkNdNByUMqjzeybXuYt --since 15m --no-follow --level error --json --limit 200
```

Observed:

- `/api/health` returned HTTP `200` with `{ "status": "ok", "convex": "ok" }`
- `/ingest/batch` returned a fast bounded HTTP `400` on the live route
- Vercel logs for the new deployment contained `0` error log lines in the 15 minute post-deploy window
- a direct log probe on the new deployment recorded `HEAD /ingest/batch` with `responseStatusCode: 400`, confirming the live alias was serving the new route

### Canary Verification

Parent read-only evidence at `2026-06-11T20:21:58Z`:

- `GET /api/v1/query?service=chrondle&window=1h` returned:
  `{ total_errors: 0, group_count: 0, groups: [] }`
- `GET /api/v1/query?service=chrondle&window=24h` still contained the historical group with:
  - `group_hash: d60d2e08fd8ccae362f0f74181027fb22dd83a0752e97bc372211cd2c459cacf`
  - `count: 2145`
  - `sample_message: fetch failed`
  - `last_seen: 2026-06-11T13:54:43.160133295Z`

Interpretation:

- the `1h` window proved the error flood stopped
- the `24h` window still showed the historical cluster, but `last_seen` did not advance after deployment
- therefore the group was historical residue, not continued post-deploy failure

---

## Prevention

1. Any proxy route that forwards to an external system should own its own timeout boundary rather
   than inheriting the platform runtime timeout.
2. High-volume ingest/proxy paths must catch and translate upstream failures into bounded HTTP
   responses.
3. Production observability incidents need both health checks and dependency-path logs; health-only
   checks miss degraded-but-live services.
4. Canary write-only ingestion keys are not enough for local readback during incidents; operator
   workflows should also expose a query-capable read path for responders.

---

## Residual Risks

- The new tests cover rejected fetches and aborted fetches, but they do not explicitly cover
  synchronous throws before the awaited upstream fetch resolves, or `createTimeoutSignal` itself
  throwing unexpectedly.
- If PostHog is unavailable again, clients may still receive `502` or `504` responses on analytics
  calls; that is acceptable degraded behavior, but user-facing analytics loss remains possible while
  the dependency is down.
- Vercel still reports an unrelated middleware deprecation warning during build (`middleware` to
  `proxy` migration). This incident did not address that warning.

---

## Files Changed

- `src/app/(app)/ingest/[...path]/route.ts`
- `src/app/(app)/ingest/[...path]/route.unit.test.ts`
