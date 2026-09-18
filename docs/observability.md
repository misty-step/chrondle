# Observability & Error Tracking

Chrondle uses Canary for error reporting and health visibility across the Next.js client, Next.js server hooks, and Convex backend.

## Architecture

- **Canary**: Primary error tracking and uptime/health monitoring for client, server, and Convex alert events.
- **Convex Metrics**: Custom metrics for tracking business-critical events (e.g., `order.submit.failure`).
- **Slack Alerts**: Critical failure notifications (optional) via webhook.

### Key Modules

- `src/components/CanaryClientObserver.tsx`: Captures browser global errors and exposes `window.ChrondleCanary` for smoke tests.
- `src/observability/reporter.ts`: Stable app-facing error reporting facade.
- `src/observability/canary.ts`: Canary HTTP ingest implementation.
- `src/observability/mutationErrorAdapter.ts`: Normalizes Convex mutation errors for the UI and Canary.
- `convex/lib/observability.ts`: Backend wrapper for Convex functions to capture errors and metrics.
- `convex/lib/observability/canaryNotifier.ts`: Sends Convex alert notifications to Canary.
- `src/app/(app)/api/health/route.ts`: Public `/api/health` route for uptime checks.

## Configuration

Environment variables required for observability:

| Variable                         | Description                                                                                                                   | Required   |
| :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- | :--------- |
| `NEXT_PUBLIC_CANARY_API_KEY`     | Raw Canary `ingest-only` key embedded for browser error capture. Use `sk_live_...`, not `KEY-*`. Never use an admin/read key. | Yes (Prod) |
| `NEXT_PUBLIC_CANARY_ENDPOINT`    | Canary base URL. Defaults to `https://canary.mistystep.io`.                                                                   | Optional   |
| `NEXT_PUBLIC_CANARY_ENVIRONMENT` | Deployment environment (`production`, `development`).                                                                         | Yes        |
| `CANARY_API_KEY`                 | Raw server and Convex Canary `ingest-only` key. Use `sk_live_...`, not `KEY-*`. Never use an admin/read key.                  | Yes (Prod) |
| `CANARY_ENDPOINT`                | Server and Convex Canary base URL. Defaults to `https://canary.mistystep.io`.                                                 | Optional   |
| `ORDER_FAILURE_SLACK_WEBHOOK`    | Webhook URL for critical order failure alerts.                                                                                | Optional   |

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

1. Requires browser and server Canary ingest keys before production deployment.
2. Builds the app with Canary endpoint, key, and environment values.
3. Updates Convex runtime Canary configuration before deploying backend functions.
4. Verifies the deployment with `bun run deploy:verify`.
5. Exposes `/api/health` for Canary uptime checks.
