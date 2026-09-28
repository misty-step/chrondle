# Postmortem: dependency updater and lockfile ownership drift

- **Incident date:** 2026-09-28, 04:09 UTC
- **Status:** Verified repair branch; activation blocked on production-safe CI. MIS-178 remains open.
- **Operational owner:** Chrondle maintainers; Kaylee's GitHub failure intake owns incident triage.
- **Tracker:** [MIS-178](https://linear.app/misty-step/issue/MIS-178/github-production-failure)

## Summary

Chrondle migrated to Bun but retained Dependabot's `npm` ecosystem. A newly enforced
upstream check rejected the incompatible ownership: the npm updater cannot update
`bun.lock`. Application CI had no contract connecting the updater to the package
manager and lockfile, allowing dependency automation to drift independently.

## Impact

The weekly root dependency group could not refresh its update PR. This was a
maintenance failure, not an observed game outage. The failed updater stopped during
file fetching, before dependency resolution; there is no evidence of a bad package
release causing this incident. No application dependencies were upgraded by this
repair. The existing `yaml@2.9.0` parser is declared directly as a development
dependency for the configuration guard; it was already in the lockfile.

Read-only verification at 04:20–04:23 UTC found the public health endpoint reporting
`status=ok`, `convex=ok`, and `canary=configured`. A signed-out browser at
`https://www.chrondle.app/classic` served puzzle **412**, Clue 1 of 6, with empty
range inputs. The browser's UTC calendar day was 2026-09-28; a public
`puzzles:getPuzzleByDate` query for that explicit date returned the same puzzle
number, date, and six events. No answer was printed or submitted. This proves
availability of that daily puzzle, not billing, scoring, or every application path.
No production release or Convex mutation was performed. A second signed-out walk
with `America/Chicago` emulation also loaded the Classic surface; its explicit
2026-09-27 query returned puzzle **411** with six events. Both sides of the local-day
boundary were available.

## Timeline

| Time (UTC)          | Observation                                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-21 04:13    | [Previous root group run succeeded](https://github.com/misty-step/chrondle/actions/runs/35560171512), using repository revision `a8fedab7e8effde889fdd8d8a6f689d300bbda50`. |
| 2026-09-28 04:09    | [Run 36376521452](https://github.com/misty-step/chrondle/actions/runs/36376521452) started at that same repository revision.                                                |
| 2026-09-28 04:10:24 | Updater reported `misconfigured_tooling`: Bun lockfile requires `package-ecosystem: bun`.                                                                                   |
| 2026-09-28 04:14    | Kaylee's production-alert intake created MIS-178.                                                                                                                           |
| 2026-09-28 04:20    | New repository contract regression failed against the original configuration: `'npm' !== 'bun'`.                                                                            |
| 2026-09-28 04:21    | Changing the ecosystem to `bun` made all 16 focused regressions pass.                                                                                                       |
| 2026-09-28 04:22    | The new health command queried real GitHub history and exited nonzero: no completed native Bun run. It did not treat historical npm successes as recovery.                  |

## Evidence and mechanism

The failed job used updater image
`ghcr.io/dependabot/dependabot-updater-npm:28ac35bd1a119c61737d8a9d728f49fd3bda4035`.
The previous successful job used npm updater image
`c6b6f2fa758097414d0983d2140b87347b154528`.
The failed job's error explicitly states that `npm_and_yarn` cannot update the sole `bun.lock`
and directs the repository to use the native Bun ecosystem. The successful and
failed weekly runs shared the same application SHA. That establishes upstream
behavior change exposing an existing configuration mismatch, not a new app commit.
GitHub documents [native Bun version-update support](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories#bun).

Reproduction and owner-boundary commands:

```sh
# Before repair: one failure for the checked-in npm/Bun mismatch; 15 passed.
# After repair: all 16 passed.
bun run test scripts/verify-dependabot.test.mjs

# Offline ownership contract used on pushes and pull requests.
bun scripts/verify-dependabot.mjs

# Read-only online health check; uses native gh auth locally.
GITHUB_REPOSITORY=misty-step/chrondle bun scripts/verify-dependabot.mjs --runs
```

The fast gate (`bun run lint && bun run type-check && bun run test`) passed in the
owned `chrondle-ws` workspace at snapshot
`b712e072b0c007d031911b5d32a3a7151476c571`: 165 test files, 1,994 tests.
The Dagger lint, type-check, and coverage gates also passed at snapshot
`bf8b776e087fc78e35f651c2bbaea9b82e917827`. System One diff review passed without
blocks or warnings. Final formatting and documentation-only evidence updates do
not change the exercised behavior; the linked PR records the hosted candidate SHA.

The online command paginates GitHub's recent dynamic runs and requires the newest
completed root Bun updater run to succeed within nine days (weekly cadence plus
two days' grace). It rejects missing, stale, failed, cancelled, and invalid-dated
results. Unrelated workflows, GitHub Actions updates, other directories, and old
npm updater successes cannot satisfy the check. API errors fail closed.

## Pokayoke

How can we pokayoke this so this kind of error never happens again?

**Class closed by this change, pending activation:** allowing the application's
package manager, authoritative lockfile, and dependency updater ecosystem to
disagree while verification passes. [`verify-dependabot.mjs`](../../scripts/verify-dependabot.mjs)
requires Bun, its text lockfile, exactly one native Bun root updater, no competing
lockfile, and enabled updates at least weekly. The checked-in configuration
regression runs in the ordinary Vitest gate. The independent
[Dependency Update Health workflow](../../.github/workflows/dependency-updates.yml)
executes the ownership guard on every PR and default-branch push. A change back to
npm now fails before it can be mistaken for a verified configuration.

**Silent-stall control, pending activation:** the same workflow runs daily at 06:17 UTC
and on demand, requiring real recent successful Bun execution. A nonzero status
uses the existing GitHub workflow-failure intake that opened MIS-178. It uses only the
built-in read-only GitHub token, has a five-minute deadline, and neither changes
packages nor deploys. Live service health is intentionally not a PR gate: an
upstream outage must not prevent merging its repair.

**Residual limits:** repository checks cannot prevent GitHub outages, registry
failures, delayed/disabled Actions schedules, or bypassed CI. This is not a claim
that every future updater failure is impossible. The ownership mismatch is
rejected deterministically; future stalls become failing health checks within a
daily check after failure, or after the nine-day no-success deadline. A successful
updater run proves execution, not that dependency PRs pass their gates or merge.
GitHub currently lists Bun security updates as unsupported; native version updates
and the existing production dependency audit are not substitutes for that feature.

## Follow-up

**Phaedrus decision required before PR creation or merge:** isolate the existing
PR/default-branch E2E gate from production Convex. The current
[CI workflow](../../.github/workflows/ci.yml) passes `secrets.NEXT_PUBLIC_CONVEX_URL`
to both the build and E2E jobs. The
[Dagger Playwright container](../../dagger/src/index.ts) injects that URL unchanged.
There is no checked-in `.env.test.local` override; dotenv does not override an
already-injected value. The build artifact from
[successful PR run 35483723414](https://github.com/misty-step/chrondle/actions/runs/35483723414)
contains `https://fleet-goldfish-183.convex.cloud` in its compiled application chunks.
[habit-loop.spec.ts](../../e2e/habit-loop.spec.ts) calls
`puzzles.ensurePuzzleForDate` as a mutation when a test date is absent. Thus opening
a PR or pushing master can run production mutations even without a deploy.

Recommendation: authorize a separate CI isolation change using a dedicated
non-production Convex target for both build and tests, with a fail-closed target
check before any mutation-capable journey. Do not disable the E2E gate or waive the
no-production-write boundary to activate this repair. No PR was opened and master
was not changed.

MIS-178 owns that decision, hosted activation, and the green native Bun run receipt.
Close only after linking the class-closing change, this postmortem, repository gate
results, and actual successful updater execution. The branch closes the tested
configuration mistake, but production dependency automation is not yet repaired.
