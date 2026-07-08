# Make leakage learning useful or remove it

Priority: medium
Status: absorbed
Estimate: M

Decision: absorbed by Powder card `chrondle-ux-leakage-learning-decision`. The write-only leakage-learning path was deleted;
the curated `convex/data/leakyPhrases.json` detector remains as the named
generation-quality consumer through the event-generation critic.

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
- Evidence: the event-generation critic consumes `QualityValidatorImpl` for
  deterministic leakage scoring; the rejected-event writeback was removed
  because it had no visible eval/report/admin consumer and stored full event
  fragments that rarely matched future candidates.
- Touchpoints: `convex/lib/qualityValidator.ts`, `convex/actions/eventGeneration/critic.ts`, `convex/data/leakyPhrases.json`, quality-validator tests.
