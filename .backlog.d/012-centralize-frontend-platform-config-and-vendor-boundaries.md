# Centralize frontend platform config and vendor boundaries

Priority: medium
Status: ready
Estimate: M

## Goal
Hide frontend platform choices behind local config and adapter modules so metadata, font loading, and icon-vendor changes stop amplifying across the tree.

## Non-Goals
- Redesign brand identity or icon choices
- Replace the current icon set again in the same diff
- Pull design-token cleanup into this item

## Oracle
- [ ] [behavioral] Site metadata is sourced from one local config module rather than being redefined inline across layout metadata.
- [ ] [behavioral] Fonts load via `next/font/google` rather than raw `<link>` tags in the root layout.
- [ ] [command] `rg "@phosphor-icons/react" src/app src/components` returns only approved adapter-module imports, not direct vendor usage throughout the app surface.
- [ ] [test] Add or update coverage only where these changes alter observable output or imports.
- [ ] [command] `bun run lint && bun run type-check && bun run test`

## Notes
- Related GitHub issues: `#209`, `#136`, `#166`
- Evidence: [layout.tsx](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/app/layout.tsx) still uses raw Google Fonts links; [layout.tsx](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/app/(app)/layout.tsx) still defines metadata inline; icon imports are still spread directly across app/component files.
- Touchpoints: `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, local config module(s), icon adapter module(s), affected imports.
