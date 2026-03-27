# Codify engineering guardrails and debt tracking

Priority: low
Status: ready
Estimate: S

## Goal
Turn security-hotfix scope isolation and TODO/debt visibility into repo-enforced conventions instead of one-off reminders.

## Non-Goals
- Rebuild the entire contributing guide
- Auto-close GitHub issues from code comments in the first pass
- Replace the new `.backlog.d` system with another tracker

## Oracle
- [ ] [behavioral] Security hotfix scope-isolation guidance is captured in a durable repo artifact such as a PR template, playbook, or checklist.
- [ ] [behavioral] Code TODOs are triaged into an explicit convention or enforcement rule instead of accumulating as free-form comments.
- [ ] [command] `rg "TODO" src convex scripts` no longer returns untracked debt comments that violate the chosen convention.
- [ ] [command] `bun run lint && bun run type-check && bun run test`

## Notes
- Related GitHub issues: `#200`, `#124`
- Evidence: issue `#200` captures scope-creep risk in security fixes, and issue `#124` captures the repo’s scattered TODO debt.
- Touchpoints: contributing docs, PR template/checklists, TODO policy enforcement, `.backlog.d` maintenance conventions.
