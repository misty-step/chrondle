# Postmortem: dependency updater and lockfile ownership drift

- **Incident date:** 2026-09-28, 04:09 UTC
- **Recovery:** Repair and CI isolation; merged revision and hosted activation receipts are tracked in MIS-178.
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
blocks or warnings. These initial snapshots proved branch verification only;
hosted activation was paused until production-safe CI was authorized.

The online command paginates GitHub's recent dynamic runs and requires the newest
completed root Bun updater run to succeed within nine days (weekly cadence plus
two days' grace). It rejects missing, stale, failed, cancelled, and invalid-dated
results. Unrelated workflows, GitHub Actions updates, other directories, and old
npm updater successes cannot satisfy the check. API errors fail closed.

The root-run matcher accepts both `/` and `/.`, spellings observed in Dependabot
history, without accepting subdirectories. Its additional protocol regression
failed before that correction and passed afterward (19 focused tests total).
Both full gates were rerun for this correction at snapshot
`186805ac50970d1842646ccdeb30de8f7579a52b`: lint, type-check, 165 test files /
1,997 tests, and Dagger lint, type-check, and coverage all passed.

## Pokayoke

How can we pokayoke this so this kind of error never happens again?

**Class closed by the ownership guard:** allowing the application's
package manager, authoritative lockfile, and dependency updater ecosystem to
disagree while verification passes. [`verify-dependabot.mjs`](../../scripts/verify-dependabot.mjs)
requires Bun, its text lockfile, exactly one native Bun root updater, no competing
lockfile, and enabled updates at least weekly. The checked-in configuration
regression runs in the ordinary Vitest gate. The independent
[Dependency Update Health workflow](../../.github/workflows/dependency-updates.yml)
executes the ownership guard on every PR and default-branch push. A change back to
npm now fails before it can be mistaken for a verified configuration.

**Silent-stall control:** the same workflow runs daily at 06:17 UTC
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

### CI isolation prerequisite

Initial investigation found the
[CI workflow](../../.github/workflows/ci.yml) passing `secrets.NEXT_PUBLIC_CONVEX_URL`
to both build and E2E. The build artifact from
[successful PR run 35483723414](https://github.com/misty-step/chrondle/actions/runs/35483723414)
contained `https://fleet-goldfish-183.convex.cloud` in compiled application chunks.
[habit-loop.spec.ts](../../e2e/habit-loop.spec.ts) calls
`puzzles.ensurePuzzleForDate` when a test date is absent. Opening a PR or pushing
master could therefore run production mutations without deploying.

This is a conditional write path, not a claim that anonymous range submissions
write to Convex: those return locally in `useGameActions`. The selected Chromium
suite excludes subscription/authentication tests. User creation and streak
migration are authentication-gated; Order reordering is local. In addition to the
test helper, both daily puzzle hooks can generate a missing puzzle on page load.
Read-only preflight found Classic and Order puzzles present for September 26, 27,
and 28, covering the selected UTC and Los Angeles clock-shifted journeys at the
time of inspection. That avoided a known immediate write, not later missing dates
or reruns. Activation was deliberately paused rather than waiving the boundary.

Phaedrus subsequently authorized CI isolation using existing resources. Build,
E2E, and bundle-size checks now use the existing `handsome-raccoon-955`
development deployment, not a production secret. The CI validator no longer
receives a Convex deploy key.
[`verify-ci-backend.mjs`](../../scripts/verify-ci-backend.mjs) rejects any other
runtime target or deployment credential before a build or test journey. It also
requires the compiled client to contain the development URL and rejects the
production Convex host before tests start, protecting against a production-bound
artifact paired with a safe-looking runtime environment. The Content Security Policy
allows HTTP/WebSocket connections to only the configured Convex origin rather
than hardcoding production.

The new validator regression first failed because the original CI validator
accepted production (`exit 0` instead of `1`). Its regression also covers
production-bound lazy client chunks despite a development runtime, missing
compiled backend configuration, and deployment-credential injection.

Production-oriented read-only environment/Stripe validation remains intact.
This repair does not deploy production or alter the production deployment
workflow. No new paid deployment or operator-supplied credential is required.

Real-path checks exercised both sides of the boundary: Dagger's `build-artifacts`
entrypoint rejected a supplied production URL before Next built, while the
development build at snapshot `f4a97ca78d202ee7505598f6fd1f56fd516deb38`
passed its runtime guard, compiled-artifact guard, secret scan, and bundle-size
check. The initial artifact scan incorrectly treated a Convex SDK error-message
example as a configured target. Its regression failed before correcting the
guard to require the development binding and reject the known production host,
without maintaining an allowlist of SDK examples.

Independent review also caught an empty-origin CSP fallback that broke missing-env
startup. The behavioral regression failed before repair, then passed alongside
the production/development CSP cases. The final focused suite has 27 tests:
19 updater contracts and 8 CI/backend/security-header contracts.

Public DEV queries independently confirmed six-event Classic and Order puzzles
for September 26–29. Native authentication and the existing deployment suffice;
production player data and production Convex credentials are not needed for CI gameplay.

The existing DEV backend was brought to the tracked schema through a temporary,
data-preserving migration: 1,818 legacy event-to-puzzle links moved from `puzzleId`
to `classicPuzzleId`, with historical puzzle documents retained. Reusable copies
of the existing public event text replenished the unused DEV pool. Temporary
migration functions were removed by redeploying the exact tracked backend.
After the four seeded dates, 295 years remained eligible for Classic generation.
The pool is finite and has no paid AI key: maintainers must replenish it rather
than redirect failing CI to production. The native DEV backup uses ordinary
existing Convex snapshot storage/bandwidth, not a new service or subscription.

Final isolation code at snapshot `f4a97ca78d202ee7505598f6fd1f56fd516deb38`
passed both required loops: raw lint/type-check/test (166 files, 2,005 tests),
then Dagger lint/type-check/coverage (2,005 tests). Independent review approved
the corrected implementation; System One reported no blocks or warnings.
The subsequent production read-only check again found health `ok` and Classic
puzzle 412 for September 28, showing Clue 1 of 6 with empty range inputs.

### Closure receipts

MIS-178 owns the final PR, independent review, green hosted checks, merged
revision, successful native Bun updater run, and successful online health check.
The updater run must be real GitHub execution: passing configuration tests or
serving the live game is not a substitute. Record those links before closing
MIS-178; a dependency updater success is not permission to merge its upgrades.
