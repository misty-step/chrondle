# Complete semantic design token sweep

Priority: medium
Status: ready
Estimate: M

## Goal
Finish the move from raw hex values and primitive Tailwind status colors to semantic design tokens across the product surface.

## Non-Goals
- Redesign the visual identity from scratch
- Bundle icon-adapter or font-loading work into this item
- Rewrite stable components just to chase style preferences

## Oracle
- [ ] [behavioral] Success and error states use semantic tokens rather than `text-green-*`, `text-red-*`, or raw hex shortcuts.
- [ ] [command] `rg "text-green-|text-red-|#[0-9a-fA-F]{3,6}" src/app src/components src/styles` returns only intentional token definitions or approved asset data.
- [ ] [test] Update any tests that still assert raw color values.
- [ ] [command] `bun run lint && bun run type-check && bun run test`

## Notes
- Related GitHub issues: `#207`, `#170`
- Evidence: open token-sweep issues still reference remaining raw color usage, and [EraToggle.tsx](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/components/ui/EraToggle.tsx) still shows direct color literals.
- Touchpoints: `src/app/globals.css`, affected components across `src/components/`, and related UI tests.
