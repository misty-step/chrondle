# Restore local backlog mirror

Priority: medium
Status: done
Estimate: S

## Goal
Reintroduce a repo-local backlog surface so grooming output, active priorities, and execution order are visible in the workspace even if GitHub issues remain canonical.

## Non-Goals
- Mirror every GitHub issue into the repository
- Automate issue sync in the first pass
- Replace GitHub as the long-term system of record unless the team chooses that later

## Oracle
- [x] `backlog.d/` exists in the repo and contains the active priorities from the current grooming session.
- [x] Each active backlog item includes `Goal`, `Non-Goals`, and `Oracle` sections.
- [x] A completed item exists under `backlog.d/_done/` to preserve the fact that the local mirror was restored during this session.

## Notes
- Evidence: this workspace had no `backlog.d/`, `project.md`, or `BACKLOG.md` when the grooming session started.
- Reason for completion now: creating `backlog.d/` and the prioritized items in this session satisfies the lightweight local-mirror recommendation immediately.
