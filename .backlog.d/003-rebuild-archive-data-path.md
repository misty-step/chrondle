# Rebuild archive data path

Priority: high
Status: ready
Estimate: L

## Goal
Delete the stubbed `src/lib/puzzleData.ts` compatibility path and move archive/count consumers onto live Convex data with indexed pagination so archive state cannot silently drift behind fake defaults or degrade as puzzle volume grows.

## Non-Goals
- Redesign archive monetization, pagination, or visual layout
- Sweep unrelated gameplay-state refactors into the same diff
- Change Convex schema unless the live query surface truly requires it

## Oracle
- [ ] [behavioral] Archive/count surfaces render from live Convex-backed values rather than zero-count or always-valid compatibility defaults.
- [ ] [behavioral] Classic and Order archive queries avoid full-table scans and manual in-memory pagination on the hot page-load path.
- [ ] [command] `rg "from \"@/lib/puzzleData\"|fetchTotalPuzzles|TOTAL_PUZZLES|validatePuzzleData" src convex` returns no live production references outside tests or archived notes.
- [ ] [command] `rg "collect\\(|slice\\(" convex/puzzles/queries.ts convex/orderPuzzles/queries.ts` shows no archive pagination path that still performs full scans and manual page slicing.
- [ ] [test] Add or extend regression coverage for the affected archive/count consumer path.
- [ ] [command] `bun run lint && bun run type-check && bun run test`

## Notes
- Related GitHub issues: `#105`
- Evidence: [puzzleData.ts](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/lib/puzzleData.ts) still exposes `total_puzzles = 0`, `TOTAL_PUZZLES = 0`, and `validatePuzzleData()` returning `true`; [ClassicArchivePuzzleClient.tsx](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/components/classic/ClassicArchivePuzzleClient.tsx) still consumes `fetchTotalPuzzles()`; archive queries in [queries.ts](/Users/phaedrus/.codex/worktrees/087b/chrondle/convex/puzzles/queries.ts) and [queries.ts](/Users/phaedrus/.codex/worktrees/087b/chrondle/convex/orderPuzzles/queries.ts) still use `collect()` plus `slice()` on the archive path.
- Touchpoints: `src/lib/puzzleData.ts`, `src/components/classic/ClassicArchivePuzzleClient.tsx`, `convex/puzzles/queries.ts`, `convex/orderPuzzles/queries.ts`, and nearby archive tests.
- Follow-up candidate, not part of this item: inert diagnostics around `useRangeGame()` and `manualGeneratePuzzle()` should either emit useful signals or be deleted in a later pass.
