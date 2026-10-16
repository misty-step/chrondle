# Observability & Error Tracking

Chrondle sends sanitized browser exceptions to its existing Sentry project,
`misty-step/chrondle`, alongside the structured console record. Backend error
capture is unchanged: Convex/Cloudflare platform logs retain server errors.

## Architecture

- **Browser errors**: Existing reporter and global observer use the native Sentry browser transport. No second global listener, tunnel, relay, replay or retry service.
- **Convex Metrics**: Custom metrics for tracking business-critical events (e.g., `order.submit.failure`).
- **Slack Alerts**: Critical failure notifications (optional) via webhook.

### Key Modules

- `src/components/ClientErrorObserver.tsx`: Captures global browser errors and unhandled rejections without a testing-only window API.
- `src/observability/reporter.ts`: Stable app-facing facade, sanitizer and lazy browser-only Sentry client. Server callers remain console-only.
- `src/observability/mutationErrorAdapter.ts`: Normalizes Convex mutation errors for the UI and structured reporting.
- `convex/lib/observability.ts`: Backend wrapper for Convex functions to capture errors and metrics.
- `convex/lib/observability/logNotifier.ts`: Emits sanitized alert records to Convex platform logs. The action producer retrieves the existing registered metrics query through `runQuery`, not nonexistent action database access.
- `src/app/(app)/api/health/route.ts`: Public `/api/health` route for uptime checks.

## Configuration

The existing project's public DSN has one home in `next.config.ts`, which exposes
it to the browser and admits only its exact ingest origin in CSP. No private
Sentry API/upload token is needed by the build or runtime. The release is the
existing compiled `CHRONDLE_REVISION` (full Git SHA in CI); environment is the
build's `NODE_ENV`. Never substitute a semantic version for the source revision.

The app-facing reporter redacts emails and compound credential fields such as
`sessionToken`, `privateKey`, and `x-api-key` before encoding structured context.
URL credentials, query strings and fragments, and account-ID context fields are
also redacted. The final event allowlist excludes users, requests, breadcrumbs
and ambient contexts. Native data collection disables IP inference, cookies,
headers and bodies. There is no tracing, replay, remote log or metric capture.
Keep context minimal; do not forward raw request headers. Convex sinks retain
the shared recognizable-token sanitizer and their existing argument exclusions.

The native transport keeps at most ten in-flight envelopes, drops failed sends,
and honors Sentry rate limits. It stores no offline queue. Neither loading the
SDK nor waiting for the sink blocks a game operation; a later error can succeed
after an outage. Existing Sentry workflows `3028371` (new error) and `3028386`
(new unhandled error) deliver to the existing `kaylee-alert-intake-2edba9` webhook.
Global errors/rejections retain `handled: false`; explicit reports are handled.

Verify a deployed revision in an isolated browser context: trigger a disposable
uncaught error/rejection, retrieve its event from Sentry and compare its release
with `/deployment.json`. Check the existing intake receipt for that issue. In
isolation, refuse the ingest request, continue gameplay, restore the sink and
retrieve a subsequent event. Do not add a public test-error endpoint or send
private player data. Native uptime and cron monitors are a separate slice.

| Variable                      | Description                                    | Required |
| :---------------------------- | :--------------------------------------------- | :------- |
| `ORDER_FAILURE_SLACK_WEBHOOK` | Webhook URL for critical order failure alerts. | Optional |

## Game Analytics Verification

- `GameAnalytics` uses `NEXT_PUBLIC_ANALYTICS_ENDPOINT` to flush event batches from the client.
- Set this to `/ingest/batch` for PostHog (batches are transformed in `src/lib/analytics.ts`).
- Optional fallback/custom backends should accept:

  ```json
  { "events": [ ...AnalyticsEventData... ] }
  ```

### Launch validation checklist

- Confirm events are being captured in PostHog (or your backend) for:
  - `game_loaded`
  - `game_completed`
  - `guess_submitted`
  - `state_divergence`
- Confirm these dashboard metrics can be calculated:
  - Daily active users from `game_loaded` deduped by `distinct_id`
  - Completion rate: `count(game_completed where won=true) / count(game_completed)`
  - Average guesses to solve from `guess_submitted` grouped by puzzle

## Usage

### Client-Side Mutations

Use `safeMutation` from the mutation adapter to handle errors gracefully:

```typescript
import { safeMutation } from "@/observability/mutationErrorAdapter";

const [result, error] = await safeMutation(() => myConvexMutation(args), { contextId: "123" });

if (error) {
  toast.addToast({ title: "Error", description: error.message });
}
```

### Server-Side (Convex)

Wrap sensitive mutations with `withObservability` to automatically capture errors and metrics:

```typescript
import { withObservability } from "../lib/observability";

export const myMutation = mutation({
  args: { ... },
  handler: withObservability(
    async (ctx, args) => {
      // Your logic
    },
    { name: "myMutation", slack: true }
  ),
});
```

## Deployment

The deployment workflow (`.github/workflows/deploy.yml`) automatically:

1. Waits for exact-revision CI and secret scanning before mutation.
2. Validates production credentials/configuration and live Stripe prices.
3. Deploys compatible Convex and verifies live backend puzzle/event integrity.
4. Builds and exercises the exact-revision Cloudflare Worker before activation.
5. Requires revision-bound direct/public Worker smoke and canonical webhook ingress.

Deployment failures, including a host that never completes activation, fail the
default-branch Actions run and reach Kaylee's signed GitHub agent intake. An
`alert_probe` dispatch safely exercises that route without production mutation.
See [the deployment guide](deployment-guide.md#d-verify-alert-and-recover) for
the exact failure route, recovery, and runtime readback commands.

The first automatic cutover run failed against the decommissioned Canary
authority (`fetch failed`; native transport cause `UND_ERR_CONNECT_TIMEOUT`).
It reached agent intake and incident MIS-195. The safe `alert_probe` dispatch
also failed before mutation and was recorded as a duplicate of that incident:
the current intake classifier sees `deploy.yml`, not the dispatch input. Treat
that drill as a real routed failure until the intake supports a distinct probe
marker; do not claim a dedicated test classification or silently bypass alerts.
