# Harden account and access boundaries

Priority: high
Status: ready
Estimate: L

## Goal
Close the remaining account, play-read, webhook, and streak-merge trust gaps so access decisions and user data flow only through authenticated server-owned boundaries.

## Non-Goals
- Rebuild the entire auth stack
- Change subscription product behavior beyond what is needed for safety and correctness
- Fold Order submission contract work into this item

## Oracle
- [ ] [behavioral] Classic and Order play-read APIs no longer accept arbitrary `userId` values to read another user’s progress.
- [ ] [behavioral] The Clerk webhook fails closed when `CLERK_WEBHOOK_SECRET` is missing instead of attempting verification with an empty string.
- [ ] [behavioral] Anonymous streak merge is idempotent or replay-resistant enough that repeated identical merge attempts cannot inflate streaks.
- [ ] [test] Add coverage for `trialEndsAt` precedence in archive access and the hardened read/merge/webhook boundaries.
- [ ] [command] `bun run lint && bun run type-check && bun run test`

## Notes
- Related GitHub issues: `#93`, `#94`, `#95`, `#162`
- Evidence: [plays/queries.ts](/Users/phaedrus/.codex/worktrees/087b/chrondle/convex/plays/queries.ts) and [queries.ts](/Users/phaedrus/.codex/worktrees/087b/chrondle/convex/orderPlays/queries.ts) still accept `userId` arguments directly; [route.ts](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/app/(app)/api/webhooks/clerk/route.ts) still warns and proceeds when `CLERK_WEBHOOK_SECRET` is absent; [anonymous.ts](/Users/phaedrus/.codex/worktrees/087b/chrondle/convex/migration/anonymous.ts) still merges anonymous streaks without replay tracking.
- Already fixed and should stay fixed: issue `#91` style auth derivation in classic submit mutations and issue `#92` style internalized webhook user creation.
- Touchpoints: `convex/plays/queries.ts`, `convex/orderPlays/queries.ts`, `convex/migration/anonymous.ts`, `src/app/(app)/api/webhooks/clerk/route.ts`, `convex/users/helpers.ts`, related tests.
