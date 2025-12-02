# Order Mode Bug Fixes - Architecture Design

## Architecture Overview

**Selected Approach**: Minimal Surgical Fixes

**Rationale**: All three bugs are localized—no architectural changes needed. Fix the control flow in `useOrderGame`, reuse `useWebShare` directly, delete dead code. PRD's "Unify on Existing Infrastructure" approach is correct.

**Core Modules** (modifications only):

- `useOrderGame.ts`: Fix persistence ordering + add isSubmitting + toast integration
- `OrderGameIsland.tsx`: Wire `useWebShare` directly
- `ArchiveOrderPuzzleClient.tsx`: Wire `useWebShare` directly
- `OrderReveal.tsx`: Remove ComparisonGrid
- `shareCard.ts`: Delete `copyArchivalShareTextToClipboard`

**Data Flow Change** (P0 only):

```
Before: submitAttempt → addAttempt → markCompleted → persistToServer (fire-and-forget)
After:  submitAttempt → addAttempt → persistToServer → [success?] → markCompleted
```

---

## Module: useOrderGame (P0 - Critical)

**Problem**: Game marks completed before server confirms persistence.

**Root Cause** (`useOrderGame.ts:200-209`):

```typescript
// Current (broken)
if (isSolved(attempt)) {
  session.markCompleted(score); // ← completes locally first
  await persistToServer(attempt, allAttempts, score); // ← server call ignored
}
```

**Fix**: Await and validate persistence BEFORE marking completed.

### Interface Changes

```typescript
interface UseOrderGameReturn {
  gameState: OrderGameState;
  reorderEvents: (fromIndex: number, toIndex: number) => void;
  submitAttempt: () => Promise<OrderAttempt | null>;
  isSubmitting: boolean; // NEW: disable UI during persistence
}
```

### Implementation Pseudocode

```pseudocode
function submitAttempt():
  1. Guard: if no puzzle or isSubmitting, return null

  2. Set isSubmitting = true

  3. Create attempt from current ordering
     attempt = createAttempt(ordering, events)

  4. Add attempt to session (for immediate UI feedback)
     session.addAttempt(attempt)

  5. Check if solved
     if NOT isSolved(attempt):
       Set isSubmitting = false
       return attempt

  6. Calculate score
     allAttempts = [...existingAttempts, attempt]
     score = calculateAttemptScore(allAttempts)

  7. Persist to server (await result!)
     [success, error] = await persistToServer(attempt, allAttempts, score)

  8. Handle result
     if success:
       session.markCompleted(score)  // Only now mark complete
     else:
       // Show toast with error - game stays playable
       addToast({
         title: "Couldn't save result",
         description: error.retryable
           ? "Your progress wasn't saved. Try submitting again."
           : "Something went wrong. Your progress is saved locally.",
         variant: "destructive"
       })
       // NOTE: Don't revert the attempt - user can naturally retry

  9. Set isSubmitting = false

  10. return attempt
```

### Toast Integration

Hook needs toast context:

```typescript
export function useOrderGame(
  puzzleNumber?: number,
  initialPuzzle?: unknown,
  addToast?: (toast: Omit<Toast, "id">) => void, // Optional dependency injection
): UseOrderGameReturn;
```

**Alternative**: Pass `addToast` via hook composition in consumer (cleaner, no API change):

```typescript
// In OrderGameIsland.tsx
const { addToast } = useToast();
const { gameState, reorderEvents, submitAttempt, isSubmitting } = useOrderGame();

const handleSubmit = async () => {
  const attempt = await submitAttempt();
  if (gameState.status !== "completed" && attempt && isSolved(attempt)) {
    // Persistence failed - show toast
    addToast({ title: "...", variant: "destructive" });
  }
};
```

**Decision**: Inject `addToast` into hook directly. Keeps error handling colocated with persistence logic. Cleaner consumer code.

### Dependencies

- **Requires**: `useToast` (via prop injection or import)
- **No changes to**: Convex mutations, schema, OrderSession

---

## Module: OrderGameIsland + ArchiveOrderPuzzleClient (P1 - Share)

**Problem**: Uses `copyArchivalShareTextToClipboard` which bypasses `useWebShare` platform detection.

**Fix**: Use `useWebShare` directly, delete dead abstraction.

### Current Code (broken)

```typescript
// OrderGameIsland.tsx:59-71
const handleShare = async () => {
  await copyArchivalShareTextToClipboard({...});  // ← no native share
  setShareFeedback("Copied to clipboard!");
};
```

### Fixed Code

```typescript
// OrderGameIsland.tsx
import { useWebShare } from "@/hooks/useWebShare";
import { generateArchivalShareText } from "@/lib/order/shareCard";

// In component:
const { share, shareMethod } = useWebShare();

const handleShare = async () => {
  const text = generateArchivalShareText({
    puzzleNumber: gameState.puzzle.puzzleNumber,
    score: gameState.score,
    attempts: gameState.attempts,
  });

  const success = await share(text);

  if (success) {
    // shareMethod tells us what happened
    setShareFeedback(shareMethod === "webshare" ? "Shared!" : "Copied to clipboard!");
  } else {
    setShareFeedback("Share failed. Try again.");
  }
};
```

### Data Flow

```
generateArchivalShareText(payload) → useWebShare.share(text) → native/clipboard/fallback
```

### Changes Required

1. `OrderGameIsland.tsx`: Replace share handler
2. `ArchiveOrderPuzzleClient.tsx`: Same replacement
3. `shareCard.ts`: Delete `copyArchivalShareTextToClipboard` function

---

## Module: OrderReveal (P2 - Game Over Cleanup)

**Problem**: Shows ComparisonGrid which is redundant (win = correct order already).

**Fix**: Remove ComparisonGrid render and props.

### Current Interface

```typescript
interface OrderRevealProps {
  events: OrderEvent[];
  finalOrder: string[];
  correctOrder: string[]; // ← DELETE (unused after removing ComparisonGrid)
  score: AttemptScore;
  puzzleNumber: number;
  onShare?: () => void;
}
```

### Simplified Interface

```typescript
interface OrderRevealProps {
  events: OrderEvent[]; // Keep for event count in messaging
  finalOrder: string[]; // Keep for potential future use
  score: AttemptScore;
  puzzleNumber: number;
  onShare?: () => void;
}
```

### Render Changes

```typescript
// DELETE this entire motion.div block (lines 155-166):
<motion.div className="...">
  <ComparisonGrid events={events} finalOrder={finalOrder} correctOrder={correctOrder} />
</motion.div>
```

### ComparisonGrid Deletion

- Only imported in `OrderReveal.tsx`
- Safe to delete `src/components/order/ComparisonGrid.tsx` entirely

---

## Module: shareCard.ts Cleanup

**Delete**:

- `copyArchivalShareTextToClipboard` function (lines 52-62)

**Keep**:

- `generateArchivalShareText` (pure function, used by components)
- `OrderSharePayload`, `OrderShareResult` types (may be used elsewhere)
- `generateOrderShareText`, `copyOrderShareTextToClipboard` (legacy, check usage first)

### Usage Check Before Deletion

```bash
rg "generateOrderShareText|copyOrderShareTextToClipboard" --type ts
```

If only in `shareCard.ts`, delete them too.

---

## File Organization

```
src/
  hooks/
    useOrderGame.ts           # P0: Fix persistence flow + isSubmitting + toast
    useWebShare.ts            # Existing, no changes
    use-toast.tsx             # Existing, no changes

  lib/order/
    shareCard.ts              # P1: DELETE copyArchivalShareTextToClipboard

  components/order/
    OrderGameIsland.tsx       # P1: Wire useWebShare directly
    ArchiveOrderPuzzleClient.tsx  # P1: Wire useWebShare directly
    OrderReveal.tsx           # P2: Remove ComparisonGrid + correctOrder prop
    ComparisonGrid.tsx        # P2: DELETE file entirely
```

---

## State Management

**isSubmitting State** (new):

- Lives in `useOrderGame` hook (local state)
- True during persistence attempt
- Consumers use to disable submit button

**Error State**:

- Not persisted - toast notification sufficient
- Game stays in "ready" state on failure (existing attempts preserved)
- User can naturally retry by submitting again

---

## Error Handling Strategy

**Persistence Failure**:

1. Toast appears with clear message
2. Game stays playable (attempts preserved in session)
3. User can retry naturally
4. No special "retry" UI - just submit again

**Error Messages**:

```typescript
// Retryable (network, timeout)
{
  title: "Couldn't save result",
  description: "Your progress wasn't saved. Try submitting again.",
  variant: "destructive"
}

// Non-retryable (auth, validation)
{
  title: "Save failed",
  description: "Something went wrong. Your local progress is preserved.",
  variant: "destructive"
}
```

---

## Testing Strategy

### Unit Tests

**useOrderGame persistence**:

- Mock `persistToServer` success → `markCompleted` called
- Mock `persistToServer` failure → `markCompleted` NOT called, toast shown
- `isSubmitting` true during persistence, false after

**Share**:

- `generateArchivalShareText` output format (existing tests)

### Integration Tests

**Persistence E2E**:

1. Complete Order puzzle
2. Verify Convex mutation called
3. Refresh page
4. Verify completed state restored

**Share E2E**:

- Mobile: verify `navigator.share` called
- Desktop: verify clipboard write

### Manual Test Scenarios

- [ ] Complete puzzle with slow network → completion waits for server
- [ ] Complete puzzle with network failure → toast appears, game stays playable
- [ ] Mobile Safari share → native share sheet opens
- [ ] Desktop share → clipboard copy, feedback shown
- [ ] Game over screen → no ComparisonGrid visible

---

## Implementation Sequence

### Phase 1: Persistence Fix (P0)

1. Add `isSubmitting` state to `useOrderGame`
2. Add `addToast` parameter to hook
3. Restructure `submitAttempt`:
   - Move `markCompleted` after `persistToServer`
   - Add error handling with toast
4. Update `UseOrderGameReturn` interface
5. Wire toast in `OrderGameIsland` + `ArchiveOrderPuzzleClient`
6. Test: network failure shows toast, refresh preserves on success

### Phase 2: Share Unification (P1)

1. Update `OrderGameIsland` share handler
2. Update `ArchiveOrderPuzzleClient` share handler
3. Delete `copyArchivalShareTextToClipboard` from `shareCard.ts`
4. Check and delete other unused share functions
5. Test: mobile native share, desktop clipboard

### Phase 3: Game Over Cleanup (P2)

1. Remove ComparisonGrid from `OrderReveal`
2. Remove `correctOrder` prop from `OrderReveal`
3. Update callers to not pass `correctOrder`
4. Delete `ComparisonGrid.tsx` file
5. Test: game over screen clean

---

## Risk Mitigation

| Risk                                     | Mitigation                                           |
| ---------------------------------------- | ---------------------------------------------------- |
| Race condition in persistence            | Single `isSubmitting` guard, no parallel submissions |
| Toast context missing                    | Hook has safe default (no-op) if context unavailable |
| Share format change breaks expectations  | `generateArchivalShareText` unchanged                |
| Removing ComparisonGrid breaks something | Grep confirms only used in OrderReveal               |

---

## Alternatives Considered

### Persistence

| Approach                        | Why Not                                             |
| ------------------------------- | --------------------------------------------------- |
| Add explicit retry button       | Over-engineering; natural resubmit works            |
| Optimistic update with rollback | More complex; current UX (toast + retry) sufficient |
| Queue failed mutations          | Overkill for single-mutation flow                   |

### Share

| Approach                                | Why Not                                 |
| --------------------------------------- | --------------------------------------- |
| Create `useOrderShare` wrapper          | Premature abstraction; only 2 consumers |
| Keep `copyArchivalShareTextToClipboard` | Bypasses platform detection             |

### Game Over

| Approach                             | Why Not                           |
| ------------------------------------ | --------------------------------- |
| Replace ComparisonGrid with timeline | Adds complexity for minimal value |
| Keep ComparisonGrid but hide on win  | Pointless complexity              |

---

## Success Criteria (from PRD)

- [x] Architecture: Results persist before marking complete
- [x] Architecture: Share uses `useWebShare` for platform detection
- [x] Architecture: Game over screen has no ComparisonGrid
- [ ] Implementation: Results survive page refresh
- [ ] Implementation: Share works identically to Classic mode
- [ ] Implementation: Game over screen is clean and focused
