# Simplify classic range entry

Priority: high
Status: ready
Estimate: M

## Goal
Reduce the control burden of submitting a classic-mode range so most players can narrow and commit a guess through one clear primary interaction path, with focus returning somewhere useful after submission.

## Non-Goals
- Change scoring math, attempt limits, or hint unlock rules
- Remove text entry entirely if it still serves as a useful fallback
- Add era inference, smart validation, or any other answer-leaking behavior

## Oracle
- [ ] [behavioral] A player can set and submit a valid range through one primary control path without having to manually edit both year fields for the common case.
- [ ] [behavioral] Era handling remains fully player-driven; the UI does not infer or suggest BC/AD based on the hidden answer.
- [ ] [behavioral] After a submission, keyboard focus moves to the next useful continuation point instead of leaving the player stranded in the cleared input surface.
- [ ] [test] Add or extend behavioral coverage for the simplified range-entry flow, validation edges, and puzzle-integrity guardrails.
- [ ] [command] `bun run lint && bun run type-check && bun run test`

## Notes
- Related GitHub issues: `#121`
- Evidence: the current flow in [RangeInput.tsx](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/components/game/RangeInput.tsx) requires coordinating two inputs and two era toggles before submission; related presentation and feedback live in [GameLayout.tsx](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/components/GameLayout.tsx), [HintIndicator.tsx](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/components/game/HintIndicator.tsx), and adjacent range controls.
- Touchpoints: `src/components/game/RangeInput.tsx`, `src/components/game/RangeSlider.tsx`, `src/components/game/RangePreview.tsx`, `src/components/GameLayout.tsx`, `src/components/ui/EraToggle.tsx`.
- Constraint: optimize for speed and legibility, not feature count. If text entry stays, it should support the primary interaction rather than define it.
