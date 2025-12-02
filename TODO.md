# TODO: Order Mode Bug Fixes

## Context

- Architecture: DESIGN.md - Minimal Surgical Fixes approach
- Key Files: useOrderGame.ts, OrderGameIsland.tsx, ArchiveOrderPuzzleClient.tsx, OrderReveal.tsx, shareCard.ts
- Patterns: Follow useWebShare usage in Classic mode, toast patterns in existing hooks

## P0 - Persistence Fix (Critical)

- [x] Fix persistence flow in useOrderGame

  ```
  Files: src/hooks/useOrderGame.ts

  Changes:
  1. Add isSubmitting state (useState)
  2. Add addToast parameter to hook signature
  3. Restructure submitAttempt (lines 185-213):
     - Guard: early return if isSubmitting
     - Set isSubmitting = true at start
     - Move session.markCompleted(score) AFTER persistToServer
     - Handle persistence failure: show toast, don't mark completed
     - Set isSubmitting = false in finally block
  4. Update UseOrderGameReturn interface to include isSubmitting

  Pseudocode: See DESIGN.md "Implementation Pseudocode" section

  Success:
  - session.markCompleted only called when persistToServer returns success
  - isSubmitting prevents double-submit
  - Toast shown on persistence failure

  Test: Mock persistToServer failure → verify markCompleted not called, toast shown
  Dependencies: None
  Time: 45min
  ```

- [x] Wire toast and isSubmitting in consumers

  ```
  Files:
  - src/components/order/OrderGameIsland.tsx
  - src/components/order/ArchiveOrderPuzzleClient.tsx
  - src/components/order/OrderGameBoard.tsx

  Changes:
  1. OrderGameIsland + ArchiveOrderPuzzleClient:
     - Import useToast, pass addToast to useOrderGame
     - Destructure isSubmitting from useOrderGame return
     - Pass isSubmitting to OrderGameBoard

  2. OrderGameBoard:
     - Remove local isSubmitting state (line 19)
     - Accept isSubmitting as prop
     - Remove setIsSubmitting calls in handleSubmit (lines 63-68)

  Success:
  - isSubmitting flows from hook → consumer → OrderGameBoard
  - No duplicate state
  - Submit button disabled during persistence

  Test: Submit → button disabled → wait for response → button enabled
  Dependencies: P0 task 1
  Time: 30min
  ```

## P1 - Share Unification

- [x] Replace share handlers with useWebShare

  ```
  Files:
  - src/components/order/OrderGameIsland.tsx (lines 59-71)
  - src/components/order/ArchiveOrderPuzzleClient.tsx (lines 63-76)

  Changes (both files identical):
  1. Remove: import { copyArchivalShareTextToClipboard }
  2. Add: import { useWebShare } from "@/hooks/useWebShare"
  3. Add: import { generateArchivalShareText } from "@/lib/order/shareCard"
  4. In component: const { share, shareMethod } = useWebShare()
  5. Replace handleShare:
     const text = generateArchivalShareText({
       puzzleNumber: gameState.puzzle.puzzleNumber,
       score: gameState.score,
       attempts: gameState.attempts,
     });
     const success = await share(text);
     setShareFeedback(success
       ? (shareMethod === "webshare" ? "Shared!" : "Copied to clipboard!")
       : "Share failed. Try again."
     );

  Success:
  - Mobile: native share sheet opens
  - Desktop: clipboard copy with feedback
  - Emoji text renders correctly (not URL-encoded)

  Test: Mobile Safari → native share, Desktop → clipboard
  Dependencies: None (can parallel with P0)
  Time: 30min
  ```

- [x] Delete dead share abstractions

  ```
  Files: src/lib/order/shareCard.ts

  Delete (lines 49-127):
  - copyArchivalShareTextToClipboard function (lines 52-62)
  - OrderSharePayload type (lines 70-81)
  - OrderShareResult type (line 68)
  - generateHintsBar function (lines 86-90)
  - generateOrderShareText function (lines 97-113)
  - copyOrderShareTextToClipboard function (lines 119-127)

  Keep:
  - ArchivalSharePayload type (lines 12-17)
  - generateArchivalShareText function (lines 34-47)

  Also update tests:
  - src/lib/order/__tests__/shareCard.test.ts - remove tests for deleted functions
  - src/lib/order/__tests__/shareCard.division-guards.unit.test.ts - remove if only tests deleted code

  Success: Only generateArchivalShareText remains, tests pass
  Test: pnpm test -- shareCard
  Dependencies: P1 task 1 (consumers updated first)
  Time: 20min
  ```

## P2 - Game Over Cleanup

- [x] Remove ComparisonGrid from OrderReveal

  ```
  Files: src/components/order/OrderReveal.tsx

  Changes:
  1. Remove: import { ComparisonGrid } from "./ComparisonGrid" (line 8)
  2. Remove: correctOrder from props interface (line 13)
  3. Delete entire motion.div containing ComparisonGrid (lines 155-166)
  4. Remove correctOrder from function params (line 53)

  Success: Game over shows only success banner + share card
  Test: Win Order puzzle → no ComparisonGrid visible
  Dependencies: None (can parallel with P0/P1)
  Time: 15min
  ```

- [x] Update OrderReveal callers to remove correctOrder prop

  ```
  Files:
  - src/components/order/OrderGameIsland.tsx (lines 77-84)
  - src/components/order/ArchiveOrderPuzzleClient.tsx (lines 91-98)

  Changes: Remove correctOrder={gameState.correctOrder} from OrderReveal calls

  Success: No TypeScript errors, render unchanged
  Test: Type check passes
  Dependencies: P2 task 1
  Time: 10min
  ```

- [x] Delete ComparisonGrid component

  ```
  Files: src/components/order/ComparisonGrid.tsx

  Action: Delete entire file

  Verification before deletion:
  - rg "ComparisonGrid" → should only show OrderReveal.tsx (now removed)

  Success: File deleted, no import errors
  Test: pnpm type-check
  Dependencies: P2 tasks 1-2
  Time: 5min
  ```

## Verification

After all tasks:

```bash
pnpm lint && pnpm type-check && pnpm test
```

Manual testing:

- [ ] Complete Order puzzle → refresh → results persist
- [ ] Simulate network failure → toast appears, can retry
- [ ] Mobile share → native share sheet
- [ ] Desktop share → clipboard copy
- [ ] Game over → clean screen (no ComparisonGrid)
