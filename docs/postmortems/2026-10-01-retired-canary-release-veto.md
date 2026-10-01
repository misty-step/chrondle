# Postmortem: retired observability service vetoed releases

- **Incident date:** 2026-09-30
- **Status:** Retired dependency removed; native premerge regression added.
- **Operational owner:** Chrondle maintainers
- **Tracker:** MIS-195

## Summary

The production release gate still required a network response from decommissioned Canary. An unrelated, retired observability service could therefore veto an otherwise valid application release. Removing that obsolete authority also exposed separate compiler-contract mismatches that required their own repairs; none justified restoring Canary.

## Impact

[Run 36791403994](https://github.com/misty-step/chrondle/actions/runs/36791403994) failed on the retired endpoint before deployment mutations. This was a release interruption, not evidence of gameplay corruption. Later isolated Convex type checking and Turbopack failures were distinct compiler failures, not repeats of the retired-service outage. No shadow rollback recovery is claimed here.

## Timeline

| Time       | Observation                                                                                                                                                                                                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-30 | Run 36791403994 was vetoed by the retired Canary fetch.                                                                                                                                                                                                                                                           |
| 2026-09-30 | [PR 314](https://github.com/misty-step/chrondle/pull/314) removed the obsolete release validator/endpoint dependency.                                                                                                                                                                                             |
| 2026-10-01 | [PR 316](https://github.com/misty-step/chrondle/pull/316) removed active transport, environment callers, health/CSP authority, and publication paths.                                                                                                                                                             |
| 2026-10-01 | [Run 36801187725](https://github.com/misty-step/chrondle/actions/runs/36801187725) exposed the isolated Convex compiler mismatch; [run 36803104068](https://github.com/misty-step/chrondle/actions/runs/36803104068) exposed the separate Turbopack mismatch.                                                     |
| 2026-10-01 | [PR 317](https://github.com/misty-step/chrondle/pull/317) aligned compiler checks; automatic [run 36805628301](https://github.com/misty-step/chrondle/actions/runs/36805628301) deployed `ba1ea38043762b336df56f7937e7710d21ed76eb`.                                                                              |
| 2026-10-01 | [PR 318](https://github.com/misty-step/chrondle/pull/318) adds the actual native producer/install/consumer path to PR CI. Local exact-commit preflight on `3781b70fd9a41bb936baae98d24d3ff4e35c0801` emitted `preflight.passed`, served the installed CSS bytes, and exported real Convex bundles without a push. |

## Evidence and mechanism

The original build validator treated Canary reachability as release authorization even after its retirement. The preceding repairs and live release evidence are recorded in [PR 317's deployment receipt](https://github.com/misty-step/chrondle/pull/317#issuecomment-5924133690).

Previously, artifact compilation in hosted CI did not execute the native release owner's install/validation path. The new required `deployment-contract` job runs `python3 scripts/host-cd.py --preflight "$GITHUB_SHA"`: it archives that exact Git commit into a fresh workspace, uses the same `compile_release` and `install_release` functions as production, checks build identity and artifact boundaries, and launches the installed standalone server to compare a real CSS response against the installed artifact. Webpack and unchanged CSS/JS budgets remain enforced.

The shared `bun run deploy:backend` command invokes Convex's real `deploy --debug-bundle-path` producer in preflight. The native CLI exports `fullConfig.json` and isolate/Node bundles, then reports “Skipping rest of push.” It targets closed loopback with an inert selector, an isolated home, and no deployment credential. It does not authenticate, push, validate hosted schema transitions, or migrate data. Those production boundaries remain in trusted default-branch deployment.

## Pokayoke

How can we pokayoke this so this kind of error never happens again?

Delete the retired service's active transport, environment schema/examples/callers, release validator, and health authority rather than tolerating its outage. Canary can no longer veto a release through these removed paths. Historical incident evidence and unused encrypted credential inventory remain; neither is a runtime dependency.

Give native artifact production and installation one owner, invoked by both PR preflight and production. The required CI gate fails before merge when that real invocation, identity check, packaging validation, budget, backend bundling, or installed static consumer fails. It is not a help-command check, copied deployment invocation, source pin, mock, or fake artifact.

Limits: PR preflight uses the existing development Convex public URL and a public test Clerk key. It does not emulate the root-owned systemd sandbox, timer authorization, production credentials, service activation, authenticated gameplay, or rollback. Those remain separate native/live boundaries; this change does not make every deployment failure impossible.

## Follow-up

[PR 318](https://github.com/misty-step/chrondle/pull/318) owns the shared invocation and required regression. Its exact-head CI, independent review, automatic default-branch deployment, and live SHA/surface receipts are published on that PR. The owner procedure is [the deployment guide](../deployment-guide.md).
