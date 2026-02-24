# Observability & Error Tracking

Chrondle uses a unified observability strategy to track errors and performance across the Next.js client and Convex backend.

## Architecture

- **Sentry**: Primary error tracking for both client (React/Next.js) and server (Convex functions).
- **Convex Metrics**: Custom metrics for tracking business-critical events (e.g., `order.submit.failure`).
- **Slack Alerts**: Critical failure notifications (optional) via webhook.

### Key Modules

- `src/observability/sentry.client.ts`: Client-side Sentry initialization and helpers.
- `src/observability/mutationErrorAdapter.ts`: Normalizes Convex mutation errors for the UI and Sentry.
- `convex/lib/observability.ts`: Backend wrapper for Convex functions to capture errors and metrics.

## Configuration

Environment variables required for observability:

| Variable                         | Description                                           | Required   |
| :------------------------------- | :---------------------------------------------------- | :--------- |
| `NEXT_PUBLIC_SENTRY_DSN`         | Sentry Data Source Name.                              | Yes (Prod) |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Deployment environment (`production`, `development`). | Yes        |
| `NEXT_PUBLIC_SENTRY_RELEASE`     | Release identifier (commit SHA).                      | CI/Prod    |
| `ORDER_FAILURE_SLACK_WEBHOOK`    | Webhook URL for critical order failure alerts.        | Optional   |

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

1. Injects the commit SHA as the Sentry release version.
2. Uploads source maps to Sentry for both Next.js and Convex bundles.
3. Associates errors with specific commits.
