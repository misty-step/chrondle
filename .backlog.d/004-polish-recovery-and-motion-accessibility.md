# Polish recovery and motion accessibility

Priority: high
Status: ready
Estimate: S

## Goal
Make failure recovery and celebratory motion safe and accessible by fixing invalid interaction semantics and honoring reduced-motion preferences.

## Non-Goals
- Redesign the full error-boundary experience
- Replace the celebration visual system wholesale
- Bundle unrelated visual cleanup into the same diff

## Oracle
- [ ] [behavioral] `GameErrorBoundary` exposes its “Go to Today’s Puzzle” action without nesting a button inside a link.
- [ ] [behavioral] Celebration effects disable or simplify themselves when the user prefers reduced motion.
- [ ] [test] Add or extend coverage for the error-boundary navigation markup and reduced-motion celebration behavior.
- [ ] [command] `bun run lint && bun run type-check && bun run test`

## Notes
- Related GitHub issues: `#208`, `#155`
- Evidence: [GameErrorBoundary.tsx](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/components/GameErrorBoundary.tsx) still nests a button inside a link; [Celebration.tsx](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/components/ui/Celebration.tsx) still animates without a reduced-motion gate.
- Touchpoints: `src/components/GameErrorBoundary.tsx`, `src/components/ui/Celebration.tsx`, related tests.
