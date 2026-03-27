# Improve Order mode affordance and accessibility

Priority: high
Status: ready
Estimate: M

## Goal
Make Order mode immediately understandable to new players and properly described to assistive technologies.

## Non-Goals
- Redesign Order scoring or puzzle generation
- Replace drag-and-drop with a different interaction model
- Bundle dead-code cleanup into the same item

## Oracle
- [ ] [behavioral] The drag affordance clearly communicates where and how to drag on first use.
- [ ] [behavioral] The drag handle has an accessible label and any helper affordance does not interfere with keyboard reordering.
- [ ] [test] Add or extend coverage for the drag-handle accessibility contract and the first-use affordance behavior.
- [ ] [command] `bun run lint && bun run type-check && bun run test`

## Notes
- Related GitHub issues: `#98`, `#114`
- Evidence: [DraggableEventCard.tsx](/Users/phaedrus/.codex/worktrees/087b/chrondle/src/components/order/DraggableEventCard.tsx) still renders a handle without an ARIA label, and open issue `#98` captures ongoing first-use confusion around the drag model.
- Touchpoints: `src/components/order/DraggableEventCard.tsx`, `src/components/order/OrderGameBoard.tsx`, Order-mode helper UI, related tests.
