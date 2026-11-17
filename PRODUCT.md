# Chrondle product

The accepted product contract for Chrondle, written as player stories. `SPEC.md`
records what the running game does today. When a build slice ships one of these
stories, that slice updates `SPEC.md` to match. Look and feel live in
`DESIGN.md`.

Intent: chat:phaedrus/t3541u. Accepted: round one chat:phaedrus/t3543u, round
two chat:phaedrus/t3549u (relayed by Kaylee). Research:
[MIS-1274 options page](https://artifacts.mistystep.io/artifacts/2026-11/mis-1274-chrondle-reimagining.html).

## Who it is for and its one job

- Chrondle is for daily-puzzle players: people who already play Wordle or
  Connections every morning. For them, history is the flavor, not homework.
- Its one job is a short, fair daily challenge that builds a player's sense of
  history. Every answer is earned through play and never leaked by the interface.

## The shape

- Two daily puzzles share one home, in the way NYT Games pairs an easy game with
  a hard one.
  - **Order** is the high-solve game: most players finish it feeling good.
  - **Classic** is the low-solve game: many players miss, and a hit feels earned.
- Duel is not part of Chrondle.
- Money is unchanged. Today's puzzles in both modes are free. The archive of
  past puzzles stays behind the existing subscription.

## Home

- P-01: When I open chrondle.app, I see today's Order and Classic in one place,
  each showing whether I've played it today. One tap starts either one. No
  sign-in, tutorial or question comes before play.
- P-02: I see one daily streak. A day counts when I finish at least one of the
  two puzzles. I also see the countdown to the next local midnight.

## Order (high-solve)

- P-10: I start with one anchor event already on a timeline, with its year shown.
- P-11: The other events come to me one card at a time. Each is a short story.
  I place the card before, after or between the events already on the timeline.
  I can tap to place it; dragging is optional.
- P-12: As soon as I place a card, its year appears. If I placed it wrong, it
  moves to its true position, so the timeline is always correct and each card
  teaches me something.
- P-13: Correct placements score points, and each later card is worth more than
  the one before. Wrong placements score nothing. Before the first card, I can
  see the most I can score.
- P-14: Target: at least 85% of players who start Order place no more than one
  card wrong.

## Classic (low-solve)

- P-20: I read story clues and bet one year range, up to 250 years wide, as
  today. I get one bet per day.
- P-21: Before I reveal the next clue, the control shows what that clue will cost
  me.
- P-22: Before I lock in, I see my range, its width and the points I'd earn if it
  contains the year. I confirm the bet with one deliberate step, which a mis-tap
  cannot trigger.
- P-23: Afterwards I see the year, whether my range contained it, and how my
  score was built.
- P-24: Target: 35% to 55% of players who submit a bet contain the year. Clue
  difficulty and the scoring curve are tuned to stay in that band.

## After each puzzle

- P-30: I get a "what really happened" card: a few plain sentences on what
  happened and why it mattered, with a source link for every event in the puzzle.
- P-31: I can share my result in one tap as a compact, spoiler-free grid with the
  puzzle number and a link. It never shows a year, a clue or a promotional
  sentence.
- P-32: After my first-ever finished puzzle, Chrondle may ask me one optional
  question with fixed answers. I can skip it. My answer is kept only as an
  anonymous count. It is never tied to me, and it never comes before play.

## Puzzle making (fully AI)

- P-40: Every puzzle is written and checked by AI. No human editor or spot check
  stands between generation and publication.
- P-41: Generation drafts the puzzle. A separate editor checks it against a
  written rubric before it can publish. Under the rubric:
  - each clue is a short story with a surprising or human detail, not a dry
    chronicle line;
  - each clue has a source that supports it;
  - each puzzle has at least one clue that gives a typical player a way in;
  - no clue gives the year away through numbers, era words or anachronisms;
  - the difficulty fits the solve-rate target for that mode.
- P-42: A puzzle that fails the editor is revised or replaced before its day
  arrives. A day never goes without a puzzle, and an unchecked puzzle never
  publishes.

## Fairness and privacy

- P-50: Nothing in the interface hints at the answer. That rules out
  auto-selected eras, proximity hints and inputs that change near the answer.
  Every Order card's year stays hidden until the card is placed.
- P-51: Measurement stays anonymous, as `SPEC.md` describes. Three things are
  added: per-mode completion and solve booleans, so the two solve-rate targets
  can be measured; the count from P-32's optional question; and nothing that
  identifies a player.

## Not now

- No themed or weekly edition, no friends or badges, no paid streak protection,
  and no new prices.
