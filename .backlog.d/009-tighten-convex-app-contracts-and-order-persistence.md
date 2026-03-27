# Tighten Convex app contracts and Order persistence

Priority: high
Status: ready
Estimate: L

## Goal
Make the Order-mode client/server boundary mechanically enforced through shared contracts, persistence tests, and CI checks, while removing direct Convex-to-`src/` coupling.

## Non-Goals
- Rewrite the full Order gameplay surface
- Replace Convex with another backend
- Expand this item into unrelated analytics or archive work

## Oracle
- [ ] [behavioral] Order submission payloads are typed from the authoritative Convex validator surface or a shared contract that cannot silently drift.
- [ ] [behavioral] Reloading an authenticated Order completion after submit preserves the completed state end-to-end.
- [ ] [command] `rg "import .*src/" convex` returns no remaining Convex-to-`src/` boundary violations.
- [ ] [test] Add or update unit, integration, and E2E coverage for exact payload shape and authenticated persistence.
- [ ] [command] CI fails when Convex generated files or declared contract checks drift from committed state.
- [ ] [command] `bun run lint && bun run type-check && bun run test`

## Notes
- Related GitHub issues: `#100`, `#101`, `#102`, `#103`, `#107`
- Evidence: [useOrderGame.ts](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/hooks/useOrderGame.ts) still sends a client `userId` field into `submitOrderPlay`; issue `#103` remains only partially satisfied by existing generated-file verification; issue `#107` captures the broader Convex-to-app domain leakage.
- Touchpoints: `src/hooks/useOrderGame.ts`, `convex/orderPuzzles/mutations.ts`, Order-mode tests under `src/hooks/` and `convex/orderPuzzles/`, CI workflow and Convex verification scripts.
