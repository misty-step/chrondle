# Audit open GitHub issues and migrate them into .backlog.d

Priority: high
Status: done
Estimate: M

## Goal
Triage every currently open GitHub issue into an active `.backlog.d` item or a vetted non-active disposition so local planning can replace issue sprawl.

## Non-Goals
- Mirror every historical closed issue into the repo
- Close GitHub issues automatically from the workspace
- Preserve one-file-per-issue granularity when several issues share the same deep module or outcome

## Oracle
- [x] Every currently open GitHub issue in `misty-step/chrondle` is accounted for in an active backlog item or a vetted non-active disposition.
- [x] Active backlog item count is under the 30-item grooming cap.
- [x] `.backlog.d` is the local source of truth and `backlog.d` remains available as a compatibility symlink.

## Notes
- Scope: this migration covers the live open issue set only. Closed issues remain in GitHub as historical record rather than being bulk-imported into `_done/`.
- Open issue count at migration time: 35
- Active mappings:
- `002-simplify-classic-range-entry.md`: `#121`
- `003-rebuild-archive-data-path.md`: `#105`
- `004-polish-recovery-and-motion-accessibility.md`: `#208`, `#155`
- `005-improve-order-mode-affordance-and-a11y.md`: `#98`, `#114`
- `006-retire-dead-gameplay-compatibility-surfaces.md`: `#112`, `#120`, `#123`, `#106`
- `007-unify-puzzle-date-semantics-and-docs.md`: `#99`
- `008-harden-account-and-access-boundaries.md`: `#93`, `#94`, `#95`, `#162`
- `009-tighten-convex-app-contracts-and-order-persistence.md`: `#100`, `#101`, `#102`, `#103`, `#107`
- `010-harden-and-simplify-analytics-pipeline.md`: `#198`, `#197`, `#195`
- `011-complete-semantic-design-token-sweep.md`: `#207`, `#170`
- `012-centralize-frontend-platform-config-and-vendor-boundaries.md`: `#209`, `#136`, `#166`
- `013-make-leakage-learning-useful-or-remove-it.md`: `#186`
- `014-refresh-social-share-surface.md`: `#191`
- `015-codify-engineering-guardrails-and-debt-tracking.md`: `#200`, `#124`
- Existing local backlog retained: `001-strengthen-daily-habit-loop.md` remains active from prior grooming even though it is not sourced from a current open GitHub issue.
- Resolved or superseded on inspection:
- `#108` resolved by the live health endpoint in [route.ts](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/app/(app)/api/health/route.ts).
- `#165` superseded by current dynamic puzzle labels in [GamesGallery.tsx](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/components/GamesGallery.tsx), even though the implementation differs from the issue’s original SSR suggestion.
- Not migrated after vetting:
- `#122` was dropped as a speculative memoization request without evidence of a live regression and with weak fit for the repo’s current React guidance.
