### [CODE QUALITY] LOW - Deduplicate OrderEvent type in useTodaysOrderPuzzle

**Files**: `src/hooks/useTodaysOrderPuzzle.ts`, `src/types/orderGameState.ts`
**Problem**: `OrderEvent` interface (lines 32-36) duplicates the definition in `src/types/orderGameState.ts` (lines 65-69).
**Fix**: Import `OrderEvent` from shared types module instead of defining locally.
**Effort**: 10m | **Benefit**: Single source of truth for type, no drift
**Source**: PR #85 CodeRabbit review (nitpick)

### [CODE QUALITY] LOW - Document defensive error state in usePuzzleData

**Files**: `src/hooks/data/usePuzzleData.ts:97-103`, `src/hooks/data/useOrderPuzzleData.ts:82-88`
**Problem**: "No daily puzzle available" error branch may be unreachable (on-demand generation returns isLoading when null). Unclear if defensive or dead code.
**Fix**: Add comment explaining when this state could occur, or remove if truly unreachable.
**Effort**: 15m | **Benefit**: Clarifies code intent for future maintainers
**Source**: PR #85 CodeRabbit review (nitpick)
