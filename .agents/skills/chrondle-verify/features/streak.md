# Streaks

Winning the daily puzzle on consecutive local days builds a streak shown in
the header (`Current streak: N day streak`) and in the completion panel. A
missed day breaks it. Anonymous streaks live in browser storage; signed-in
streaks live on the player's account.

## Sub-features

- `streak-start` a first win shows 1 day.
- `streak-next-day` a win on the next day shows 2 days and the hook promises 3.
- `streak-persist` a reload keeps the streak.
- `streak-missed-day` after a missed day, no streak is advertised before playing.
- `streak-owner-read` the signed-in owner's header shows the account streak (see [Owner sign-in](./sign-in.md)).

## How to get to it (user POV)

- Win `/classic` on one day, come back the next day and win again. The header
  flame and the `Come back tomorrow` region show the streak.

## Driving it with chrondle-verify

Preconditions:

- `node $H doctor` passes.
- The puzzles for three and two days ago exist (they do once those days have
  passed; the helper never shifts into the future).

Run `node $H streak`.

- **Day 1.** Clock at noon three days ago; win `/classic`. Streak 1 day.
- **Day 2.** Clock to noon two days ago; win again. Streak 2 days; `Come back
tomorrow` reads `make it 3`. Evidence: `streak-day2.png`.
- **Persist.** Reload. Header `aria-label` still `Current streak: 2 day streak`.
- **Missed day.** Clock to today noon (yesterday skipped); open `/classic`
  before playing. The header must show no streak. Evidence:
  `streak-missed-day.png`.
- **Writes.** None.

## Gotchas

- 2026-10-20: `streak-missed-day` fails on production. The header still shows
  the broken streak (seen as 1 and as 2) until the next win. Tracked as a bug
  with a fix PR; this journey keeps asserting the correct behavior.
- The server-side streak (signed-in win increments `currentStreak`) is a
  production write. Drive it only on a local stack with a Clerk development
  key and the dev Convex deployment `handsome-raccoon-955`; those keys are not
  in `pass` as of 2026-10-20, so that sub-flow is unreachable from this
  workstation. The manual workflow `clerk-live-verification.yml` covers a
  signed-in play with a synthetic user.
- Shifting the clock into the future makes the app call
  `ensurePuzzleForDate` for that date, which generates a puzzle on production
  if the date is inside the backend's yesterday..tomorrow UTC window. Use
  only past days.
