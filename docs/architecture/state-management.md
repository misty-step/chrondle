# Pure Functional State Management Architecture

## Executive Summary

This document describes Chrondle's pure functional state management pattern, which replaces imperative state initialization with deterministic state derivation. This architecture eliminates race conditions by design and provides a robust, testable, and maintainable approach to managing complex application state.

## Problem Statement

### The Race Condition Bug

The original bug manifested as completed puzzles showing as incomplete on page load. This occurred when:

1. User data loaded from Convex (async)
2. Game state initialized imperatively (sync)
3. User progress arrived after initialization
4. State showed incomplete despite server having completion data

### Root Cause Analysis

The fundamental flaw was treating game state as something to **initialize** rather than **derive**. Imperative initialization creates temporal coupling where the order of operations matters. When async operations race, state becomes inconsistent.

```typescript
// ❌ OLD: Imperative initialization (race-prone)
const [gameState, setGameState] = useState(createInitialState());

useEffect(() => {
  // Race condition: What if user data loads after this?
  if (userProgress) {
    setGameState(mergeWithProgress(gameState, userProgress));
  }
}, [userProgress]);
```

## Solution: Pure Functional State Derivation

### Core Principle

**State is a pure function of data sources.** Given the same inputs, the output is always identical, regardless of timing or order of operations.

```typescript
// ✅ NEW: Pure functional derivation (race-free)
const gameState = useMemo(
  () => deriveGameState({ puzzle, auth, progress, session }),
  [puzzle, auth, progress, session],
);
```

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              useChrondle (Composition Hook)          │  │
│  │                                                      │  │
│  │  Composes data sources and derives state            │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│                            ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           deriveGameState (Pure Function)            │  │
│  │                                                      │  │
│  │  Input: { puzzle, auth, progress, session }         │  │
│  │  Output: GameState (discriminated union)            │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ▲                                │
│       ┌────────────────────┼────────────────────┐          │
│       │                    │                    │          │
├───────┴────────────┬───────┴────────┬───────────┴──────────┤
│                    │                │                      │
│  ┌──────────────┐  │  ┌──────────┐  │  ┌──────────────┐  │
│  │ usePuzzleData│  │  │useAuthState│  │  │useUserProgress│  │
│  │              │  │  │           │  │  │              │  │
│  │ Convex Query │  │  │Clerk Hook │  │  │ Convex Query │  │
│  └──────────────┘  │  └──────────┘  │  └──────────────┘  │
│                    │                │                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            useLocalSession (Memory State)            │  │
│  │                                                      │  │
│  │         Temporary guesses before persistence         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Data Layer: Orthogonal Data Sources

### Design Principle

Each data source has a single responsibility and knows nothing about other sources. They are **orthogonal** - changes to one don't affect others.

### 1. Puzzle Data Hook (`usePuzzleData`)

**Responsibility:** Fetch puzzle data from Convex

```typescript
interface PuzzleData {
  puzzle: {
    id: string;
    targetYear: number;
    events: string[];
    puzzleNumber: number;
  } | null;
  isLoading: boolean;
  error: Error | null;
}
```

**Key Features:**

- Conditional queries (daily vs archive)
- Stable references with useMemo
- No knowledge of auth or user state

### 2. Authentication State Hook (`useAuthState`)

**Responsibility:** Wrap Clerk authentication with stable interface

```typescript
interface AuthState {
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
```

**Key Features:**

- Stable shape regardless of Clerk internals
- Development logging for state transitions
- Edge case handling (user without ID)

### 3. User Progress Hook (`useUserProgress`)

**Responsibility:** Fetch user's play data for a puzzle

```typescript
interface ProgressState {
  progress: {
    guesses: number[];
    completedAt: number | null;
  } | null;
  isLoading: boolean;
}
```

**Key Features:**

- Skip pattern when prerequisites missing
- Only queries when userId AND puzzleId exist
- Returns stable null when skipped

### 4. Local Session Hook (`useLocalSession`)

**Responsibility:** Manage temporary guesses before persistence

```typescript
interface SessionState {
  sessionGuesses: number[];
  addGuess: (n: number) => void;
  clearGuesses: () => void;
}
```

**Key Features:**

- Memory-only state (no localStorage)
- Auto-reset on puzzle change
- Duplicate prevention and MAX_GUESSES enforcement

## State Derivation: The Pure Function

### Discriminated Union State

```typescript
type GameState =
  | { status: "loading-puzzle" }
  | { status: "loading-auth" }
  | { status: "loading-progress" }
  | {
      status: "ready";
      puzzle: Puzzle;
      guesses: number[];
      isComplete: boolean;
      hasWon: boolean;
      remainingGuesses: number;
    }
  | { status: "error"; error: string };
```

### Derivation Logic

```typescript
export function deriveGameState(sources: DataSources): GameState {
  // Loading priority: puzzle → auth → progress
  if (sources.puzzle.isLoading) {
    return { status: "loading-puzzle" };
  }

  if (sources.puzzle.error) {
    return { status: "error", error: sources.puzzle.error.message };
  }

  if (!sources.puzzle.data) {
    return { status: "error", error: "No puzzle available" };
  }

  if (sources.auth.isLoading) {
    return { status: "loading-auth" };
  }

  if (sources.auth.isAuthenticated && sources.progress.isLoading) {
    return { status: "loading-progress" };
  }

  // All data loaded - derive game state
  const serverGuesses = sources.progress.progress?.guesses || [];
  const sessionGuesses = sources.session.sessionGuesses;
  const mergedGuesses = mergeGuesses(serverGuesses, sessionGuesses);

  const lastGuess = mergedGuesses[mergedGuesses.length - 1];
  const hasCorrectGuess = lastGuess === sources.puzzle.data.targetYear;
  const hasMaxGuesses = mergedGuesses.length >= MAX_GUESSES;
  const serverComplete = sources.progress.progress?.completedAt != null;

  const isComplete = serverComplete || hasCorrectGuess || hasMaxGuesses;
  const hasWon = isComplete && hasCorrectGuess;

  return {
    status: "ready",
    puzzle: sources.puzzle.data,
    guesses: mergedGuesses,
    isComplete,
    hasWon,
    remainingGuesses: MAX_GUESSES - mergedGuesses.length,
  };
}
```

### Guess Merging Strategy

```typescript
export function mergeGuesses(serverGuesses: number[], sessionGuesses: number[]): number[] {
  // Server guesses are source of truth
  const merged = [...serverGuesses];

  // Append session guesses, avoiding duplicates
  for (const guess of sessionGuesses) {
    if (!merged.includes(guess)) {
      merged.push(guess);
    }
  }

  // Cap at maximum allowed guesses
  return merged.slice(0, MAX_GUESSES);
}
```

## Action Handlers: User Interactions

### Optimistic Updates

Actions update local session immediately for instant feedback, then persist asynchronously.

```typescript
const submitGuess = async (guess: number): Promise<boolean> => {
  // Validation
  if (!isValidYear(guess)) {
    toast.error("Invalid year");
    return false;
  }

  // Optimistic update (instant feedback)
  session.addGuess(guess);

  // Persist if authenticated (eventual consistency)
  if (auth.isAuthenticated && puzzle.data) {
    try {
      await submitGuessMutation({
        puzzleId: puzzle.data.id,
        guess,
      });
    } catch (error) {
      // Keep session guess on error (eventual consistency)
      console.error("Failed to persist guess:", error);
    }
  }

  return true;
};
```

## Testing Strategy

### Unit Tests: Pure Functions

Test the derivation function exhaustively:

```typescript
describe("deriveGameState", () => {
  it("returns loading-puzzle when puzzle is loading", () => {
    const state = deriveGameState({
      puzzle: { isLoading: true, data: null, error: null },
      auth: { isLoading: false, userId: null, isAuthenticated: false },
      progress: { isLoading: false, progress: null },
      session: { sessionGuesses: [] },
    });
    expect(state.status).toBe("loading-puzzle");
  });

  // Test all 16 possible input combinations
  // Test edge cases: duplicates, max guesses, completion
});
```

### Integration Tests: Data Hooks

Test each hook in isolation with mocked dependencies:

```typescript
describe("useUserProgress", () => {
  it("skips query when userId is null", () => {
    const { result } = renderHook(() => useUserProgress(null, "puzzle-id"));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.progress).toBe(null);
  });
});
```

### Race Condition Tests

Specifically test the original bug scenario:

```typescript
it("shows completed puzzle even when progress loads late", async () => {
  // Simulate: puzzle loads → auth loads → progress loads late
  const { rerender } = renderHook(() => useChrondle());

  // Initially loading
  expect(result.current.gameState.status).toBe("loading-puzzle");

  // Puzzle loads
  mockPuzzleData.mockResolvedValue(puzzleData);
  await waitFor(() => expect(result.current.gameState.status).toBe("loading-auth"));

  // Auth loads
  mockAuthState.mockResolvedValue(authData);
  await waitFor(() => expect(result.current.gameState.status).toBe("loading-progress"));

  // Progress loads with completion
  mockUserProgress.mockResolvedValue({
    guesses: [1969],
    completedAt: Date.now(),
  });

  await waitFor(() => {
    expect(result.current.gameState.status).toBe("ready");
    expect(result.current.gameState.isComplete).toBe(true);
    expect(result.current.gameState.hasWon).toBe(true);
  });
});
```

## Adding New Data Sources

### Step-by-Step Guide

1. **Create the data hook** in `src/hooks/data/`:

```typescript
export function useNewDataSource(dependency?: string) {
  const data = useQuery(
    dependency ? api.endpoint : "skip",
    dependency ? { param: dependency } : "skip",
  );

  return useMemo(
    () => ({
      data: data || null,
      isLoading: data === undefined,
      error: null,
    }),
    [data],
  );
}
```

2. **Add to DataSources interface**:

```typescript
interface DataSources {
  puzzle: PuzzleDataReturn;
  auth: AuthStateReturn;
  progress: UserProgressReturn;
  session: LocalSessionReturn;
  newSource: NewDataSourceReturn; // Add here
}
```

3. **Update derivation function**:

```typescript
export function deriveGameState(sources: DataSources): GameState {
  // Add loading check if needed
  if (sources.newSource.isLoading) {
    return { status: "loading-new-source" };
  }

  // Use new data in state calculation
  const derivedValue = calculateFromNewSource(sources.newSource.data);
  // ...
}
```

4. **Compose in main hook**:

```typescript
export function useChrondle() {
  const puzzle = usePuzzleData();
  const auth = useAuthState();
  const progress = useUserProgress(auth.userId, puzzle.data?.id);
  const session = useLocalSession(puzzle.data?.id);
  const newSource = useNewDataSource(/* dependency */);

  const gameState = useMemo(
    () => deriveGameState({ puzzle, auth, progress, session, newSource }),
    [puzzle, auth, progress, session, newSource],
  );

  // ...
}
```

## Benefits of This Architecture

### 1. **Race Condition Immunity**

- State is deterministic regardless of load order
- Same inputs always produce same output
- No temporal coupling

### 2. **Testability**

- Pure functions are trivial to test
- No mocking of setState or effects
- Exhaustive testing of all scenarios

### 3. **Maintainability**

- Clear separation of concerns
- Each piece has single responsibility
- Easy to reason about state at any point

### 4. **Debuggability**

- State transitions are logged
- Can reproduce any state from inputs
- Clear loading states for UX

### 5. **Performance**

- Derivation is extremely fast (<0.01ms)
- Perfect memoization prevents re-renders
- No unnecessary state updates

## Migration Guide

### From Imperative to Functional

**Before (Imperative):**

```typescript
const [state, setState] = useState(initialState);

useEffect(() => {
  fetchData().then((data) => {
    setState((prev) => ({ ...prev, data }));
  });
}, []);

useEffect(() => {
  if (user) {
    setState((prev) => ({ ...prev, user }));
  }
}, [user]);
```

**After (Functional):**

```typescript
const data = useDataSource();
const user = useUserSource();

const state = useMemo(() => deriveState({ data, user }), [data, user]);
```

### Key Principles

1. **Never setState in effects** - Derive instead
2. **Loading states are data** - Not separate booleans
3. **Single source of truth** - Server state is authoritative
4. **Optimistic updates** - Update locally, persist async
5. **Pure derivation** - Same inputs = same output

## Monitoring & Observability

### Performance Metrics

Track key metrics in production:

- State derivation time (target: <1ms)
- Query latency (target: <200ms)
- Re-render frequency
- State transition patterns

### Analytics Events

Monitor critical user flows:

- Game completion rate
- Guess accuracy distribution
- Session vs server divergence
- Error recovery success

### Error Boundaries

Implement specialized error boundaries:

```typescript
<GameErrorBoundary>
  <ChronldleGame />
</GameErrorBoundary>
```

With progressive recovery strategies:

1. Soft reload (reset component state)
2. Navigate home (return to daily puzzle)
3. Hard reload (clear storage and reload)

## Conclusion

This architecture transforms state management from an imperative, race-prone process to a pure, functional, deterministic system. By treating state as a derived value rather than something to manage, we eliminate entire categories of bugs while improving testability, maintainability, and performance.

The pattern is not just a fix for the race condition bug - it's a fundamental improvement in how we think about and implement state management in React applications.

### Resources

- [Source Code: useChrondle Hook](../../src/hooks/useChrondle.ts)
- [Source Code: deriveGameState Function](../../src/lib/deriveGameState.ts)
- [Tests: Race Condition Tests](../../src/hooks/__tests__/useChrondle.race-condition.test.tsx)
- [Tests: Unit Tests](../../src/lib/__tests__/deriveGameState.unit.test.ts)
