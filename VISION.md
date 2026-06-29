# Chrondle Vision

Status: canonical preserved vision for Chrondle. Chrondle is backburnered for
now; this file keeps the intended shape intact so a future agent can restart
without re-litigating the product.

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

## Preserved Direction

- Do not start new product surface until Misty Step's higher-priority revenue,
  agent infrastructure, and eval work have room for it.
- When the project returns, start by strengthening the daily habit loop, classic
  range entry, archive data path, recovery, and motion accessibility from
  `backlog.d`.
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

## Decision

Chrondle is not an active Misty Step bet right now. The vision is still useful:
it preserves the fair-history-game promise and prevents a future restart from
turning into generic trivia or AI-generated puzzle churn.
