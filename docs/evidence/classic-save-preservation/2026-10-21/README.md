# Classic save preservation — issue 361

Owner: moomooskycow. Navi coordination / Foundations lane, parent #355.

## Isolated acceptance

`isolated-browser.json` records a PASS against a production Next build with a synthetic signed-out Clerk interface and a loopback-only backend. `next-day-C.png` contains synthetic puzzle content, not a production answer. Browser profiles are disposable; no real accounts are used. All non-loopback HTTP and WebSocket traffic is intercepted. The backend fixture refuses every mutation/action.

The journey accepts daily A with one hint (84 points), accepts archive B with two hints (69 points), observes A in a second tab through a native storage event, reloads B, closes and restarts Chromium with the same isolated profile, restores A/B exactly, accepts next-day C (99 points), and checks A/B remain byte-for-byte intact. Streak storage moves from 1 on October 21 to 2 on October 22; restoring A does not change it. A separate scenario in the disposable profile migrates an existing singleton A, accepts B, and restores A.

`runtime-source-hashes.json` identifies the application sources used by this build. The fixture substitutes authentication and backend services; this does not prove real Clerk delivery or production sign-in. Those remain owned by parked PR #356.

## Reproduce

Use Bun 1.4.2 and the frozen lockfile. In this checkout:

```sh
bun install --frozen-lockfile
bun scripts/qa/classic-preservation-fixture.mjs
```

In another terminal, build and start with synthetic settings:

```sh
export NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:43162
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_aGVhbHRoeS1kb2UtMjMuY2xlcmsuYWNjb3VudHMuZGV2JA
export CLERK_SECRET_KEY=sk_test_c3ludGhldGlj
DAGGER_ARTIFACT_BUILD=1 bun run build
bun run start --hostname localhost --port 43161
```

Then run:

```sh
bun scripts/qa/classic-preservation-browser.mjs
```

Evidence goes to `/tmp/chrondle-361-browser`; the script prints its unique profile directory. Stop the two task-owned servers afterward.

## Regression and review evidence

- Four new source-function regressions failed on master: A/B/C retention, legacy A survival, real storage-key notifications and completed-attempt deduplication. They pass after the repair.
- Nine persistence tests cover those cases plus failed migration, lost acknowledgement, changed snapshot, quota failure and concurrent cleanup/submission.
- The integration test calls the actual `users.mergeAnonymousState` mutation and `puzzles.getUserPlay` query in an in-memory backend. It loses both acknowledgements after server commit, retains both local saves, retries, and verifies exactly one attempt and one stats award per puzzle. No extra streak award occurs.
- GameIsland tests cover loading-to-completed restore, rerender/remount, accepted submission and rejected submission. GameLayout verifies restored completion emits no completion event; its accepted-event coverage remains intact.
- Provider integration tests cover existing-account sign-in and account provisioning with the actual in-memory mutation/query boundary, preserving a failed readback until the next sign-in.
- Independent standards/spec reviews found an extra migration payload field and a deferred completion guard race in the first candidate. Both were corrected and covered by the tests above. A further tab cleanup race was fixed by sharing the puzzle lock with submissions and legacy migration; final delta review found no remaining blockers.
- Mirrodin's initial native fast gate passed 204 files / 2,399 tests. The corrected candidate's final native gate is recorded in the PR before merge.

## Production proof

Pending. Isolated acceptance is not deployment evidence. Issue #361 must remain open until the reviewed artifact is deployed and safely read back. This change does not resume #356, #359 or #360, and does not modify backend source, billing or telemetry policy.

Rollback retains the per-puzzle keys, but an older frontend cannot display them. Use a compatible forward fix to restore access; do not delete saved data or restore a backend snapshot.
