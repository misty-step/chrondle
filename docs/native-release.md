# Native releases in fresh Boat sandboxes

Implements SPEC.md's Native release behavior (31d2ce8; D-188,
chat:phaedrus/t3624u). One `scripts/train.py` state table owns verification,
backend-first promotion and version-pointer recovery. The small
`scripts/release-on-boat` adapter is not another release controller: it only
selects, creates, invokes, collects and deletes. No Actions or standing build
host participates.

## Scheduler and environment

Run the launcher from Hopper's machine, in a trusted checkout with GitHub read
access and Boat CLI authentication. Its local Python 3 uses only the standard
library. The configured `mis-factory-worker` environment must have Python 3,
Git, Node 24, Bun, Rust with wasm32-unknown-unknown, worker-build, and a trusted
Wrangler installation on PATH matching this repository's `bun.lock`. Wrangler
must be outside the candidate checkout. Provision that environment separately;
the launcher does not list environments or provision credentials. It must contain
**no production credentials**. There is no Docker build, image, cgroup or host
mount/tool-path configuration. The fresh sandbox itself is the isolation boundary.

Install the reviewed repo at `/home/hopper/chrondle` and provide an existing local
0600 regular file at `/home/hopper/.config/chrondle/release.env`. Do not put it in
the repository or evidence directory. Its literal `KEY=value` format has exactly
these names (no quotes, shell expansion or multiline values):

- `CLOUDFLARE_API_TOKEN`
- `CF_ACCESS_CLIENT_ID`
- `CF_ACCESS_CLIENT_SECRET`

Group/other access, symlinks, missing or duplicate fields are refused. No values
are printed or put in command arguments. The local scheduler reads this file for
the read-only serving annotation query; it is transferred to the sandbox via SSH
stdin, with umask 077, **only after verification succeeds**. Promotion opens it
only after validating the verified receipt and staged hashes. No compiler or
candidate build hook runs during promotion. The file is outside source/state;
only the API token reaches trusted Wrangler, and Access fields reach only backup.

Exact launcher invocation:

```sh
/home/hopper/chrondle/scripts/release-on-boat \
  --credentials /home/hopper/.config/chrondle/release.env \
  --evidence /home/hopper/chrondle-release-evidence
```

Exact crontab on Hopper's machine (UTC; cron's wrapper delivers stderr):

```cron
*/30 * * * * /home/hopper/chrondle/scripts/release-on-boat --credentials /home/hopper/.config/chrondle/release.env --evidence /home/hopper/chrondle-release-evidence
0 0,12 * * * /home/hopper/chrondle/scripts/release-on-boat --mode full --credentials /home/hopper/.config/chrondle/release.env --evidence /home/hopper/chrondle-release-evidence
```

Full ticks verify even unchanged trunk; they never transfer credentials or promote
and do not hold later fast releases. A local advisory lock serializes launcher
ticks. Keep cron disabled until reviewed operational cutover.

## Two invocations, one train

The launcher reads one immutable master SHA, then asks `train.py --phase status`
for the source annotation of the current 100% production web version. If equal,
a fast tick exits 0 quietly without creating a sandbox. **Production's serving
annotation is the last-promoted authority**, never local receipts.

For a moved head it creates a sandbox with:

```sh
boat --no-update new --environment mis-factory-worker --json
```

It clones the repo, checks out that exact SHA (not a later moving head), then runs:

```sh
python3 /home/user/chrondle-candidate/scripts/train.py --phase verify \
  --repo /home/user/chrondle-candidate --home /home/user/chrondle-release \
  --sha <selected-40-character-sha> --mode fast
```

This invocation is credential-free. Build commands get an explicit environment
allowlist plus public `web/production.json` compiler values. They run directly in
the sandbox: checks, web build, route/discovery tests, package verification, and
backend module generation plus Wrangler's production dry-run. Both bundles are
staged as regular files with trusted config and SHA256 manifests in the per-run
`events.jsonl`. Verification ends in `VERIFIED`, not promoted or DONE.

Only after exit 0, the launcher writes `/home/user/chrondle-release.env`, then runs:

```sh
python3 /home/user/chrondle-candidate/scripts/train.py --phase promote \
  --repo /home/user/chrondle-candidate --home /home/user/chrondle-release \
  --sha <same-selected-sha> --mode fast \
  --credentials /home/user/chrondle-release.env
```

Promotion requires an unused fast VERIFIED receipt for that SHA and matching
staged hashes before reading credentials; it never rebuilds. Its preflight reads
production again (including ancestry and the actual backend-origin contract), so
the scheduler's earlier status query is not the release baseline. Source changes
under `backend/` or `convex/` relative to the serving source trigger:

1. `BACKING_UP`: POST `https://chrondle-backend.mistystep.io/_backend/admin/backup`
   with Cloudflare Access service-token headers; fsync the returned key to events.
2. Record the backend's current 100% provider version/source, then
   `BACKEND_DEPLOYING`: deploy the staged frozen bundle with trusted Wrangler from
   `backend/`, `deploy --env production --var REVISION:<sha>`.
3. Verify provider identity and `/_backend/version`, reaching `BACKEND_VERIFIED`.
4. `PROMOTING`: deploy the verified web bundle; read back all three hosts,
   discovery, Classic, denied billing requests, and the backend revision again.

Web-only releases do not deploy or restore the backend. Backend deployment runs
no build hook and performs no dependency discovery with credentials.

## Recovery and evidence

Any failure from backend deployment onward, including ambiguous deploy failures,
attempts both prior provider version pointers independently. Unchanged pointers
need no write; an unreadable pointer cannot suppress a restore attempt. Both
pointers and serving revisions are read back. A release remains red even after
successful recovery. **Data is never restored automatically**: the pre-deploy
backup key is the manual data recovery point.

The launcher collects `events.jsonl` and `train.log` independently into a private
per-run directory under the local evidence root, then deletes the sandbox in a
`finally` cleanup on success, failure or handled signal. Collection failure still
attempts deletion; deletion failure is red. Local `launcher.log` records command
diagnostics, and `sandbox-id` identifies cleanup failures for operator repair.
There is no surviving local release status file, only evidence.

The launcher emits one bounded failure line containing repo, SHA, phase, evidence
path and backup key if collected. No raw production bodies or credentials enter
that report. Preserve evidence through the operator's retention policy. SIGKILL,
platform outages, failed deletion or lost create responses still require operator
cleanup; CLI creation has a finite platform TTL as a final resource bound.

Do not equate mock tests or dry-runs with operational proof. Real creation/SSH,
provisioned environment tool versions, credential transfer, promotion, rollback,
cron execution and failure delivery must be verified during reviewed cutover.
