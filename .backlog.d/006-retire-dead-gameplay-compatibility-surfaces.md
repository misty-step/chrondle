# Retire dead gameplay compatibility surfaces

Priority: high
Status: ready
Estimate: L

## Goal
Reduce hidden coupling in gameplay state by decomposing the god-hook session path and deleting dead compatibility code that invites the wrong execution paths.

## Non-Goals
- Change live scoring rules for either game mode
- Redesign authenticated versus anonymous product behavior
- Sweep archive-query work into this item

## Oracle
- [ ] [behavioral] Session management responsibilities are split so authenticated and anonymous persistence paths no longer live in one branching god hook.
- [ ] [command] `rg "calculateOrderScore|OrderScore|@deprecated Use AttemptScore|saveProgress\\(|loadProgress\\(|saveSettings\\(|loadSettings\\(" src convex` returns no live production compatibility surface that should have been deleted.
- [ ] [test] Add or update coverage around the new session boundaries and any dead-code removals that affect imports.
- [ ] [command] `bun run lint && bun run type-check && bun run test`

## Notes
- Related GitHub issues: `#112`, `#120`, `#123`, `#106`
- Evidence: [useLocalSession.ts](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/hooks/data/useLocalSession.ts) still carries both authenticated and anonymous branching; open issues `#120` and `#123` identify stale Order scoring/types; [gameState.ts](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/lib/gameState.ts) still contains legacy storage helpers.
- Touchpoints: `src/hooks/data/useLocalSession.ts`, `src/lib/gameState.ts`, `src/lib/order/`, `src/types/orderGameState.ts`, related tests.
