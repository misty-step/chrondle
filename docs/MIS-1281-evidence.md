# MIS-1281 — editor contract evidence (blocked draft)

This is partial implementation evidence, **not acceptance evidence for P-42**.
No publication path has been changed or activated.

## Implemented

- [Versioned P-41 rubric](rubrics/puzzle-editor-v1.json), including mode-specific
  solve-rate metrics and explicit source-support requirements.
- Separate `reviewPuzzle` OpenRouter call; its score is evaluated by code rather
  than trusting a model-provided pass boolean. Usage/cost/model are returned.
- Exact clue cardinality, distinct Order years, common Classic year, source URL
  validation, deterministic leakage checks, per-clue thresholds and a way in.
- Private append-only review records bind exact drafts (including per-clue sources),
  rubric version, scores, failures, model and cost. Both passes and failures are
  persisted; this does not publish a puzzle.
- Bounded revision/recheck contract that preserves attempts and rejects exhaustion.
- Contract tests include a deliberately bad fixture even with passing model scores.

## Missing acceptance evidence / activation blockers

The sandbox has no configured non-production Convex endpoint/operator identity.
No credentials were fetched. Production Convex access, backfill and deployment
are prohibited for this run, so the requested next-14-days record cannot be
established here. The supplied OpenRouter capability is not a backend identity.

Still required before this draft can be ready:

1. Connect durable editor records to scheduling/publication without exposing
   pre-solve sources or answers through player queries.
2. Trusted source retrieval/grounding. The editor adapter currently has URLs and
   model knowledge only; it must not be treated as proof of source verification.
3. Publication gates on **all** Classic and Order creation/update paths (including
   ensure-on-read and post-publication optimization). Preserve historical play.
4. An idempotent, bounded buffer replenisher and coverage monitor with at least
   the next 14 days passed in both modes before activation. Never permit an
   unchecked emergency puzzle. Provider failure must leave already passed days
   intact and visibly report exhaustion.
5. Three real AI-generated before/after clue sets and their source evidence.
   Synthetic test fixtures are intentionally not represented as those examples.
6. Publication/buffer integration tests and affected Classic/Order e2e journeys.

## Verification

Commands use Bun 1.3.9 from `.bun-version`. Full logs remain in the sandbox at:
`/home/user/.factory/9d072c6bc94e86b1ecad4ff2be401184fe408f2a508ba8f852f8c9069eaab681/logs/`.

Results and the draft PR link are recorded below after execution.

Draft PR: https://github.com/misty-step/chrondle/pull/391

| Command                                                                                                                                                                 | Result                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `bun run lint`                                                                                                                                                          | Exit 0                                                                                    |
| `bun run type-check`                                                                                                                                                    | Exit 0, including backend                                                                 |
| `bun run test -- convex/lib/__tests__/puzzleEditor.test.ts convex/actions/eventGeneration/__tests__/editor.test.ts convex/__tests__/puzzleEditorReviews.convex.test.ts` | Exit 0; 25 test executions across 4 test-project files                                    |
| `bun run build`                                                                                                                                                         | Exit 0 on retry; first invocation stopped at the existing Next security advisory reminder |
| `TEST_SKIP_SERVER=1 bun run test:e2e e2e/classic-range-entry.spec.ts e2e/order-mode-reorder.spec.ts --workers=2`                                                        | Exit 1; all 6 journeys hit the configuration-error screen                                 |

The browser configuration-error screen explicitly reports missing
`NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Screenshots,
videos and error contexts are preserved under the factory run's `test-results/`.
No credentials were fetched or fabricated. The first browser attempt also failed
because the dev server stopped at the Next security advisory reminder; a retry
started the server without modifying dependencies/settings. No security upgrade
or deployment was performed in this issue branch.

The initial full suite passed 2,435 tests. After adding record/adapter tests, a
full run had 2,436 passes and 8 failures in the unchanged
`useVictoryConfetti.test.tsx` (timer ordering and cleanup timeouts). That run was
concurrent with the build/browser work; the raw failure log is retained as
`logs/test-retry-needed.log`. A final full rerun without those competing jobs is
recorded below.

Final isolated `bun run test`: **exit 0; 212 files passed, 2,444 tests passed**.
The earlier failures and all retry logs remain preserved, not replaced as evidence
of an uninterrupted green run. Browser verification remains blocked; the editor
publication gate and 14-day buffer acceptance criteria remain incomplete.
