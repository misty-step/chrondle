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
