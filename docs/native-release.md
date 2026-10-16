# Native web release

The release train is adapted from Overmind `scripts/train.py` at
`49d98c2f78643c5247fb112fa4ebd02af44a7ec2`, not a new controller or service.
The source diff replaces the GitHub CI/deployment workflows; operational cutover
is complete only after a reviewed native promotion and its readback.

## Checks and custody

Run `bun run check --mode fast` before merge. `--mode full` adds coverage,
backend parity and real workerd checks. The train additionally bundles with
Wrangler's credential-free dry run, exercises the packaged bytes, copies only
regular deploy files, and records SHA256s in append-only `events.jsonl`.
Promotion uses `no_bundle` and a separately provisioned lockfile-matching
Wrangler outside all writable build mounts. It does not rebuild the candidate.

Packaged route checks retain the artifact's module-loading options. The existing
Worker suite also copies the artifact, adds an unresolved `react` import and
requires both route suites to reject it, even with checkout dependencies present.
The canary never modifies the staged artifact.

`web/production.json` contains only settings already public in the live browser
bundle/Worker. Server keys remain existing Worker secrets. The narrow shared CD
token is resolved in memory from its canonical password-store entry only after
the build container and checkout are gone. No `.env`, password store, SSH agent,
Docker socket or production credential is mounted into the build.

The build uses the existing `gha-runners.slice` with a 4 CPU/8 GiB unprivileged,
read-only-root container. Pass exact installed Node24/Bun1.4.2, Rust with the
Wasm target and worker-build paths; image IDs must be immutable SHA256s.

    python3 scripts/train.py --repo <trusted-checkout> --home <separate-state> \
      --node <node24-install> --bun <bun1.4.2-install> --rustup <rustup-home> \
      --cargo-bin <cargo-bin> --worker-bin <worker-build-bin> \
      --image sha256:<existing-image-id> --network <existing-network> \
      --dns <executor-dns> --mode fast --wrangler <trusted-wrangler.js> --promote

`--candidate <exact SHA>` selects an unmerged diagnostic and forbids promotion.
`--mode full` never promotes and runs on unchanged trunk too. Successful slim
receipts coalesce unchanged trunk; failed candidates are never recorded as
promoted. Selection never requires equality with a newer trunk head. One native
file lock serializes all candidate verification/promotion/recovery.

## Cutover

1. Verify a diagnostic artifact on Mirrodin and independently review the source.
2. Provision the trusted Wrangler from this repo's frozen Bun lockfile in a
   separate directory, not the build's mutable dependency cache.
3. Confirm the old Actions deploy is idle and disable it before publishing or
   merging. Disable retained GitHub workflows too rather than spending hosted
   minutes; their unported audits are explicit follow-ups, not a release path.
4. Use one no-agent engineer-profile cron every30m, running a shell SSH adapter
   to the trusted native invocation above. Configure `deliver=local` and
   `failure_deliver=bot-chat:kaylee`. Use the same entrypoint without `--promote`
   and with `--mode full` at06:00/18:00 America/Chicago for the full battery.
   Create paused; enable only after the first verified native promotion.
5. Read the exact cron records/executions, provider version and all three public
   hosts back. Exercise failure delivery and compatible rollback, then observe
   an ordinary scheduled moved-trunk release. Do not equate an enabled cron or a
   passing unit test with this operational proof.

This slice does not change backend source, data, integration secrets or billing.
Its preflight reads the actual previous runtime backend origin and rejects a
changed writer. It also rejects changed `backend/` or `convex/` source rather
than silently skipping deployment. Add that family's compatible native deploy
when the rewrite reaches it; never bypass preflight or restore an old store.

## Recovery and evidence

Promotion saves the current100% provider version and its source annotation.
Failure restores that version, reads the pointer back and requires healthy
previous-revision responses plus Classic entry and unsigned billing rejection.
Recovery never restores data. The invocation remains red after recovery and
emits a bounded candidate/mode/evidence reference to Kaylee's native intake.

`events.jsonl` is the append-only verification/release record; `last_promoted`
is its projection, not a separately synchronized status file. `train.log` owns
command diagnostics. Rotate/archive those task-owned files through the normal
evidence retention process; do not copy raw production response bodies into
notifications. The exact source, command, container parent, staged-file hashes,
provider/readback, screenshots and elapsed time belong in the task handoff.
