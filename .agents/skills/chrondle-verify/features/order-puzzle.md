# Daily Order puzzle

The Order mode shows six events for the day; the player arranges them
chronologically with drag handles or `Move up` / `Move down` steppers, which
are keyboard accessible and announced in a live region.

## Sub-features

- `order-identity` the gallery Order number equals the header number.
- `order-board` the event list renders.
- `order-keyboard-move` a stepper moves an event and the live region announces it.

## How to get to it (user POV)

- Open `/?all=1` and choose the `Order` card, or open `/order`.

## Driving it with chrondle-verify

Preconditions:

- `node $H doctor` passes.

Run `node $H order`.

- **Gallery.** The `Order` card shows `Puzzle #N`.
- **Open puzzle.** Choose the card; `/order` header shows `Puzzle N`.
- **Keyboard move.** Focus the first item's `Move … down` button and press
  Enter. The moved event is now second and `[aria-live="polite"]` reads
  `moved to position 2 of 6`. Evidence: `order.png`.
- **Writes.** None.

## Gotchas

- Submitting an Order arrangement is not driven yet; the submit control and
  its scoring view should be added to this file when next maintained.
- The Order puzzle number differs from Classic's (separate sequences).
