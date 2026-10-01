# Observability & Error Tracking

Chrondle reports sanitized structured errors through its existing browser/native console and Convex logging owners. Native server records are retained by journald; Convex preserves error classification, metrics, and alert rules.

## Architecture

- **Structured error logs**: Browser console, native `chrondle.service` journal, and Convex platform logs. Canary was decommissioned; centralized remote browser error aggregation is not configured.
- **Convex Metrics**: Custom metrics for tracking business-critical events (e.g., `order.submit.failure`).
- **Slack Alerts**: Critical failure notifications (optional) via webhook.

### Key Modules

- `src/components/ClientErrorObserver.tsx`: Captures global browser errors and unhandled rejections without a testing-only window API.
- `src/observability/reporter.ts`: Stable app-facing facade that emits sanitized structured exception records through the existing logger.
- `src/observability/mutationErrorAdapter.ts`: Normalizes Convex mutation errors for the UI and structured reporting.
- `convex/lib/observability.ts`: Backend wrapper for Convex functions to capture errors and metrics.
- `convex/lib/observability/logNotifier.ts`: Emits sanitized alert records to Convex platform logs. The action producer retrieves the existing registered metrics query through `runQuery`, not nonexistent action database access.
- `src/app/(app)/api/health/route.ts`: Public `/api/health` route for uptime checks.

## Configuration

Structured error reporting requires no retired-provider key or endpoint. Private
server/deploy credentials must never be browser-public or compiler inputs.

The app-facing reporter redacts emails and compound credential fields such as
`sessionToken`, `privateKey`, and `x-api-key` before encoding structured context.
Keep context minimal; do not forward raw request headers. Convex sinks retain
the shared recognizable-token sanitizer and their existing argument exclusions.

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
4. Observes the native host build/install/activation.
5. Requires revision-bound host smoke before the public deployment receipt becomes healthy.

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
