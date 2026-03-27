# Strengthen the daily habit loop

Priority: high
Status: ready
Estimate: M

## Goal
Make the default player path start today's puzzle immediately and give solvers an explicit next-day return hook once they finish.

## Non-Goals
- Rework scoring, hint semantics, or puzzle-integrity rules
- Redesign every game mode surface in one pass
- Add retention mechanics that leak answer-era information

## Oracle
- [ ] [behavioral] Visiting `/` presents a primary path into today's daily puzzle without requiring a mode-selection detour first.
- [ ] [behavioral] Completing a puzzle surfaces an explicit return or reminder CTA, using the existing notification capability where appropriate, instead of only passive countdown/share affordances.
- [ ] [test] Add or extend coverage for the home entry path and the completion-state return CTA.
- [ ] [command] `bun run lint && bun run type-check && bun run test`

## Notes
- Origin: local grooming synthesis retained during the GitHub-issue migration. No current open GitHub issue captures this end-to-end habit-loop gap cleanly.
- Evidence: the first-touch experience starts in [GamesGallery.tsx](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/components/GamesGallery.tsx) as a mode chooser instead of a direct play path; the main shell remains busy in [AppHeader.tsx](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/components/AppHeader.tsx); the current completion flow is passive in [GameComplete.tsx](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/components/modals/GameComplete.tsx); settings currently foreground billing only in [page.tsx](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/app/(app)/settings/page.tsx).
- Touchpoints: `src/components/GamesGallery.tsx`, `src/components/AppHeader.tsx`, `src/components/modals/GameComplete.tsx`, `src/app/(app)/settings/page.tsx`, notification/reminder UI if already present.
- Constraint: preserve the Prime Directive from `CLAUDE.md`; no UI changes may hint at the answer or auto-infer the era.
