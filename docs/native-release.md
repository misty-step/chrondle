# Native release on drydock

One `scripts/train.py` state machine owns verification, backend-first deployment,
web deployment and recovery. It is adapted from Overmind `49d98c2`; no Actions
or second controller participates. SPEC.md's native release contract is unchanged.

## Custody and host setup

Drydock is the root-operated Hetzner Docker/Python 3/Node host. Bun and Rust need
not be on its PATH. Provision immutable tool installations outside the train's
writable state: Node 24, the project's Bun version, Rust with wasm32-unknown-unknown,
and worker-build. Provision a separate trusted Wrangler matching `bun.lock`,
never the build's mutable node_modules. Pass their absolute directories below.
Pin the build image by local `sha256:` image ID; it needs bash and Python 3.

The isolated build gets only public `web/production.json` values, source and tool
mounts. It runs checks, web packaging/readbacks, and the backend's module generation
and Wrangler production dry-run. There is no Docker socket, SSH agent, credentials
file or host environment in it. Deployment consumes staged regular files, hashes
and trusted configs; no candidate build hook or dependency resolution executes with
credentials. Backend deployment runs from staged `backend/` with
`deploy --env production --var REVISION:<sha>` and the frozen bundle.

Provide one existing operator-managed **0600 regular file** (not a symlink), outside
all build mounts and source, to `--credentials`. Format: literal `KEY=value` lines
(no shell expansion or quotes), with exactly these keys:

- `CLOUDFLARE_API_TOKEN`
- `CF_ACCESS_CLIENT_ID`
- `CF_ACCESS_CLIENT_SECRET`

Values are never printed. The file is opened only after build/verify exits and the
candidate checkout is removed. Only the API token reaches trusted Wrangler; Access
headers are used solely for backup. No `pass` executable is needed.
`--cgroup-parent gha-runners.slice` is optional; omit unless provisioned.

## Invocation and cron

With tools provisioned at these paths and the pinned image ID recorded in
`/etc/chrondle/build-image-id`, install this root-owned wrapper as
`/usr/local/sbin/chrondle-train` (it contains no credentials):

```sh
#!/bin/sh
set -eu
exec /usr/bin/python3 /opt/chrondle/scripts/train.py \
  --repo /opt/chrondle --home /var/lib/chrondle-train \
  --node /opt/chrondle-tools/node --bun /opt/chrondle-tools/bun \
  --rustup /opt/chrondle-tools/rustup \
  --cargo-bin /opt/chrondle-tools/cargo/bin \
  --worker-bin /opt/chrondle-tools/worker-build/bin \
  --image "$(cat /etc/chrondle/build-image-id)" \
  --wrangler /opt/chrondle-deploy/node_modules/wrangler/bin/wrangler.js \
  --credentials /etc/chrondle/release.env "$@"
```

Exact promotion invocation on drydock:

```sh
/usr/local/sbin/chrondle-train --mode fast --promote
```

Root crontab (UTC; stderr retained for drydock's cron delivery wrapper):

```cron
*/30 * * * * /usr/local/sbin/chrondle-train --mode fast --promote
0 0,12 * * * /usr/local/sbin/chrondle-train --mode full
```

Do not enable before review and operational cutover. The cron wrapper delivers
stderr; there is no independent notification service. `--candidate <40-char SHA>`
is diagnostic only and cannot promote. Full checks never promote. One file lock
serializes all ticks. Successful receipts coalesce unchanged trunk; failures
never mark a candidate promoted.

## Release and recovery

Preflight records the current 100% web version/source and checks ancestry and the
actual backend origin. Changes to `backend/` or `convex/` relative to that last
promoted source trigger explicit `BACKING_UP`, `BACKEND_DEPLOYING`,
`BACKEND_VERIFIED` states before `PROMOTING`:

1. POST `https://chrondle-backend.mistystep.io/_backend/admin/backup` with Access
   service-token headers; fsync the returned backup key into `events.jsonl`.
2. Record the current 100% `chrondle-backend` version and source annotation.
3. Deploy the verified backend bundle with the candidate revision, then verify
   provider identity and `/_backend/version` before deploying web.
4. Deploy web; read back all three hosts, discovery, Classic and denied billing
   requests, plus the backend version again.

Any failure from backend deployment onward (including ambiguous deploy errors)
attempts to restore **both** prior version pointers using provider deployments API;
unchanged pointers need no write. Each recovery is attempted even if the other
fails. Both pointers and serving revisions are checked. Web-only releases never
deploy or restore backend. Recovery never restores data, and the run always exits
red even after successful rollback. Stderr includes the backup key, the manual
data recovery point, or `None` if no backup was obtained.

`events.jsonl` is the append-only state/hash/release record, not a second status
store. `train.log` contains command diagnostics; evidence references
`drydock:<state>/train.log`. Do not copy raw production response bodies into alerts.
A unit test or dry-run is not operational proof: a reviewed promotion, real pointer
rollback/readback, cron execution and failure delivery remain operator cutover work.
