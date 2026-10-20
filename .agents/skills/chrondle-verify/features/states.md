# States that break

The conditions real players hit that are not the happy path: being signed
out, a phone screen, a slow connection, the backend unreachable, and a link
to a puzzle that does not exist.

## Sub-features

- `states-signed-out` signed-in pages redirect to sign-in with a return URL.
- `states-mobile` `/classic` fits a 390 px phone with no horizontal scroll.
- `states-slow-network` the puzzle becomes playable on 400 kbps / 400 ms RTT.
- `states-backend-down` with the backend unreachable, the player is told so.
- `states-missing-puzzle` an archive link past the last puzzle shows a not-found state.

## How to get to it (user POV)

- Open `/settings` or `/admin/dashboard` while signed out.
- Open `/classic` on a phone, or on a poor connection.
- Open `/classic` while the backend is down.
- Follow a link to `/archive/puzzle/<number past the last puzzle>`.

## Driving it with chrondle-verify

Preconditions:

- `node $H doctor` passes.

Run `node $H states`.

- **Signed out.** Open `/settings` and `/admin/dashboard`. Each lands on
  `/sign-in?redirect_url=…` with a `Continue` button. Evidence:
  `states-signed-out.png`.
- **Phone.** 390×844 touch context; `/classic` shows the puzzle number and
  `Start year`; `scrollWidth - innerWidth` is 0. Evidence: `states-mobile.png`.
- **Slow network.** CDP throttling; `/classic` shows the puzzle number and an
  editable `Start year` within 90 s; the transcript records how long.
- **Backend down.** Refuse the backend socket and requests
  (`chrondle-backend.mistystep.io`); open `/classic`; after 15 s a message
  that the game cannot reach the server (or offers retry) must be visible.
  Evidence: `states-backend-down.png`.
- **Missing puzzle.** Open `/archive/puzzle/999999`; after 20 s the page must
  show a not-found state, not `Loading puzzle…`. Evidence:
  `states-missing-puzzle.png`.
- **Writes.** None.

## Gotchas

- 2026-10-20: `states-backend-down` fails (an inert range form, no clue, no
  message) and `states-missing-puzzle` fails (`Loading puzzle…` forever; the
  not-found error goes only to a toast). Both are tracked bugs with fix PRs;
  the journey keeps asserting the correct state.
- `/archive/puzzle/abc` (not a number) already returns the 404 page; use a
  number past the last puzzle to reach the client-side path.
- The backend-down sub-feature blocks by hostname; if the serving backend
  moves, update the pattern in the helper.
