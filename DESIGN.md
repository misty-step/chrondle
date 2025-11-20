## Architecture Overview

**Selected Approach**: Unified Sentry + Convex metrics with error-normalizing client adapter and real toast UI  
**Rationale**: Delivers end-to-end visibility (client + Convex) with minimal surface area: one observability layer, one mutation adapter, one toast provider. Keeps interfaces tiny while hiding vendor wiring and retry quirks.

**Core Modules**

- Observability Bootstrap (Next, client/server) — initializes Sentry, sets release/env, exports capture helpers.
- Convex Observability Wrapper — decorates mutations/actions to capture, tag, and metric errors without touching business logic.
- Mutation Error Adapter — normalizes Convex errors after retries, decides Sentry capture and user-facing message.
- Toast System — renders accessible, theme-aligned toasts; exposes `addToast` universally.
- Order Submit Flow — uses adapter + toast; propagates structured `MutationError`.
- Deploy Release Tracking — CI step to create Sentry release + upload source maps.

**Data Flow**: User submits order → `useOrderGame.commitOrdering` → `useMutationWithRetry` + Error Adapter → Convex mutation (wrapped) → success/err → adapter emits Sentry + metric → returns structured error → toast displays message.

**Key Decisions**

1. Vendor isolation via `observability/` helpers to keep Sentry out of feature code (simplicity, maintainability).
2. Capture only on final retry to avoid duplicate noise (robustness).
3. Hash user identifiers before sending to Sentry to prevent PII leakage (security).
4. Toast provider replaces no-op Toaster; errors always visible to user (UX).
5. Release + source maps published in deploy workflow to correlate errors to commits (explicitness).

## Module: Observability Bootstrap (Next)

Responsibility: One-time Sentry init for client & server, exposing capture utilities.

Public Interface (new `src/observability/sentry.client.ts`):

```typescript
export function initSentryClient(): void;
export function captureClientException(error: unknown, context?: SentryContext): void;
export function setUserContext(userId?: string, authState?: "signed_in" | "anon"): void;
```

`src/observability/sentry.server.ts` (server/route handlers):

```typescript
export function initSentryServer(): void;
export function captureServerException(error: unknown, context?: SentryContext): void;
```

Internal Implementation

- Imports `@sentry/nextjs`, configures DSN, env, release, traces/Replays sample rates (env-driven).
- Guards: no-op if DSN missing to keep dev friction low.
- Redaction: hash `userId`/`clerkId` (sha256, short hash) before setting user tag; truncate ordering arrays >10 items.
- Breadcrumb defaults: mutation name, puzzleNumber, retry count.

Dependencies: `src/lib/logger`, env (`SENTRY_DSN`, `SENTRY_RELEASE`, `SENTRY_ENVIRONMENT`, sampling vars).
Used by: `src/app/layout.tsx` (client init), route handlers (server init), mutation adapter.

Error Handling

- Init errors logged via `logger.error`, do not throw.
- Capture functions swallow exceptions to avoid user-facing crashes.

## Module: Convex Observability Wrapper

Responsibility: Wrap targeted Convex mutations/actions to capture errors, classify reason, increment metrics, and optionally post Slack webhook.

Public Interface (new `convex/lib/observability.ts`):

```typescript
type FailureReason = "validation" | "auth" | "not_found" | "server" | "unknown";
export function withObservability<Args, Return>(
  fn: MutationCtxFn<Args, Return>,
  config: { name: string; tags?: Record<string, string>; slack?: boolean },
): MutationCtxFn<Args, Return>;
```

Internal Implementation

- Try/catch around `fn`.
- On error: classify reason (ArgumentValidationError → validation; missing identity → auth; not found → not_found; default → server/unknown), log via `ctx.log`/`logger`, call `captureServerException` with tags `{ convexFn, reason, env }`.
- `emitMetric("order.submit.failure", { reason, puzzleNumber })` using Convex `ctx.metrics` (or `ctx.log` if metrics unsupported).
- Optional Slack: post JSON {fn, reason, message, puzzleNumber, ts} with webhook env; failure is warn-only.
- Re-throw original error to preserve client behavior.

Dependencies: Sentry server helper, Convex metrics/logging, env (`CONVEX_SENTRY_DSN` optional, `ORDER_FAILURE_SLACK_WEBHOOK` optional).
Used by: `convex/orderPuzzles/mutations.submitOrderPlay` (wrap handler).

## Module: Mutation Error Adapter (client)

Responsibility: Normalize Convex failures after retries, capture once, feed toast system.

Public Interface (new `src/observability/mutationErrorAdapter.ts`):

```typescript
export type MutationError = {
  code: "validation" | "auth" | "network" | "server" | "unknown";
  message: string;
  retryable: boolean;
  traceId?: string;
};
export async function executeWithCapture<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  args: TArgs,
  context: { operation: string; puzzleNumber?: number; userId?: string; retries: number },
): Promise<[TResult | null, MutationError | null]>;
```

Internal Implementation

- Calls `fn`; on success returns result, null error.
- On error:
  - Map known error strings/status to codes (includes ArgumentValidationError text, auth missing, fetch failures).
  - `captureClientException` with tags (operation, retries, puzzleNumber), extras (ordering length, hints).
  - Return normalized `MutationError` with `retryable` false for validation/auth, true for network/server.
- Only capture on first observed failure per call (prevent retry noise via local flag).

Dependencies: Sentry client helper, `logger`, optional hashing util for userId.
Used by: `useOrderGame.commitOrdering`, future mutations.

## Module: Toast System

Responsibility: Provide visible, accessible feedback for failures and status.

Public Interface

- `src/components/ui/Toaster.tsx` (real implementation) renders portal + queue.
- `useToast` returns `{ toasts, addToast, removeToast }` always (no undefined).
- `addToast` signature accepts `{ title, description, variant?: "default"|"destructive", actionLabel?, onAction? }`.

Internal Implementation

- Uses React context + reducer; aria-live polite; auto-dismiss 6–8s; focusable action.
- Styling: reuse existing shadcn-like tokens; matches current typography.

Dependencies: none new; integrates in `src/app/layout.tsx` (already rendered).
Used by: `OrderGameIsland` commit failure path, other flows.

## Module: Order Submit Flow Integration

Responsibility: Wire adapter + toast in `useOrderGame` / `OrderGameIsland`.

Changes

- In `useOrderGame.commitOrdering` replace bare mutation call with `executeWithCapture`.
- Return boolean success; also return `MutationError` for UI (non-breaking by default: still boolean).
- In `OrderGameIsland` handle returned error: show destructive toast with server message, maybe retry hint; log via `logger.error`.
- Ensure retries still go through `useMutationWithRetry`; `onFinalFailure` hook used for capture once.

Interfaces

```typescript
type CommitResult = { ok: true } | { ok: false; error: MutationError };
```

(internally; external API can stay boolean for now if we prefer, but ready to expose structured).

## Module: Deploy Release Tracking (CI)

Responsibility: Correlate errors to deployments via Sentry release + source maps.

Changes in `.github/workflows/deploy.yml`

- Add Sentry action after build: `getsentry/action-release@v1` with envs `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, version `${{ github.sha }}`, env `production`.
- Upload source maps: enable `SENTRY_RELEASE` + `SENTRY_AUTH_TOKEN` + `SENTRY_URL` (default), run `pnpm sentry-cli sourcemaps upload --url-prefix "~/_next" .next` (and Convex bundle path if available).
- Wire `SENTRY_RELEASE=${{ github.sha }}` into Next/Convex build envs.

Dependencies: Sentry CLI via action, secrets stored in GH.

## Core Algorithms (Pseudocode)

### executeWithCapture

```
function executeWithCapture(fn, args, context):
  captured = false
  try:
    result = await fn(args)
    return [result, null]
  catch (err):
    errorCode = classify(err)
    message = userMessage(err, errorCode)
    retryable = errorCode in ["network","server"]
    traceId = maybeExtractTrace(err)
    if !captured:
      captureClientException(err, { tags: { op: context.operation, retries: context.retries, puzzleNumber: context.puzzleNumber }, userId: context.userId })
      captured = true
    return [null, { code: errorCode, message, retryable, traceId }]
```

### withObservability (Convex)

```
function withObservability(fn, { name, tags, slack }):
  return async (ctx, args) => {
    try:
      return await fn(ctx, args)
    catch (err):
      reason = classify(err)
      ctx.log.error("[obs]", { name, reason, message: err.message })
      captureServerException(err, { tags: { name, reason, ...tags } })
      ctx.metrics?.increment("order.submit.failure", 1, { reason, name })
      if slack: postSlack(name, reason, err.message)
      throw err
    }
  }
```

### commitOrdering integration

```
const commitOrdering = async (score) => {
  session.markCommitted(score)
  if (!auth.isAuthenticated) return { ok: true }
  const [result, error] = await executeWithCapture(submitOrderPlayMutation, payload, { operation:"submitOrderPlay", puzzleNumber, userId: auth.userId, retries: 3 })
  if (error) return { ok: false, error }
  return { ok: true }
}
```

## File Organization

```
src/
  observability/
    sentry.client.ts
    sentry.server.ts
    mutationErrorAdapter.ts
    hash.ts (small helper to hash userId)
  components/ui/Toaster.tsx           <-- replace placeholder
  components/ui/__tests__/Toaster.test.tsx
  hooks/useOrderGame.ts               <-- integrate adapter
  components/order/OrderGameIsland.tsx <-- handle toast on commit failure
convex/
  lib/observability.ts
  orderPuzzles/mutations.ts           <-- wrap submitOrderPlay
.github/workflows/deploy.yml          <-- release + sourcemaps
```

## Integration Points

- Env vars: add to `.env.example` / docs: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` (set in CI), `SENTRY_TRACES_SAMPLE_RATE` (default 0.1), `SENTRY_REPLAYS_SESSION_SAMPLE_RATE` (0.1), `CONVEX_SENTRY_DSN` (optional reuse), `ORDER_FAILURE_SLACK_WEBHOOK` (optional).
- Build: ensure `next.config.ts` keeps sourcemaps (Next default true in prod; verify not disabled).
- Deploy: GH secrets for Sentry; update deploy workflow to export `SENTRY_RELEASE` to build + action.
- Observability: keep `src/instrumentation.ts` OTEL init; do not disable Vercel ingestion.
- Security: hash user IDs; never send email; cap ordering array length in Sentry scope.

## State Management

- Client: Toast queue in context; Order state unchanged.
- Server: No new persistent state; Convex metrics are ephemeral.
- Concurrency: submit retries already exponential; adapter is idempotent per call; wrap avoids double capture.

## Error Handling Strategy

- Categories: validation (ArgumentValidationError), auth (missing identity/forbidden), network (fetch/timeout), server (500/unknown), unknown.
- Responses: adapter returns `MutationError`; UI shows toast; logger logs; Sentry captures tagged.
- Redaction: hash IDs; trim large payloads; no emails/token values.

## Testing Strategy

- Unit: adapter classification; Sentry capture guard; Toaster renders, announces; `useOrderGame` returns error tuple when mutation rejects.
- Integration: mock Convex mutation rejection (validation) -> toast shown, Sentry mocked once; retry path still attempts 3x.
- E2E: Playwright script forcing Convex 400 -> toast visible, no spinner hang.
- Commands: `pnpm test:unit`, `pnpm test:integration`, targeted `vitest` for new files; ensure `pnpm lint` + `pnpm type-check`.
- Quality gates: leverage existing CI; no new exceptions.

## Performance & Security Notes

- Perf: Sentry SDK adds small bundle; disable replays by default; lazy init on client entry.
- Budget: toast render <1ms; adapter pure; no extra network on success.
- Security: Secrets only in server/CI; web DSN acceptable; Slack webhook optional; PII hashed.
- Observability targets: trace sample 0.1; error budget alert at >1% submit failure over 10m; dashboard metrics `order.submit.failure` by reason.

## Alternative Architectures Considered

| Option                            | Pros                                                         | Cons                                                       | Verdict | Revisit Trigger                     |
| --------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- | ------- | ----------------------------------- |
| Sentry+Convex wrapper (selected)  | Full visibility, release links, minimal feature code changes | Adds dependency weight, DSN required in prod               | ✅      | If Sentry cost/latency unacceptable |
| OTEL-only (Vercel) + Slack alerts | No new vendor, traces already present                        | No session replay, weaker error UI, release linkage manual | ❌      | If Sentry blocked by compliance     |
| Client-only toast + console logs  | Fastest to ship, zero deps                                   | No backend visibility, no release tracking, weak ops       | ❌      | For offline/dev-only environments   |

## Open Questions / Assumptions

- Need Sentry org/project/DSN and auth token (owner: @productops, due: before implementation).
- Slack webhook + channel for Order failure alerts; is 1%/10m threshold acceptable? (owner: @oncall).
- Enable session replay now or defer? default off. (owner: @productops).
- Any additional PII fields to redact beyond userId hash? (owner: @security).
- Assume source maps upload allowed in CI; confirm Convex bundle path for sourcemaps (owner: @devops).
