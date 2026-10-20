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
  signed-in user; anonymous streaks live in browser storage). The helper
  records every Convex mutation each browser context sends and fails the run
  on anything outside its allowlist (`puzzles:ensurePuzzleForDate`,
  `orderPuzzles:ensureOrderPuzzleForDate`, and for the owner
  `users:getOrCreateCurrentUser`).
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
node .agents/skills/chrondle-verify/scripts/chrondle-verify.mjs doctor
# with the owner inbox check too:
pass-env run -e FASTMAIL_API_TOKEN=workstation/FASTMAIL_API_TOKEN -- \
  node .agents/skills/chrondle-verify/scripts/chrondle-verify.mjs doctor
```

Checks: origin answers 200; `/api/health` 200; `/settings` and
`/admin/dashboard` redirect signed-out visitors to `/sign-in`; on production,
all five CNAMEs Clerk requires for chrondle.app resolve to their targets
(`clerk`, `accounts`, `clkmail`, `clk._domainkey`, `clk2._domainkey`; without
the mail records Clerk says a code was sent and none arrives), the public Clerk environment (`https://clerk.chrondle.app/v1/environment`) is a
production instance with `email_code` as a first factor, so the owner can sign
in by emailed code; a browser loads `/classic` and the header puzzle number
equals the puzzle the app received from its backend for the local date; and,
when the token is bound, the Fastmail JMAP session for the owner inbox opens.
The owner's identity and admin role are checked by `sign-in` itself, because
Clerk user metadata is not readable without the Clerk secret.

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

Options: `--base <origin>` (default `https://www.chrondle.app`), `--out <dir>`
(default `docs/evidence/chrondle-verify/<UTC date>/`), `--headed`. Exit 0
means every step of the command passed. Each command writes
`<feature>.json` (every action, its observed result, and the mutations the
context sent) plus `.png` screenshots and `.aria.txt` accessibility snapshots.

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

Write to `docs/evidence/chrondle-verify/<YYYY-MM-DD>/` (the default `--out`)
when the run is the proof for a PR, otherwise to scratch under
`~/.cache/tmp/`. Proof standards:

- Drive the user path: click the gallery card, type into the range inputs,
  enter the emailed code. No internal setters, test-only routes, or Clerk
  sign-in tokens for the owner proof.
- Capture the action and the resulting state (the JSON transcript pairs them),
  not only a final screenshot.
- Check side effects: the `check backend writes` step lists the mutations
  each context sent; a write outside the allowlist fails the run.
- Never commit a session, `storageState`, trace, HAR, code, or token. The
  helper keeps the owner session inside one in-memory browser context and
  closes it. Review screenshots for personal content before committing.

## Cleanup

Each command closes its own browser; nothing persists between commands.
Stop any local server you started, by PID. Evidence under `--out` stays.
`sign-in` leaves no session behind, and its last step proves a signed-out
browser cannot reuse a spent code.

## Code gate (before a PR)

The gate CI and the native release train enforce is the Rust check binary:

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
