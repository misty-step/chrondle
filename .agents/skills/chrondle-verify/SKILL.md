---
name: chrondle-verify
description: >
  Prove a chrondle change works the way a player sees it. Drives the real web
  app (https://www.chrondle.app or a local build) with a shell-run Playwright
  helper: owner sign-in through the real inbox, the daily Classic puzzle,
  Order mode, streaks, and the states that break (signed out, phone width,
  slow network, backend down, missing puzzle). Also names the code gate. Use
  before claiming any chrondle change is done, after a deploy, or when asked
  to "verify", "prove it works", "sign in as the owner", or "check prod".
---

# chrondle-verify

Chrondle is a daily year-guessing game: Next.js on a Cloudflare Worker,
Clerk auth (`clerk.chrondle.app`), and a Convex-protocol backend served at
`https://chrondle-backend.mistystep.io`. A green test suite is not proof a
player can play. This skill drives the real app from a shell and writes
evidence. The feature map in [features/README.md](features/README.md) is the
maintained list of journeys; each feature file is a recipe.

Both harnesses read this skill: `.agents/skills/chrondle-verify/` (Codex) and
`.claude/skills/chrondle-verify` (Claude Code), a relative symlink to it.

## Launch

The helper drives a running app; it never starts or stops one.

- **Production (default).** Nothing to launch: `--base https://www.chrondle.app`.
  Allowed on production: the owner sign-in and read-only browsing. Anonymous
  play is allowed because it never writes the backend (submits require a
  signed-in user; anonymous streaks live in browser storage). Every browser
  context proxies the backend socket: it records each Convex mutation and
  action, and drops any outside the allowlist before it reaches the server,
  then fails the run. The allowlist is `puzzles:ensurePuzzleForDate` and
  `orderPuzzles:ensureOrderPuzzleForDate`, plus `users:getOrCreateCurrentUser`
  for the owner. Contexts also block `/ingest` and PostHog, so synthetic plays
  never reach production analytics.
- **Local build.** `bun install`, then `bun run dev:next` (port 3000) and pass
  `--base http://localhost:3000`. Ready when `curl -s localhost:3000/api/health`
  returns 200 and `doctor` passes. **Read `.env.local` first:** the main
  checkout's `.env.local` points at production Convex
  (`fleet-goldfish-183`) and live Clerk keys, so a local server started with it
  is a production client, and a signed-in guess from it writes production.
  Live Clerk keys also refuse `localhost`, so signed-in flows only work locally
  with a Clerk development instance key (`pk_test_…`) and the dev Convex
  deployment `handsome-raccoon-955`; neither key is in `pass` today. Teardown:
  stop the `dev:next` process you started (by PID, never by name).

One-time per machine: `bun install` (provides `@playwright/test` and
`convex`); if Chromium is missing, `bunx playwright install chromium`.

## Doctor

Run first, and again after anything surprising:

```bash
H=.agents/skills/chrondle-verify/scripts/chrondle-verify.mjs
node $H doctor
# full doctor: owner identity (Clerk secret) and owner inbox too. The live Clerk
# secret is in the main checkout's .env.local; load it without printing it.
(set -a; . <(grep '^CLERK_SECRET_KEY=' ~/development/misty-step/chrondle/.env.local); set +a
 pass-env run -e FASTMAIL_API_TOKEN=workstation/FASTMAIL_API_TOKEN -- node $H doctor)
```

Checks: origin answers 200; `/api/health` 200; `/settings` and
`/admin/dashboard` redirect signed-out visitors to `/sign-in`; on production,
all five CNAMEs Clerk requires for chrondle.app resolve to their targets
(`clerk`, `accounts`, `clkmail`, `clk._domainkey`, `clk2._domainkey`; without
the mail records Clerk says a code was sent and none arrives), the public
Clerk environment (`https://clerk.chrondle.app/v1/environment`) is a
production instance with `email_code` as a first factor, so the owner can sign
in by emailed code; a browser loads `/classic` and the header puzzle number
equals the puzzle the app received from its backend for the local date; and,
with `CLERK_SECRET_KEY` bound, exactly one Clerk user has the owner's email
and it has `publicMetadata.role = "admin"`; and, with `FASTMAIL_API_TOKEN`
bound, the Fastmail JMAP session for the owner inbox opens. Unbound checks are
reported as skipped, not passed.

## Drive

One helper, one command per feature. Run from the repo root:

```bash
H=.agents/skills/chrondle-verify/scripts/chrondle-verify.mjs
node $H daily            # Classic daily puzzle: gallery, board, invalid input, win, return hook
node $H order            # Order daily puzzle: gallery, board, keyboard reorder
node $H streak           # anonymous streak across clock-shifted days, reload, missed day
node $H states           # signed out, phone width, slow network, backend down, missing puzzle
pass-env run -e FASTMAIL_API_TOKEN=workstation/FASTMAIL_API_TOKEN -- node $H sign-in
pass-env run -e FASTMAIL_API_TOKEN=workstation/FASTMAIL_API_TOKEN -- node $H all
```

Options (any order): `--base <origin>` (default `https://www.chrondle.app`),
`--out <dir>` (default `~/.cache/tmp/chrondle-verify/<UTC date>/`),
`--headed`. Exit 0 means every step of the command passed. Each command writes
`<feature>.json` (every action, its observed result, and the backend sockets,
mutations sent and mutations blocked) plus `.png` screenshots and `.aria.txt`
accessibility snapshots.

Stable handles the helper relies on: textboxes `Start year` / `End year`,
radiogroups `Start year era` / `End year era`, button `/lock in range/i`,
`data-testid="results-focus-anchor"`, header `aria-label="Puzzle N"`,
`aria-label="Current streak: …"`, region label `Come back tomorrow`, gallery
cards with `Puzzle #N` at `/?all=1`, Order list items with `Move … down`
steppers and a polite live region. To win deterministically the helper reads
the day's `targetYear` from the puzzle object the app itself received on its
backend socket (test-side knowledge only; nothing in the product shows it).

### Owner sign-in

- **Owner identity:** `phraznikov@gmail.com`, the Clerk production user
  phaedrus uses on chrondle; the owner-only page is `/admin/dashboard`
  (requires `publicMetadata.role = "admin"`).
- **How the code arrives:** Clerk mails a 6-digit code from
  `noreply@chrondle.app`; Gmail forwards it into phaedrus's Fastmail account,
  which the helper reads over JMAP with the pass entry
  `workstation/FASTMAIL_API_TOKEN` (bound as `FASTMAIL_API_TOKEN`). The code
  value is never printed or stored.
- **Proof:** a session whose primary email is the owner's, `/settings`
  renders, and `/admin/dashboard` renders the `Admin Dashboard` heading
  without redirect. "Email sent" or an HTTP 200 is not proof.
- Each run sends phaedrus two code emails and a "New device signed in"
  notice. Do not run it in a loop.

## Evidence

Routine runs write to scratch (the default `--out`). When a run is the proof
for a PR, pass `--out docs/evidence/chrondle-verify/<YYYY-MM-DD>` and commit
it. Proof standards:

- Drive the user path: click the gallery card, type into the range inputs,
  enter the emailed code. No internal setters, test-only routes, or Clerk
  sign-in tokens for the owner proof.
- Capture the action and the resulting state (the JSON transcript pairs them),
  not only a final screenshot.
- Check side effects: the `check backend writes` step runs after every
  journey, pass or fail, and lists the sockets, mutations sent and mutations
  blocked. `no backend socket observed` means the page never reached its
  backend; treat that run as unproven.
- Never reveal an answer in evidence; the repo is public. `snap` masks every
  element showing any year the app received as an answer (dated or not, such
  as the admin dashboard's) and replaces the year and its era with `[answer]`
  in the ARIA text. The owner-page capture is clipped to the heading band.
  Check completed-board screenshots before committing them.
- Never commit a session, `storageState`, trace, HAR, code, or token. The
  helper keeps the owner session inside one in-memory browser context and
  closes it. Review screenshots for personal content before committing.

## Cleanup

Each command closes its own browser; nothing persists between commands.
Stop any local server you started, by PID. Evidence under `--out` stays.
`sign-in` ends the owner session with `Clerk.signOut()` (server-side), then
proves a signed-out browser cannot reuse the spent code.

## Code gate (before a PR)

The branch check is the Rust check binary; the native release train runs it
(no pull-request workflow does, so run it yourself before a PR):

```bash
bun run check --mode fast   # branch check; --mode full adds coverage, backend, built-workerd
```

Tight inner loop: `bun run lint && bun run type-check && bun run test`.
`bun run ci:dagger:*` are legacy adapters kept for reproducing old receipts;
they are not the merge gate. If lint, type-check, or tests fail on files you
did not touch, name the pollution in your proof rather than calling the run
green or quietly fixing unrelated files.

## Related deployed-surface scripts

`bun run deploy:verify` (post-deploy health), `bun run deployment:check`
(pre-deploy readiness), `bun run validate-puzzles` (read-only state
snapshot). `.github/workflows/clerk-live-verification.yml` (manual dispatch)
proves first-time and returning sign-in with a synthetic Clerk user it creates
and deletes; it leaves that user's Convex account and one play row in
production, so it is not part of this skill's routine run.
