# Product Hunt Launch Assets

## Product Spec

Goal: ship a Product Hunt listing kit that is ready to post without extra copy work.

Deliverables:

- Primary tagline (<=120 chars) + 2 alternates
- Maker comment copy
- Gallery images (1270x760)
- Animated GIF showing gameplay
- Launch schedule (date + checklist)
- Upvoter tracker
- FAQ + response templates

Audience: new players who like Wordle-style daily puzzles.

Success signal: kit can be pasted into PH with minimal edits.

## Technical Design

Scope: content + assets only. No product changes. No gameplay spoilers.

Assets live in `docs/launch/product-hunt/assets/`:

- `gallery-01.png`
- `gallery-02.png`
- `gallery-03.png`
- `gameplay-preview.gif`

Copy lives here for easy reuse.

## Tagline (pick one)

Primary:

- Chrondle: a daily history puzzle where you guess the year from six clues.

Alternates:

- A daily history puzzle with six clues and two ways to play.
- Guess the year from six historical clues. New puzzle every day.

## Maker Comment

Hey Product Hunt! We built Chrondle to make history feel like a daily game. Each day you get six curated clues tied to one year. Instead of a single guess, you submit a year range and get scored on how tight (and accurate) the range is. There are two modes: Classic (year range) and Order (timeline ordering). We obsessed over a retro-archival feel and mobile speed. If you love Wordle-style puzzles or history trivia, we would love your feedback.

## Gallery Assets

Recommended order:

1. `gallery-01.png` (core idea)
2. `gallery-02.png` (two modes)
3. `gallery-03.png` (archive + mobile)

All assets are 1270x760.

## Gameplay GIF

- `gameplay-preview.gif`
- Use as first media item if PH supports GIF-first.
- Current GIF is a lightweight loop; replace with real capture if desired.

## Launch Schedule

Target: Tuesday, January 27, 2026 at 12:01 AM PT.

Checklist:

- Final copy review (tagline, maker comment)
- Confirm assets upload + ordering
- Line up upvoters (see tracker)
- Prepare responses (FAQ below)
- Post from maker account

## Upvoter Tracker

- `docs/launch/product-hunt/upvoters.csv`

## FAQ / Response Templates

Q: What makes Chrondle different from other daily puzzles?
A: Range-based guesses and timeline ordering make accuracy a strategy, not a single-shot guess.

Q: How hard is it?
A: Difficulty scales with hints. The scoring curve rewards tighter ranges without punishing learning.

Q: Is it free?
A: Yes. Daily puzzle is free. Archive access is optional.

Q: What platforms are supported?
A: Works on desktop and mobile. No app required.

Q: How do hints work?
A: You start with a clue and can reveal up to six hints per puzzle.

Q: Where does the data come from?
A: We curate and verify historical events, then generate daily puzzles from that dataset.
