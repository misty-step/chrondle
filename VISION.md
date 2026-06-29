# Chrondle Vision

Status: canonical root vision for Chrondle. This is a lightweight product
north star; the project can stay low-priority without losing its direction.

## What this project is

Chrondle is a fun daily history game where players infer years from
historical-event clues, with daily puzzles, archive/play modes, notifications,
and strict puzzle-integrity rules.

It serves players who want a short, repeatable historical deduction habit with clear feedback and no accidental UI tells.

## North star

The north star is a fair daily ritual: clues teach and challenge, the UI never leaks the answer, daily/recovery flows are reliable, and puzzle generation quality improves without raising cost or complexity unnecessarily.

## What must stay true

- Puzzle integrity is load-bearing; players should deduce the year from history, not formatting or UI artifacts.
- Notification and archive paths are part of the habit loop, not side quests.
- Gemini/OpenRouter generation controls should improve quality while respecting rate and cost limits.

## What this project refuses

- UI tells that reveal era/year
- silent daily-batch failures
- modes or recovery flows that confuse the core game

## Current direction

- Strengthen daily habit loop, classic range entry, archive data path, recovery, and motion accessibility from backlog.d.
- Keep Convex, auth, deploy, and quality checks wired to real scripts.
- Treat Clio voice as flavor, not permission to weaken engineering gates.

Recent commit signals read for this draft:

- 5cb682b fix(observability): harden Canary ingest-only proof
- 5c6caa1 chore(release): 1.4.0 [skip ci]
- 9322630 feat(observability): migrate Chrondle to Canary
- 607a0da chore(release): 1.3.0 [skip ci]
- aa5fa9f feat: add Duel mode, remove Groups mode, scoring clarity (#244)

## Operating guardrails

Primary gates and checks from the repo-fleet registry:

- bun run lint
- bun run type-check
- bun run test
- bun run build
- bun run quality

Live QA / operator routes:

- `bun run dev`; `bun run test:e2e` / targeted Playwright when UI/gameplay changes; `bun run deploy:verify` only for deployment verification when scoped.

Side-effect constraints:

- live game/Convex/Stripe surfaces. Do not deploy or touch live Stripe/Convex production without explicit scope.

No dirty working-tree entries were present when this draft was generated.

## Open question

Chrondle was previously backburnered. Keep this vision if the daily history game
is active again; otherwise treat it as a preserved direction for a later return.
