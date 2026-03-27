# Unify puzzle date semantics and docs

Priority: high
Status: ready
Estimate: M

## Goal
Choose one explicit daily-puzzle date model across classic mode, Order mode, countdown behavior, and project documentation, then make the implementation and docs agree.

## Non-Goals
- Change historical scoring or archive visibility policy
- Introduce answer-leaking timing hints
- Bundle unrelated cron infrastructure cleanup into the same diff

## Oracle
- [ ] [behavioral] Classic and Order daily puzzle retrieval follow the same documented date semantics.
- [ ] [behavioral] Countdown text and rollover behavior match the chosen semantics.
- [ ] [test] Add or update coverage for the chosen date boundary behavior.
- [ ] [command] `bun run lint && bun run type-check && bun run test`

## Notes
- Related GitHub issues: `#99`
- Evidence: code comments in [GameIsland.tsx](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/components/GameIsland.tsx) and hooks under `src/hooks/useTodaysPuzzle.ts` describe local-date behavior, while repo docs still describe Central Time or UTC-centric scheduling in multiple places.
- Touchpoints: `src/hooks/useTodaysPuzzle.ts`, `src/hooks/useTodaysOrderPuzzle.ts`, `src/hooks/useCountdown.ts`, `convex/puzzles/queries.ts`, `convex/orderPuzzles/queries.ts`, `README.md`, `CLAUDE.md`.
