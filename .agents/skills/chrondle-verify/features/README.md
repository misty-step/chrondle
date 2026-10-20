# Chrondle verification map

The maintained list of what a chrondle player and its owner do, and how to
prove each one on the real app. Read this index, run `doctor`, then follow the
matching feature file. `H` below is
`.agents/skills/chrondle-verify/scripts/chrondle-verify.mjs`, run with `node`
from the repo root.

## Baseline preconditions

- `bun install` has run in this checkout (the helper imports `@playwright/test`).
- `node $H doctor` passes for the `--base` you are driving.
- Production (`https://www.chrondle.app`, the default) allows the owner
  sign-in and read-only use. Anonymous play is read-only for the backend; the
  helper fails any context that sends a mutation outside its allowlist.
- Signed-in write flows (a signed-in guess, the server-side streak) need a
  local stack with a Clerk development key and the dev Convex deployment; see
  [Streaks](./streak.md) Gotchas.

## Driving conventions

- One helper command per feature; each opens fresh browser contexts and
  closes them.
- Handles are ARIA roles and names, `aria-label`s and one `data-testid`; never
  coordinates.
- Dates are the player's local calendar day. The helper shifts the browser
  clock with `page.clock` only to past days whose puzzles already exist, so no
  generation is triggered on production.

## Proof and skip reporting

- Every command writes `<feature>.json`: each user action paired with the
  observed result, the mutations the context sent, and the files captured.
- UI proof is a screenshot plus an ARIA snapshot (`.aria.txt`).
- A failing step fails the command (exit 1). Report the step text verbatim.
  Never report a feature as verified through a different path than its file
  names.

## Feature entry contract

Each file has an H1, a one-paragraph description, then four H2s in order:
`Sub-features`, `How to get to it (user POV)`, `Driving it with chrondle-verify`,
`Gotchas`.

## Features

- [Owner sign-in](./sign-in.md): owner signs in on production with the
  emailed code read from the real inbox; owner-only page renders; wrong and
  reused codes are refused.
- [Daily Classic puzzle](./daily-puzzle.md): gallery to today's Classic
  puzzle, range entry and validation, a win, the return hook.
- [Daily Order puzzle](./order-puzzle.md): gallery to today's Order puzzle and
  keyboard reordering.
- [Streaks](./streak.md): consecutive-day wins build a streak that survives a
  reload and is broken by a missed day; the owner's server streak is read.
- [States that break](./states.md): signed out, phone width, slow network,
  backend down, a puzzle that does not exist.
