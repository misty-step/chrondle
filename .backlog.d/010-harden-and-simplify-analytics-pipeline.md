# Harden and simplify analytics pipeline

Priority: medium
Status: ready
Estimate: M

## Goal
Keep analytics collection reliable without making the core game module own provider-specific logic, retry storms, or a two-step provider bootstrap waterfall.

## Non-Goals
- Change the chosen analytics vendor
- Redesign every event name or dashboard
- Move unrelated observability work into this diff

## Oracle
- [ ] [behavioral] Provider-specific payload formatting no longer lives inside the core `GameAnalytics` orchestration path.
- [ ] [behavioral] Failed analytics flushes back off and cap queue growth instead of retrying aggressively.
- [ ] [behavioral] PostHog provider initialization uses one coherent async bootstrap path rather than a two-stage waterfall.
- [ ] [test] Add or update coverage for provider selection, queue cap/backoff, and provider bootstrap behavior.
- [ ] [command] `bun run lint && bun run type-check && bun run test`

## Notes
- Related GitHub issues: `#198`, `#197`, `#195`
- Evidence: [analytics.ts](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/lib/analytics.ts) still mixes provider payload behavior into core logic; [PostHogProvider.tsx](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/components/providers/PostHogProvider.tsx) still performs a staged bootstrap.
- Precursor already shipped: closed issue `#132` established the analytics endpoint and `/ingest` path, so this item is about hardening and simplification rather than initial setup.
- Touchpoints: `src/lib/analytics.ts`, `src/components/providers/PostHogProvider.tsx`, analytics tests.
