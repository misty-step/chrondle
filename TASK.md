# PRD — Observability + Order Mutation Surfacing + Deploy Tracking (2025-11-20)

## 1) Executive Summary

- Problem: Order submissions silently fail on Convex validation; no Sentry; deployments untagged—ops is blind and users think “button does nothing.”
- Solution: Ship Sentry across Next + Convex, surface mutation errors with actionable toasts, emit Convex metrics + Slack alert on `orderPuzzles.submitOrderPlay` failures, and tag every deploy with a Sentry release.
- User value: Players get instant error feedback; oncall can triage with stack traces + release linkage; PMs see failure rates drop.
- Success: 100% Convex errors captured in Sentry with puzzle/user context; toast shown within 1s on any submit failure; deploy workflow creates Sentry release per commit; alert fires if Order submit failure rate >1% over 10m.

## 2) User Context & Outcomes

- Players: need clear, fast feedback when submission rejected; avoid repeated taps.
- Support/oncall: need trace + request context for Convex/Next errors and link to failing release.
- Product/analytics: need failure-rate metric to spot regressions; want “which deploy broke submit.”

## 3) Requirements

**Functional**

- When `orderPuzzles.submitOrderPlay` rejects (validation/auth/network/server):
  - Client shows toast with sanitized server message + retry hint; message logged to Sentry with puzzleNumber, puzzleId, userId (hashed), auth state, ordering length, hint count.
  - `commitOrdering` returns structured error (`code`, `message`, `retryable`).
  - Retries (useMutationWithRetry) still happen; on final failure fire toast/Sentry once.
- Convex side: capture and tag any error in order mutations/actions; increment metric with reason code (validation/auth/server/other).
- Next side: ErrorBoundary + server handlers send uncaught errors to Sentry; keep logger as fallback.
- Deployment: `deploy.yml` publishes Sentry release with commit SHA; source maps uploaded for Next and Convex bundles.

**Non-functional**

- Perf: Added instrumentation adds <30ms per request; Sentry sampling configurable (default traces 0.1, sessions 0.1, profiles off).
- Reliability: Toast fires even if Sentry DSN missing (console fallback); Convex metric emission never throws.
- Security/PII: No plaintext emails; hash userId/clerkId before sending; redact ordering array >10 items; DSN + webhook pulled from env, never logged.
- Accessibility: Toast is aria-live polite, 4–8s, focusable link to retry docs if present.

**Infrastructure**

- Quality gates: keep pnpm lint/type-check/test green; add unit for error path + integration for submit failure; ensure codegen unchanged.
- Observability: Sentry DSN/env loaded; structured logger stays; Vercel OTEL not broken; Convex logs keep reason codes.
- Design consistency: reuse existing UI tokens; toast styling matches current components.
- Security: Secrets via env/Secrets store; CI masks SENTRY_AUTH_TOKEN and Slack webhook; no client bundle leakage of secrets.

## 4) Architecture Decision

**Chosen**: Unified Sentry + Convex metric booster

- Thin init modules hide vendors: `src/observability/sentry.client.ts`, `sentry.server.ts`, `src/observability/convexSentry.ts` (lazy init, opt-out if DSN missing).
- Error adapter wraps `useMutationWithRetry` to normalize Convex errors → `MutationError` and capture once.
- Toast provider replaces placeholder `Toaster` with context + portal; `useToast` returns `addToast` always.
- Convex decorator wraps target mutations/actions to capture, tag, and metric increment; logs stay simple for dashboards.
- CI deploy step creates Sentry release + uploads source maps; release id wired into Next/Convex via env.

**Alternatives (weighted by Value 40 / Simplicity 30 / Explicitness 20 / Risk 10)**

- A) Sentry everywhere + metrics (chosen): 38+26+18+8 = **90**. Clear traces, release links, user feedback; added deps but contained.
- B) Vercel OTEL + console + Slack only: 24+28+12+9 = **73**. Simpler, no new vendor; lacks session replay, release correlation, user-visible stack traces.
- C) Client-only toasts + server console logs: 22+30+14+6 = **72**. Easiest; zero backend visibility, no deploy tracking.

**Module boundaries**

- `observability/` deep modules expose `captureException`, `setUser`, `addBreadcrumb`, `recordDeploymentRelease`—internals hide vendor.
- `hooks/useMutationWithRetry` gains optional `onFinalFailure` to avoid callers knowing Sentry specifics.
- Convex wrapper `withObservability(mutation)` centralizes capture+metric; callers pass tags only.
- UI `ToastProvider` owns queue/render; Order flows just call `toast.error(...)`.

## 5) Data & API Contracts

- Env (Next build/runtime): `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE` (default 0.1), `SENTRY_REPLAYS_SESSION_SAMPLE_RATE` (default 0.1), `SENTRY_RELEASE` (commit SHA), `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (CI only).
- Env (Convex): `CONVEX_SENTRY_DSN` (or reuse `SENTRY_DSN`), `ORDER_FAILURE_SLACK_WEBHOOK` (optional).
- Client error object: `{ code: "validation"|"auth"|"network"|"server"|"unknown"; message: string; retryable: boolean; traceId?: string }`.
- Metric names: `order.submit.failure` (labels: reason, env, puzzleNumber), `order.submit.success`.
- Toast payload: `{ title, description, variant, action? }`; default destructive variant for failures.
- Release version: `${git_sha}`; environment: `production|preview|dev`.

## 6) Implementation Phases

- MVP (day 1): Add Sentry Next init + ErrorBoundary capture; wrap `useMutationWithRetry` final failure hook; surface toast with server message; structured logging for submit failures.
- Hardening (day 2-3): Convex observability wrapper + metrics + Slack webhook; hash user context; source-map upload + release step in `deploy.yml`; add tests.
- Future: Enable Sentry replays for authenticated sessions (sample 0.05); add dashboard for Order failure rate; correlate OTEL traces to Sentry via trace IDs.

## 7) Testing & Observability

- Unit: `useOrderGame` returns structured error; toast renders on failure; logger called with context.
- Integration: Simulated Convex ArgumentValidationError triggers toast + Sentry mock; `useMutationWithRetry` retry/exhaust path preserved.
- E2E (Playwright/CI): Play Order, force server 400, expect toast + no infinite spinner.
- Observability checks: Dry-run Sentry init when DSN missing; verify release + sourcemaps uploaded; Convex metric visible in dashboard; Slack webhook receives sample payload.

## 8) Risks & Mitigations

| Risk                                  | Likelihood | Impact | Mitigation                                            |
| ------------------------------------- | ---------- | ------ | ----------------------------------------------------- |
| Sentry bundle weight/regression       | Med        | Med    | Tree-shake browser SDK, sample replays low, lazy init |
| PII leakage in events                 | Low        | High   | Hash IDs, drop emails, scrub ordering >10 items       |
| Convex build fails due to Sentry deps | Med        | Med    | Isolate init file, guard on env, add size check in CI |
| Double-reporting from retries         | Med        | Med    | Capture only on final failure flag                    |
| Slack webhook unavailable             | Med        | Low    | Fail-soft, log warning, keep Convex metric            |

## 9) Open Questions / Assumptions

- Which Sentry plan/org/project to target? (need DSN + auth token)
- Preferred alert channel for Order failures (Slack channel + webhook)? Thresholds OK at 1%/10m?
- Is session replay desired now or later? (default off)
- Any PII fields we must never send beyond hashed IDs? (email currently excluded by plan)
- Can we add a lightweight ToastProvider now, or should we fold into broader UX/Toaster backlog?
