# Order Mode Bug Fixes: Persistence, Share, Game Over

## Executive Summary

Order mode has three bugs degrading user experience: results don't persist to database (data loss), share produces URL-encoded garbage and skips mobile native share, and game over screen shows redundant comparison grid.

**Solution:** Fix persistence by validating mutation before marking complete (with error feedback), unify share infrastructure with Classic mode via direct `useWebShare` calls, remove ComparisonGrid from game over (NYT Games minimal style).

**Success criteria:** Results survive page refresh, share works identically to Classic mode on all platforms, game over screen is clean and focused.

---

## Requirements

### Functional

**P0 - Persistence**

- Game must NOT mark as completed until server confirms write
- Mutation result must be validated before updating local state
- Failed persistence = game stays in "playing" state (user can retry naturally)
- **Add toast notification on persistence failure** (user-visible error feedback)
- **Add `isSubmitting` loading state** (disable submit during persistence)

**P1 - Share**

- Order mode must use `useWebShare` hook directly (no wrapper hook needed)
- Mobile: trigger native share sheet (`navigator.share`)
- Desktop: copy to clipboard with success feedback
- Share text: keep current archival format (emoji grid per attempt)
- Delete `copyArchivalShareTextToClipboard` function (dead abstraction)

**P2 - Game Over**

- Remove ComparisonGrid entirely (redundant since win = perfect match)
- Screen shows: success banner + share card only
- Match NYT Games aesthetic: celebrate briefly, invite share, done

### Non-Functional

- No new dependencies
- No changes to Convex schema or mutations (they work correctly)
- Maintain existing test coverage patterns

---

## Architecture

### Selected Approach: Unify on Existing Infrastructure

**Rationale (Ousterhout):** Classic mode already has deep modules solving these problems. Order mode should use them, not reinvent. `useWebShare` hides platform detection, fallback chains, and clipboard quirks behind a simple interface. Reuse it directly—no wrapper hook needed until a 3rd mode requires shared abstraction.

### Alternatives Considered

| Approach                             | Simplicity | Risk | Why Not                                                |
| ------------------------------------ | ---------- | ---- | ------------------------------------------------------ |
| Create `useOrderShare` wrapper       | Med        | Low  | Premature abstraction; wait for 3rd mode               |
| Fix Order-specific share code        | Low        | Med  | Creates parallel infrastructure, doubles maintenance   |
| Add retry UI for persistence         | Low        | Low  | Over-engineering; natural retry (resubmit) works fine  |
| Replace ComparisonGrid with timeline | Med        | Low  | Adds complexity for minimal value; NYT doesn't do this |

### Module Changes

**`useOrderGame.ts`** - Fix persistence flow

- Add `isSubmitting` state (disable submit during persistence)
- Await `persistToServer()` and validate result
- Only call `session.markCompleted()` on confirmed success
- Show toast on failure (integrate with toast context)

**`OrderGameIsland.tsx`** - Wire share directly

- Import `useWebShare` directly (no wrapper)
- Generate text via `generateArchivalShareText`, pass to `share()`
- Delete import of `copyArchivalShareTextToClipboard`

**`shareCard.ts`** - Cleanup

- Delete `copyArchivalShareTextToClipboard` function (bypasses abstractions)
- Keep `generateArchivalShareText` (pure function, used by component)

**`OrderReveal.tsx`** - Simplify game over

- Remove `ComparisonGrid` render
- Remove `correctOrder` prop
- Keep: success banner, share card, animations

---

## Implementation Phases

### Phase 1: Persistence Fix (Critical Path)

1. Add `isSubmitting` state to `useOrderGame.ts`
2. Restructure `submitAttempt` to await and validate mutation result
3. Only call `session.markCompleted()` on confirmed success
4. Add toast context integration for error feedback
5. Test: complete puzzle, refresh, verify data persists
6. Test: simulate network failure, verify toast appears, game stays playable

### Phase 2: Share Unification

1. In `OrderGameIsland.tsx`: import `useWebShare` directly
2. Replace `copyArchivalShareTextToClipboard` call with:
   ```typescript
   const text = generateArchivalShareText({ puzzleNumber, score, attempts });
   await share(text);
   ```
3. Update `ArchiveOrderPuzzleClient.tsx` similarly
4. Delete `copyArchivalShareTextToClipboard` from `shareCard.ts`
5. Test: mobile native share, desktop clipboard, emoji rendering

### Phase 3: Game Over Cleanup

1. Remove `ComparisonGrid` from `OrderReveal.tsx`
2. Remove unused props and imports
3. Verify animations still work
4. Check if `ComparisonGrid.tsx` used elsewhere → delete if safe

---

## Risks & Mitigation

| Risk                                          | Likelihood | Impact | Mitigation                                 |
| --------------------------------------------- | ---------- | ------ | ------------------------------------------ |
| Persistence fix creates race condition        | Low        | High   | Follow Classic mode pattern exactly        |
| Share text format changes break expectations  | Low        | Med    | Keep `generateArchivalShareText` unchanged |
| Removing ComparisonGrid breaks something else | Low        | Low    | Check for other usages before deletion     |

---

## Test Scenarios

**Persistence**

- [ ] Complete Order puzzle → refresh → results still there
- [ ] Complete puzzle with slow network → verify completion waits for server
- [ ] Simulate mutation failure → game stays playable, can retry

**Share**

- [ ] Mobile Safari: tapping share opens native share sheet
- [ ] Mobile Chrome: tapping share opens native share sheet
- [ ] Desktop: tapping share copies to clipboard, shows feedback
- [ ] Pasted share text shows emojis correctly (not URL-encoded)

**Game Over**

- [ ] Win Order puzzle → see success banner + share card only
- [ ] No ComparisonGrid visible
- [ ] Animations still smooth

---

## Key Files

```
src/hooks/useOrderGame.ts              # P0: Fix persistence + add isSubmitting + toast
src/hooks/useWebShare.ts               # P1: Existing, reuse directly
src/lib/order/shareCard.ts             # P1: Keep generateArchivalShareText, DELETE copyArchivalShareTextToClipboard
src/components/order/OrderReveal.tsx   # P2: Remove ComparisonGrid render + props
src/components/order/OrderGameIsland.tsx        # P1+P2: Wire useWebShare directly, remove correctOrder prop
src/components/order/ArchiveOrderPuzzleClient.tsx  # P1: Wire useWebShare directly
src/components/order/ComparisonGrid.tsx # P2: Check usage → delete if safe
```

## Follow-Up (Technical Debt)

- Verify `generateOrderShareText` in `shareCard.ts` is dead code → delete if unused
- Consider extracting shared emoji formatters if pattern repeats in 3rd mode
