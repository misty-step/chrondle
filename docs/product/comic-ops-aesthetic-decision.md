# Design decision: Misty Step comic-ops aesthetic — NO-ADOPT

**Date:** 2026-07-07
**Card:** `chrondle-eng-ui-tokens` (absorbs `backlog.d/017-adopt-misty-step-comic-ops-aesthetic.md`)
**Lab:** [`docs/labs/comic-ops-aesthetic-lab.html`](../labs/comic-ops-aesthetic-lab.html) — 8 structurally
distinct options rendered against the classic game surface (masthead, hint card, guess input, guess history).

## Decision

Chrondle does **not** adopt the Misty Step comic-ops aesthetic on any product surface.
The bespoke archival token system — Outfit/Karla, 4px radius, paper metaphor, and the
`feedback-*` / `surface-*` / `mode-*` semantic tokens in `src/app/globals.css` — is the
design system of record. The token sweep, `ui/` vs `kit/` registry split, and vendor-boundary
centralization shipped with this card are the implementation of that direction.

## Rationale (summary; full text in the lab verdict block)

1. **Puzzle clarity.** Halftone fields, ink outlines, offset shadows, and rotated display type add
   noise exactly where the game needs fast scanning of year digits and EARLIER/LATER direction.
2. **Genre trust and revenue.** Chrondle is a paid, live, Wordle-genre daily. Its quiet NYT-adjacent
   register is a conversion asset; a comic register repositions the brand with no user benefit.
3. **Comic-ops is the fleet's internal ops voice,** not a consumer-product skin. Identity coherence
   for the product beats visual coherence with the fleet.
4. **Partial flavors fail too.** Chrome-only and moments-only put two competing registers on one
   screen; the win-moment gag wears out on a daily habit product.
5. **Runner-up noted:** a comic-ops **share card** (option 7) is the one surface where loudness could
   earn its keep — flagged as a possible future standalone ticket, not shipped here.

## Consequences

- `@misty-step/aesthetic` is not a Chrondle dependency.
- New UI must use the semantic tokens (enforced by the pre-commit primitive-token check);
  raw hex and primitive Tailwind palette colors are regressions.
- Re-opening this decision requires beating the lab's baseline option with a rendered alternative,
  per the house design-labs law.
