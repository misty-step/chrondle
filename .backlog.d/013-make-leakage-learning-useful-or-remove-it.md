# Make leakage learning useful or remove it

Priority: medium
Status: ready
Estimate: M

## Goal
Ensure learned semantic-leakage phrases add real signal to puzzle quality checks, or remove the learning path so low-value phrases do not accumulate.

## Non-Goals
- Rebuild the entire event-generation stack
- Add heavyweight NLP just to satisfy a heuristic
- Fold historical-context rendering work into this item

## Oracle
- [ ] [behavioral] Learned phrases contribute meaningful recall or precision by design, rather than storing long event-text fragments that rarely match.
- [ ] [test] Add or update coverage showing how learned phrases are extracted, pruned, or intentionally disabled.
- [ ] [command] `bun run lint && bun run type-check && bun run test`

## Notes
- Related GitHub issues: `#186`
- Evidence: [qualityValidator.ts](/Users/phaedrus/.codex/worktrees/087b/chrondle/convex/lib/qualityValidator.ts) still learns by truncating and storing full event text via `learnFromRejected()`.
- Touchpoints: `convex/lib/qualityValidator.ts`, `convex/data/leakyPhrases.json`, quality-validator tests.
