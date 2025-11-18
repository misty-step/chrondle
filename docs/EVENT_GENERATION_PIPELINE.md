# Event Generation Pipeline Architecture

## Overview

Chrondle's autonomous event pipeline produces 12–18 fresh events each day to keep the puzzle pool healthy. The pipeline is intentionally simple: it selects candidate years, runs a three-stage LLM workflow (Generate → Critic → Reviser), and persists/monitors the results. All long-running work lives in Convex actions to isolate external API calls.

```
┌───────────────┐    ┌────────────┐    ┌───────────┐    ┌───────────────┐
│ Work Selector │ -> │ Generator  │ -> │ Critic    │ -> │ Reviser (loop) │
└─────┬─────────┘    └────┬───────┘    └────┬──────┘    └──────┬────────┘
      │                   │                │                 │
      ▼                   ▼                ▼                 ▼
  cron (02:00)      OpenRouter LLM   Deterministic rules   Final pass set
      │                                                       │
      └─────────────────────────► Orchestrator ◄──────────────┘
                                    │   │
                                    │   └─ generation_logs (observability)
                                    └─ events table (persistence)
```

## Key Modules

| Layer            | Location                                                                    | Responsibilities                                                                                                     |
| ---------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Work Selector    | `convex/lib/workSelector.ts`                                                | Prioritizes missing years, low-quality years, and depleted domains while balancing ancient/medieval/modern coverage. |
| Generator        | `convex/actions/eventGeneration/generator.ts`                               | Calls OpenRouter with strict prompts, validates JSON via Zod, normalizes output.                                     |
| Critic           | `convex/actions/eventGeneration/critic.ts`                                  | Applies deterministic leakage rules then LLM scoring; collects issues/rewrite hints.                                 |
| Reviser          | `convex/actions/eventGeneration/reviser.ts`                                 | Rewrites only failing events using critic hints; enforces constraints.                                               |
| Orchestrator     | `convex/actions/eventGeneration/orchestrator.ts`                            | Coordinates MAX_TOTAL_ATTEMPTS/CRITIC_CYCLES, selects best events, persists/logs, triggers alerts.                   |
| Logging & Alerts | `convex/lib/logging.ts`, `convex/lib/alerts.ts`, `convex/generationLogs.ts` | Sanitized structured logging, alert checks (zero events, cost spikes, pass-rate), monitoring queries.                |
| Cron             | `convex/crons.ts`                                                           | Schedules daily puzzle generation (00:00 UTC) and event replenishment batch (02:00 UTC).                             |
| Manual Tooling   | `scripts/test-event-generation.ts`                                          | CLI for dry-run testing of specific years or selector output.                                                        |

## Prompts & Validation

- Generator/Reviser prompts live inline in their respective actions (copied from TASK spec). They enforce: present tense ≤20 words, no numerals ≥10, no century/BCE/CE terms, proper nouns, domain/geography diversity.
- Deterministic validation (`convex/lib/eventValidation.ts`) backs the Critic stage and golden tests ensure regressions are caught (`convex/lib/__tests__/eventValidation.unit.test.ts`).

## Control Flow

1. **Cron → Work Selector:** `generateDailyBatch` runs at 02:00 UTC, requesting three years via `chooseWorkYears`.
2. **Pipeline per year:** `runGenerationPipeline(year)` loops up to 4 attempts and 2 critic cycles.
3. **Persistence:** On success, `generateYearEvents` inserts clues via `internal.events.importYearEvents` and writes to `generation_logs` with token/cost metadata.
4. **Observability:** Monitoring queries (`getDailyGenerationStats`, `getFailedYears`, `getEventPoolHealth`, `getLast7DaysCosts`) power dashboards and alerts.
5. **Alerts:** After each batch, `runAlertChecks` flags consecutive zero-event days, daily cost spikes (>2× trailing average), and degraded pass rates.

## Failure Modes & Safeguards

- **Circuit breaker:** `convex/lib/llmClient.ts` halts LLM calls after consecutive failures with auto-recovery.
- **Deterministic filters:** Catch leakage before involving another LLM pass.
- **Loop guards:** `MAX_TOTAL_ATTEMPTS = 4`, `MAX_CRITIC_CYCLES = 2` prevent runaway retries.
- **Logging:** Every action uses sanitized logging helpers so API keys never leak in console/Convex logs.

## Testing & Manual Validation

| Tool                                                                | Purpose                                                                |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm vitest run convex/lib/__tests__/eventValidation.unit.test.ts` | Golden regression coverage for leakage/proper-noun rules.              |
| `scripts/test-event-generation.ts --year 1969 --verbose`            | Manual end-to-end run without waiting for cron (supports `--dry-run`). |
| `scripts/manage-events.ts audit`                                    | Spot-check event pool quality and availability.                        |

> ⚠️ Local Vitest is currently blocked by the missing `@rollup/rollup-darwin-x64` optional dependency; install it (or reinstall under Node 20/x64) before running the suite.

## Operations Checklist

1. Ensure `.env.local` contains `NEXT_PUBLIC_CONVEX_URL`, `OPENROUTER_API_KEY`, etc.
2. Run `pnpm test` (after fixing Rollup binary) + `pnpm lint` before shipping changes.
3. For manual QA of new prompts, run `scripts/test-event-generation.ts --year <target>` and review the LLM output.
4. Monitor `generation_logs` in Convex dashboard; alerts will surface in console logs until webhook wiring is added.

## Future Enhancements

- Replace console alerts with Slack/Discord webhooks.
- Expand monitoring queries to ship via API routes for frontend dashboards.
- Add cost/pass-rate charts to `/admin` once API endpoints are wired.
