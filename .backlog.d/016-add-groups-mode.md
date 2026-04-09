# Add Groups mode

Priority: medium
Status: done
Estimate: L

## Goal

Add a third daily mode with a 4x4 grid of historical events where players discover four hidden exact years by grouping four events at a time under a four-mistake budget.

## Non-Goals

- Clone NYT naming or branding
- Rebuild Classic and Order on top of a new generic puzzle engine before shipping this mode
- Depend on full event-metadata backfill before a V1 launch
- Reveal or infer hidden years before the player earns a correct group

## Oracle

- [x] [behavioral] The product exposes a third mode alongside Classic and Order and all mode-switching surfaces route to the correct daily puzzle.
- [x] [behavioral] A player can select exactly four events and submit a group guess; exact groups lock in, exact 3/4 near misses return `One away`, and four incorrect submissions end the run.
- [x] [behavioral] Each solved group reveals one exact year and one difficulty tier (`easy`, `medium`, `hard`, `very hard`) without leaking the unsolved groups.
- [ ] [behavioral] Daily generation for the mode produces four years with four events each from the shared pool and rejects boards that violate fairness or ambiguity constraints.
- [x] [test] Add or extend coverage for board generation, one-away feedback, mistake-budget enforcement, solved-state persistence, archive access checks, and pool-health mode math.
- [x] [command] `bun run lint && bun run type-check && bun run test`

## Notes

- Current preferred spec: [groups-mode.md](/Users/phaedrus/Development/chrondle/docs/specs/groups-mode.md)
- Existing adjacent idea: [matchmaker-game.md](/Users/phaedrus/Development/chrondle/docs/specs/matchmaker-game.md) is retained as an archived alternative, not the current third-mode direction.
- Evidence: the shared event pool already supports independent per-mode usage in [schema.ts](/Users/phaedrus/Development/chrondle/convex/schema.ts); existing daily-generation patterns in [generation.ts](/Users/phaedrus/Development/chrondle/convex/puzzles/generation.ts) and [mutations.ts](/Users/phaedrus/Development/chrondle/convex/orderPuzzles/mutations.ts) are directly reusable; a live pool check on April 8, 2026 showed 12,233 total events, 10,156 unused across both current modes, and 1,429 years currently ready in the shared pool.
- Main risk: fairness, not corpus size. Board construction must reject event sets with multiple plausible partitions or overly confusable adjacent years.
- Touchpoints: `convex/schema.ts`, `convex/puzzles/`, `convex/orderPuzzles/`, new mode-specific Convex tables/queries/mutations, `src/components/GamesGallery.tsx`, `src/components/ModeDropdown.tsx`, `src/components/GameModeLayout.tsx`, archive/admin surfaces, and new game-state hooks/components.

## What Was Built

- Added a full third mode, `groups`, across the shared event pool, daily generation, archive views, admin dashboard, sitemap, and mode-switching surfaces.
- Added dedicated Convex tables and APIs for `groupsPuzzles` and `groupsPlays`, including daily generation, authenticated submission handling, reveal-state persistence, archive progress reads, and per-mode event usage tracking through `events.groupsPuzzleId`.
- Built the Groups game client flow: daily page, archive page, board UI, reveal UI, selection/shuffle/clear controls, server-backed progress recovery, share text, and auth-aware empty/error states.
- Hardened the mode after review: server-side archive entitlement checks for archived Groups puzzles, no public solver-probe mutation, server-authoritative mistake counting and solved-group progression, fixed archive completion summaries, fixed Groups admin mode filtering, and updated pool-health math/sitemap generation for the third mode.

## Workarounds

- The fairness oracle remains partially open. Generation currently enforces board shape, year availability, deterministic seeding, and tier assignment, but it does not yet run a semantic ambiguity-rejection pass over candidate boards.
- Browser QA and demo artifacts were not produced in this pass because no browser automation/evidence pipeline was available in the local toolset.
