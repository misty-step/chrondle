# Migration Guide: From Imperative State to Pure Derivation

## Overview

This guide helps you migrate from imperative state management to pure functional state derivation. This pattern eliminates race conditions, improves testability, and makes state predictable.

## Quick Assessment

Before migrating, check if your component has these symptoms:

- ✅ Multiple `useEffect` hooks updating state
- ✅ State synchronization issues between different data sources
- ✅ Race conditions when data loads in different orders
- ✅ Complex state initialization logic
- ✅ Difficulty testing state transitions
- ✅ "Flashing" incorrect state before correct state appears

If you checked 2+ boxes, this pattern will help.

## Core Principle

**OLD WAY**: Manage state imperatively

```typescript
const [state, setState] = useState(initialState);
useEffect(() => {
  if (dataA) setState((prev) => ({ ...prev, dataA }));
}, [dataA]);
useEffect(() => {
  if (dataB) setState((prev) => ({ ...prev, dataB }));
}, [dataB]);
```

**NEW WAY**: Derive state functionally

```typescript
const state = useMemo(() => deriveState({ dataA, dataB }), [dataA, dataB]);
```

## Real-World Example: Before and After

### Before: Imperative State Management

```typescript
// ❌ OLD: Race-prone imperative approach
export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();

  // Race condition: What if user changes during fetch?
  useEffect(() => {
    if (user) {
      setIsLoading(true);
      fetchUserProfile(user.id)
        .then((data) => {
          setProfile(data);
          setIsLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setIsLoading(false);
        });
    }
  }, [user]);

  // Another race: Posts might load before profile
  useEffect(() => {
    if (user) {
      fetchUserPosts(user.id)
        .then((data) => setPosts(data))
        .catch((err) => console.error(err));
    }
  }, [user]);

  // Complex derived state
  const isComplete = profile && posts.length > 0 && !isLoading;
  const displayName = profile?.name || user?.email || "Anonymous";

  return { profile, posts, isLoading, error, isComplete, displayName };
}
```

### After: Pure Functional Derivation

```typescript
// ✅ NEW: Race-free functional approach

// Step 1: Create orthogonal data hooks
function useProfileData(userId: string | null) {
  const data = useQuery(userId ? api.users.getProfile : "skip", userId ? { userId } : "skip");

  return useMemo(
    () => ({
      profile: data || null,
      isLoading: data === undefined,
      error: null,
    }),
    [data],
  );
}

function usePostsData(userId: string | null) {
  const data = useQuery(userId ? api.posts.getUserPosts : "skip", userId ? { userId } : "skip");

  return useMemo(
    () => ({
      posts: data || [],
      isLoading: data === undefined,
    }),
    [data],
  );
}

// Step 2: Define state types
type ProfileState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | {
      status: "ready";
      profile: UserProfile;
      posts: Post[];
      displayName: string;
      isComplete: boolean;
    };

// Step 3: Pure derivation function
function deriveProfileState(sources: {
  auth: { userId: string | null; email: string | null };
  profile: {
    profile: UserProfile | null;
    isLoading: boolean;
    error: Error | null;
  };
  posts: { posts: Post[]; isLoading: boolean };
}): ProfileState {
  // Loading priority
  if (sources.profile.isLoading) {
    return { status: "loading" };
  }

  if (sources.profile.error) {
    return { status: "error", error: sources.profile.error.message };
  }

  if (!sources.profile.profile) {
    return { status: "error", error: "Profile not found" };
  }

  // Wait for posts if still loading
  if (sources.posts.isLoading) {
    return { status: "loading" };
  }

  // All data ready - derive state
  return {
    status: "ready",
    profile: sources.profile.profile,
    posts: sources.posts.posts,
    displayName: sources.profile.profile.name || sources.auth.email || "Anonymous",
    isComplete: sources.posts.posts.length > 0,
  };
}

// Step 4: Composition hook
export function useUserProfile() {
  const auth = useAuth();
  const profile = useProfileData(auth.userId);
  const posts = usePostsData(auth.userId);

  return useMemo(() => deriveProfileState({ auth, profile, posts }), [auth, profile, posts]);
}
```

## Step-by-Step Migration Checklist

### Phase 1: Analysis (30 min)

- [ ] Identify all state variables in your component/hook
- [ ] Map out data dependencies (what depends on what)
- [ ] List all `useEffect` hooks that update state
- [ ] Document race conditions or state sync issues
- [ ] Identify external data sources (APIs, context, props)

### Phase 2: Design (45 min)

- [ ] Define orthogonal data sources (each with single responsibility)
- [ ] Create discriminated union for all possible states
- [ ] Design pure derivation function signature
- [ ] Plan loading state priorities
- [ ] Identify what can be derived vs what must be stored

### Phase 3: Implementation (2-3 hours)

#### Step 1: Create Data Hooks

```typescript
// For each data source, create a hook with stable interface
export function useDataSourceA(): DataSourceAReturn {
  const rawData = useQuery(/* ... */);

  return useMemo(
    () => ({
      data: normalize(rawData),
      isLoading: rawData === undefined,
      error: null,
    }),
    [rawData],
  );
}
```

#### Step 2: Define State Types

```typescript
// Use discriminated unions for clear state modeling
type ComponentState =
  | { status: "loading-critical-data" }
  | { status: "loading-secondary-data" }
  | { status: "error"; message: string }
  | { status: "ready" /* all data */ };
```

#### Step 3: Write Derivation Function

```typescript
// Pure function: same inputs = same output
export function deriveState(sources: DataSources): ComponentState {
  // Handle loading states in priority order
  if (sources.critical.isLoading) {
    return { status: "loading-critical-data" };
  }

  // Check for errors
  if (sources.critical.error) {
    return { status: "error", message: sources.critical.error };
  }

  // Derive ready state
  return {
    status: "ready",
    // ... derive all values
  };
}
```

#### Step 4: Create Composition Hook

```typescript
export function useComponent() {
  // Compose all data sources
  const sourceA = useDataSourceA();
  const sourceB = useDataSourceB();

  // Derive state
  const state = useMemo(() => deriveState({ sourceA, sourceB }), [sourceA, sourceB]);

  // Add actions if needed
  const actions = useActions({ sourceA, sourceB });

  return { ...state, ...actions };
}
```

### Phase 4: Testing (1-2 hours)

- [ ] Write unit tests for derivation function
- [ ] Test all loading state combinations
- [ ] Test error scenarios
- [ ] Test state transitions
- [ ] Verify no race conditions

### Phase 5: Integration (30 min)

- [ ] Replace old hook with new one
- [ ] Update component to handle new state shape
- [ ] Add error boundaries if needed
- [ ] Verify all functionality works
- [ ] Check performance (should be same or better)

### Phase 6: Cleanup (15 min)

- [ ] Remove old state management code
- [ ] Delete unnecessary useEffect hooks
- [ ] Update documentation
- [ ] Add migration notes to CHANGELOG

## Benefits of This Pattern

### ✅ Race Condition Immunity

- State is deterministic regardless of load order
- No temporal coupling between effects
- Predictable state at every render

### ✅ Superior Testability

```typescript
// Pure functions are trivial to test
test("shows loading when data is loading", () => {
  const state = deriveState({
    dataA: { isLoading: true, data: null },
    dataB: { isLoading: false, data: mockData },
  });
  expect(state.status).toBe("loading");
});
```

### ✅ Debugging Paradise

- State at any point = f(inputs)
- Can reproduce any state from data
- Clear loading/error states
- Time-travel debugging possible

### ✅ Performance

- Derivation typically <1ms
- Perfect memoization prevents re-renders
- No cascading effects
- Reduced component complexity

## Tradeoffs to Consider

### ⚠️ Learning Curve

- Requires functional programming mindset
- Initial setup more verbose
- Different mental model from imperative

### ⚠️ Not Always Applicable

- Works best for derived state
- Local UI state (modals, tooltips) might not benefit
- Form state might need imperative updates

### ⚠️ Memory Considerations

- All data sources kept in memory
- Might need cleanup for large datasets
- Consider pagination/virtualization

## Common Pitfalls and Solutions

### Pitfall 1: Incomplete Loading States

```typescript
// ❌ Forgetting to handle all loading combinations
if (dataA.isLoading || dataB.isLoading) {
  return { status: "loading" }; // Too generic!
}

// ✅ Be specific about what's loading
if (dataA.isLoading) return { status: "loading-user" };
if (dataB.isLoading) return { status: "loading-profile" };
```

### Pitfall 2: Mutation in Derivation

```typescript
// ❌ NEVER mutate in derivation function
function deriveState(sources) {
  sources.data.items.sort(); // Mutation!
  return { items: sources.data.items };
}

// ✅ Always create new values
function deriveState(sources) {
  return {
    items: [...sources.data.items].sort(),
  };
}
```

### Pitfall 3: Missing Memoization

```typescript
// ❌ Creating new objects every render
export function useData() {
  return {
    data: processData(rawData), // New object every time!
    isLoading: false,
  };
}

// ✅ Memoize return values
export function useData() {
  return useMemo(
    () => ({
      data: processData(rawData),
      isLoading: false,
    }),
    [rawData],
  );
}
```

### Pitfall 4: Over-deriving

```typescript
// ❌ Deriving things that should be actions
const state = deriveState({
  ...sources,
  currentTime: Date.now(), // Changes every render!
});

// ✅ Keep time-based values in effects or actions
const [currentTime, setCurrentTime] = useState(Date.now());
useEffect(() => {
  const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
  return () => clearInterval(timer);
}, []);
```

## Advanced Patterns

### Pattern 1: Optimistic Updates

```typescript
function useOptimisticData() {
  const serverData = useServerData();
  const [optimisticUpdates, setOptimisticUpdates] = useState([]);

  // Merge server data with optimistic updates
  const data = useMemo(
    () => mergeOptimistic(serverData, optimisticUpdates),
    [serverData, optimisticUpdates],
  );

  const update = useCallback(async (newData) => {
    // Optimistic update
    setOptimisticUpdates((prev) => [...prev, newData]);

    // Server update
    try {
      await updateServer(newData);
    } catch (error) {
      // Rollback on error
      setOptimisticUpdates((prev) => prev.filter((u) => u.id !== newData.id));
    }
  }, []);

  return { data, update };
}
```

### Pattern 2: Lazy Data Sources

```typescript
function useLazyDataSource(shouldLoad: boolean) {
  const data = useQuery(shouldLoad ? api.endpoint : "skip", shouldLoad ? params : "skip");

  return useMemo(
    () => ({
      data: data || null,
      isLoading: shouldLoad && data === undefined,
      isSkipped: !shouldLoad,
    }),
    [data, shouldLoad],
  );
}
```

### Pattern 3: Derived Actions

```typescript
function useActions(state: DerivedState) {
  // Actions can be derived from state too!
  return useMemo(() => {
    if (state.status !== "ready") {
      return {
        canSubmit: false,
        canReset: false,
        submit: () => {},
        reset: () => {},
      };
    }

    return {
      canSubmit: state.hasChanges && state.isValid,
      canReset: state.hasChanges,
      submit: () => submitChanges(state),
      reset: () => resetChanges(),
    };
  }, [state]);
}
```

## When NOT to Use This Pattern

### ❌ Local UI State

```typescript
// Modals, tooltips, hover states - keep them simple
const [isOpen, setIsOpen] = useState(false);
```

### ❌ Form Input State

```typescript
// Forms often need imperative updates
const [value, setValue] = useState("");
const handleChange = (e) => setValue(e.target.value);
```

### ❌ Animation State

```typescript
// Animation libraries handle their own state
const { x, y } = useSpring({ from: { x: 0, y: 0 } });
```

### ❌ Simple Single-Source State

```typescript
// If there's no derivation needed, keep it simple
const data = useQuery(api.simple.get);
```

## Migration Success Stories

### Example 1: Dashboard Widget

- **Before**: 5 useEffect hooks, 3 race conditions, 200 lines
- **After**: 3 data hooks, 1 derivation, 120 lines
- **Result**: 40% less code, 0 race conditions, 100% test coverage

### Example 2: Search Results

- **Before**: Complex state sync between search, filters, and results
- **After**: Pure derivation from search + filter + data sources
- **Result**: Instant filter updates, predictable results

### Example 3: User Settings

- **Before**: Settings, preferences, and permissions out of sync
- **After**: Single derived state from all permission sources
- **Result**: Consistent permissions, easier permission debugging

## Resources

- [Pure Functional State Management](/docs/architecture/state-management.md)
- [React Hook Patterns](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [Discriminated Unions in TypeScript](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)

## Summary

The pure functional state derivation pattern transforms complex, error-prone state management into predictable, testable, and maintainable code. While it requires a mental shift from imperative to functional thinking, the benefits in terms of reliability, debuggability, and developer experience make it worthwhile for any component dealing with multiple data sources.

**Remember**: Not every component needs this pattern. Use it when you have complex state derivation from multiple sources. For simple local state, stick with useState.

---

_"Stop managing state. Derive it. State synchronization is where bugs hide."_
