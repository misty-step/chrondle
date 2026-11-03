# Daily Classic puzzle

Every player gets the same puzzle for their local calendar day: six clues
about one year, revealed one at a time. The player locks in one year range;
containment and width set the score. Completion shows the result and a "come
back tomorrow" hook.

## Sub-features

- `daily-identity` the gallery card number equals the game header number.
- `daily-board` the first clue and the range form render.
- `daily-invalid` an invalid year disables `Lock in range`.
- `daily-width` a valid range shows its live width.
- `daily-win` a range containing the answer completes the puzzle.
- `daily-return-hook` completion shows `Come back tomorrow` with a countdown.

## How to get to it (user POV)

- Open `https://www.chrondle.app/?all=1` and choose the `Classic` card, or
  open `/classic` directly. A saved mode preference sends `/` straight to
  that mode; `/?all=1` always shows the gallery.

## Driving it with chrondle-verify

Preconditions:

- `node $H doctor` passes.
- Fresh anonymous browser context (the helper makes one).

Run `node $H daily`.

- **Gallery.** Open `/?all=1`. The `Classic` card shows `Puzzle #N`.
- **Open puzzle.** Choose the card. The URL is `/classic` and the header
  `aria-label="Puzzle N"` matches. The puzzle the app received is for the
  local date. Evidence: `daily-before.png`.
- **Invalid input.** Fill `Start year` `1900` and `End year` `1949x`.
  `Lock in range` is disabled.
- **Width.** Fill `End year` `1949`. `50 years wide` appears and
  `Lock in range` is enabled.
- **Win.** Enter a one-year range on the answer year with the right era radio
  and choose `Lock in range`. Focus moves to `results-focus-anchor`.
- **Return hook.** Region `Come back tomorrow` contains `New puzzle in`; the
  streak reads 1 day. Evidence: `daily-after.png`.
- **Writes.** None (anonymous submits stay in the browser).

## Gotchas

- The helper learns the answer from the puzzle object the app received over
  its own backend socket. It never asks the backend separately and never
  shows the answer in the product.
- The lock-in is final: "One guess. Make it count." A second range cannot be
  entered after completion; start from a fresh context.
- A signed-in guess writes the owner's production play and streak. Never run
  this journey in the owner context on production.
