# TDD & Simple Design Review: Chrondle Test Coverage Initiative

**Date:** December 3, 2025
**Current Coverage:** 28.7% lines, 55.8% functions, 74.7% branches
**Target:** 70% all metrics
**Framework:** Vitest + React Testing Library, 89 test files, 1,081 tests

---

## EXECUTIVE SUMMARY

The TASK.md proposes adding 11,500 lines of test code across 5 phases to reach 70% coverage. While well-intentioned (risk-weighted approach), the plan violates several TDD principles:

1. **Test Pyramid Inverted** - Proposes massive E2E/integration expansion (Phase 4) after unit phases, when critical core logic is still untested
2. **Behavior vs Implementation** - Many proposed tests check implementation details (Convex mocking, localStorage sync) rather than user-facing behaviors
3. **Over-Engineering for Clarity** - Suggests complex test factories + patterns when simpler behavior-focused tests would suffice
4. **Missing Simple Path** - Doesn't identify the minimum viable set to hit 70% with maximum confidence

**Kent's Principle**: "Make it work, make it right, make it fast. In that order."
Current focus (complex infrastructure) violates this—should focus on simple, behavior-driven tests first.

---

## PART 1: TEST PYRAMID ASSESSMENT

### Current State (Well-Balanced!)

```
✓ Unit tests:       57 files, most heavily weighted
✓ Integration:      6 files (Convex mocking, hooks + queries)
✗ E2E:              0 files, Playwright not implemented
✓ Simple patterns:  Factories exist, consistent naming

Coverage: 1,081 tests in 89 files
Test suite: 12.77s total (good speed)
```

### Proposed Additions (Red Flags)

- **Phase 1-3:** ~8,000 lines of unit + integration tests ← Unit-heavy ✓
- **Phase 4:** ~3,500 lines of E2E tests (Playwright) ← Added LAST ✗ (pyramid inversion)
- **Priority:** Risk-weighted (critical modules first) ← Good intent ✓

### Beck's Take

**✓ Good**: Unit-first phases (1-3) establish solid foundation
**✗ Bad**: E2E tests (Phase 4) at the end, not integrated with unit/integration validation
**✗ Bad**: "5 phases" feels waterfall; should be integrated: unit → integration → e2e in tandem per feature

---

## PART 2: BEHAVIOR vs IMPLEMENTATION

### Red Flags in Proposed Test Scenarios

#### Example 1: puzzleData.ts Tests (IMPLEMENTATION-FOCUSED)

```typescript
// TASK.md suggests:
// - "should select events deterministically by date hash"
// - "should handle dates with no events gracefully"
// - "should respect event category filters"
```

**Problem**: These test HOW puzzleData.ts works, not the USER-FACING BEHAVIOR.

- User doesn't see "deterministic hash selection"
- User cares: "Same date gives same puzzle" (BEHAVIOR)
- User cares: "I can play yesterday's puzzle" (BEHAVIOR)

**Better approach** (behavior-first):

```typescript
describe("Puzzle Availability", () => {
  it("should return the same puzzle for the same date (deterministic)", async () => {
    const date = new Date("2025-12-03");
    const puzzle1 = await getPuzzleByDate(date);
    const puzzle2 = await getPuzzleByDate(date);
    expect(puzzle1.targetYear).toBe(puzzle2.targetYear);
  });

  it("should return a playable puzzle with at least 3 hints", async () => {
    const puzzle = await getPuzzleByDate(new Date());
    expect(puzzle.events.length).toBeGreaterThanOrEqual(3);
  });

  it("should allow replaying puzzles from archive", async () => {
    const archiveDate = new Date("2025-11-01");
    const puzzle = await getPuzzleByDate(archiveDate);
    expect(puzzle).not.toBeNull();
  });
});
```

#### Example 2: useAuthState.ts Tests (MOCKING INTERNALS)

```typescript
// TASK.md suggests:
// - "should start in loading state"
// - "should transition to anonymous when no session"
// - "should trigger migration on sign-in"
```

**Problem**: These are implementation states, not behaviors.

- Test checks internal state machine
- Should test: "User sees login prompt" → "User sees play button after sign-in"

**Better approach**:

```typescript
describe('Authentication User Journey', () => {
  it('should show sign-in button before authentication', () => {
    render(<GameContainer />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  it('should persist progress after signing in', async () => {
    render(<GameContainer />);
    // Play as anonymous
    await userEvent.click(screen.getByRole('button', { name: /submit guess/i }));
    const anonAttempts = screen.getByText(/attempts: 1/);

    // Sign in
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    signInAsTestUser();

    // Progress persists
    expect(screen.getByText(/attempts: 1/)).toBeInTheDocument();
  });
});
```

---

## PART 3: TEST SCENARIOS - MISSING THE RIGHT FAILURES

### Gaps in Proposed Coverage

#### What's Missing: Core Game Loop Behaviors

The TASK.md focuses on isolated functions, **NOT** the critical game flow:

1. **Range Validation Logic** (0% coverage proposed)

   - Can I submit an invalid range? (Should fail)
   - Can I submit a range > 250 years? (Should fail)
   - What happens if I submit overlapping ranges? (Should consolidate or reject)

2. **Game Completion Flow** (0% coverage proposed)

   - When does the game end? (All hints used? Correct year guessed? Max attempts?)
   - Does score calculate correctly for width + hints used?
   - Can I still see hints after game ends?

3. **Streak Persistence** (Has some coverage, but integration gaps)

   - Anonymous → Authenticated migration: Does streak carry over?
   - Multi-device sync: Does streak update appear on other devices?
   - Offline play: Does streak update when going online?

4. **Puzzle Determinism** (CRITICAL, 0% coverage)
   - Same puzzle for same date globally? (Use hash, verify)
   - Puzzle never changes mid-session? (Cache, verify)
   - Archive puzzle replays return same events? (Verify)

#### What's Over-Specified: Implementation Details

- "Test localStorage sync logic" ← Care about persistence, not HOW
- "Mock canvas-confetti for victory confetti" ← Don't test the library, test the TRIGGER
- "Test Convex function integration" ← Real E2E tests would catch schema drift anyway

---

## PART 4: OVER-ENGINEERING CONCERNS

### 1. Mocking Strategy (Proposed)

**TASK.md suggests**: "Mock Clerk integration", "Mock Convex queries", "Mock canvas-confetti"

**Problem**: Heavy mocking → brittle tests that pass with wrong behavior

- Test mocks Convex mutation → Test passes
- Real Convex call fails silently → Production breaks
- Nobody catches it until user reports (See BACKLOG: "broken access control in submitGuess")

**Beck's Principle**: Tests should verify BEHAVIOR with real dependencies, mock only external systems.

**Better approach**:

```typescript
// Integration test: Real Convex, mocked HTTP
describe("Player Progress Persistence", () => {
  it("should persist score after authenticated submission", async () => {
    const testUser = await createTestUser();
    const convexClient = initializeConvexForTest(testUser);

    // Real Convex mutation, not mocked
    const result = await convexClient.mutation(api.puzzles.submitRange, {
      year: 1969,
      minYear: 1960,
      maxYear: 1980,
      hintsUsed: 2,
    });

    // Verify real behavior: score is saved
    const savedPlay = await convexClient.query(api.plays.getLastPlay);
    expect(savedPlay.score).toBeGreaterThan(0);
  });
});
```

### 2. Phase Approach (Waterfall-like)

**TASK.md suggests**: Phase 1→2→3→4→5 sequentially, adding 11,500 lines total

**Problem**:

- 11,500 lines is unmergeable, untestable (meta!)
- Can't validate benefit until Phase 5 completes
- Loses momentum if stuck on Phase 2

**Beck's Principle**: Small steps, continuous feedback

**Better approach**:

- Phase 1a (2 hours): Add tests for 3 critical modules only
- Measure: Can we hit 45% with 2,000 lines?
- Phase 1b (2 hours): Expand to 5 modules
- Measure: Did we hit 50%? Is 70% achievable without E2E?

### 3. Test Factory Complexity

**TASK.md suggests**: "Create shared test factories for common patterns"

**Problem**: Factories add indirection. Tests become:

```typescript
const sources = createDataSources(overrides); // What's in here?
const state = deriveGameState(sources); // Why did it fail?
```

**Better approach** (when needed): Inline factories only for repeated 3+ times

```typescript
describe("deriveGameState", () => {
  it("should return loading-puzzle when puzzle is loading", () => {
    const state = deriveGameState({
      puzzle: { puzzle: null, isLoading: true, error: null },
      auth: { userId: "user-123", isAuthenticated: true, isLoading: false },
      progress: { progress: null, isLoading: false },
      session: { sessionGuesses: [], sessionRanges: [] /* ... */ },
    });
    expect(state).toEqual({ status: "loading-puzzle" });
  });
});
```

This is CLEARER than calling a factory.

---

## PART 5: THE SIMPLEST PATH TO 70%

### Analysis: Where's the Gap?

Current coverage: **28.7% lines**
Target: **70% lines**
Gap: **~11,500 lines to cover**

But: **1,081 tests already passing**. What's NOT tested?

```
High-value targets (cover most lines with fewest tests):
1. convex/actions/historicalContext.ts (0% lines, ~300 lines) - AI integration
2. convex/actions/eventGeneration/* (82% coverage, fill gaps ~100 lines)
3. src/lib/gameState.ts (Storage functions, 0% lines but mostly deprecated)
4. convex/puzzles.ts (0% lines, ~378 lines) - mutation/query handlers
5. convex/events.ts (0% lines, ~378 lines) - event schema/queries

Low-value targets (high effort, low impact):
- Utility functions (formatting, era utils) → Already 70%+ tested
- UI components → Already heavily tested
- Animation/debug utilities → Skip these
```

### Minimal Path (Red-Green-Refactor)

**RED**: Run coverage report, identify 5 modules covering 80% of gaps

```bash
pnpm test -- --coverage
# Find: Which 5 files give us to 50%?
# Answer: historicalContext + eventGeneration + puzzles + decoratedLogger + schema
```

**GREEN**: Write simplest tests to exercise code paths

```typescript
// NOT: Test the implementation details
// DO: Test the public interface with real-world data

describe("historicalContext", () => {
  it("should generate context for a historical year", async () => {
    const context = await generateHistoricalContext(1969);
    expect(context).toHaveProperty("summary");
    expect(context.summary.length).toBeGreaterThan(0);
  });

  it("should handle BC/AD years correctly", async () => {
    const bcContext = await generateHistoricalContext(-100);
    const adContext = await generateHistoricalContext(100);
    expect(bcContext.era).toBe("BC");
    expect(adContext.era).toBe("AD");
  });
});
```

**REFACTOR**: Look for duplication in tests

- 3+ similar test blocks? Extract helper
- 3+ similar test data? Extract fixture

### Step 1: Core Game Logic (4 hours → 45% coverage)

```
gameState.ts: Current state derivation
- ✓ Covered by deriveGameState.unit.test.ts (already 100% for non-deprecated code)
- ✗ Add: Complex range validation edge cases
- ✗ Add: Score calculation with different hint counts

puzzleData.ts: Puzzle fetching
- ✓ Covered by usePuzzleData.integration.test.tsx
- ✗ Add: Convex client initialization errors
- ✗ Add: Cache behavior across calls

scoring.ts: Range score calculation
- ✓ Partially covered (scoring.unit.test.ts exists)
- ✗ Verify: Score is never 0 if containment=true
- ✗ Verify: Score floor (5% minimum) applies

Result: ~1,500 lines of tests → 45% coverage achieved
```

### Step 2: User-Facing Hooks (4 hours → 55% coverage)

```
useRangeGame.ts: Game submission hook
- ✗ Add: Submission flow end-to-end (from guess to score display)
- ✗ Add: Error handling (network, Convex failures)

useStreak.ts: Streak tracking
- ✓ Heavily tested already (~70% coverage)
- ✗ Add: Multi-device sync edge cases

analytics.ts: Event tracking
- ✗ Add: User identification
- ✗ Add: Event payload validation

Result: ~2,500 lines of tests → 55% coverage achieved
```

### Step 3: Backend Convex (4 hours → 65% coverage)

```
convex/puzzles.ts: Puzzle mutations/queries
- ✗ Add: submitRange validation (payload shape, user auth)
- ✗ Add: getDailyPuzzle caching behavior
- Add ~50 tests to cover all paths

convex/schema.ts: Data model validation
- ✓ Schema is mostly self-documenting
- ✗ Add: Range validation constraints

Result: ~3,000 lines of tests → 65% coverage achieved
```

### Step 4: Polish (2 hours → 70% coverage)

```
- Review coverage report
- Add 10-15 targeted tests for remaining gaps
- Skip intentionally: debug utilities, config files

Result: Final push → 70% achieved
Total effort: 14 hours (2 days focused work)
Total test lines added: ~3,500 (not 11,500!)
```

---

## PART 6: SPECIFIC RECOMMENDATIONS

### REMOVE from Plan

1. **E2E Tests in Phase 4** ← E2E comes AFTER unit/integration are solid, not as separate phase

   - Move from "Phase 4" to "continuous integration with Phase 1-3"
   - Write 1-2 critical journeys (authenticate + play + win), not 5

2. **Canvas-confetti mocking** ← Don't test third-party libraries

   - Test: "Does victory trigger animation?"
   - Don't test: "Does canvas-confetti animate correctly?"

3. **localStorage sync edge cases** ← Deprecated anyway

   - Skip: localStorage tests (Convex is source of truth now)
   - Add: Offline → online sync tests (real Convex behavior)

4. **Auth state machine testing** ← Test behavior, not states
   - Don't test: "Loading → Anonymous → Authenticated transitions"
   - Do test: "Sign-in button disappears after user authenticates"

### ADD to Plan

1. **Convex Contract Tests** (High value, low effort)

   - Verify payload schema on submission (prevents BACKLOG issue: broken access control)
   - Test: `submitRange` validates user auth from context, not args
   - Test: Score calculation matches both client + server

2. **Game Loop Behavioral Tests**

   - Win condition: What happens when correct year guessed?
   - Lose condition: What happens at 6 hints used?
   - Mid-game restart: Does new puzzle load correctly?

3. **Critical Integration Paths**

   - Anonymous → Authenticated (streak carries over)
   - Offline → Online (pending submissions sync)
   - Archive puzzle replay (same events, fresh attempt)

4. **One E2E Happy Path** (30 mins)
   - Start → Submit range → Reveal hint → Win → Share
   - Run on CI, validate real behavior

### REDUCE Estimate

**Current Plan**: 11,500 lines, 5 phases, weeks of work
**Proposed Plan**: 3,500 lines, 3 phases + 1 integration, 2 days focused work

**Rationale**:

- Skip implementation-detail tests (half the size)
- Use existing test infrastructure (no Playwright setup needed yet)
- Focus on behavior, not coverage % (stops gaming metrics)
- Prioritize high-risk modules (Convex auth, game logic)

---

## PART 7: RED FLAGS IN CURRENT CODEBASE

### From BACKLOG.md (Security/Quality Issues Untested)

1. **CRITICAL**: submitGuess/submitRange broken access control

   - Client passes `userId` → Server doesn't verify auth context
   - No test catches this
   - FIX: Add integration test that verifies `userId` must match authenticated user

2. **HIGH**: createUserFromWebhook mutation is public

   - Should be `internalMutation` only
   - No test prevents regression
   - FIX: Add test that calls mutation from client, expects 403

3. **MEDIUM**: Order submission payload drift
   - Client can add fields that Convex doesn't expect
   - Tests mock Convex, miss this
   - FIX: Export shared type, use `satisfies` in hook, test against real Convex schema

### Tests Must Catch These BEFORE 70% Coverage Counts

These bugs live in untested code. Adding 11,500 lines of OTHER test code won't help if we skip Convex mutations.

---

## SUMMARY: BECK'S PRESCRIPTION

### What to Do

1. **Delete Phase 4 from TASK.md** - E2E comes later, not as separate 3,500-line phase
2. **Rewrite test scenarios** - Focus on user behaviors, not implementation states
3. **Add Convex contract tests** - Catch auth/validation bugs before shipping
4. **Set 3,500-line target** - Not 11,500; we're testing behavior, not metrics
5. **Phase in E2E** - 1-2 Playwright tests alongside unit/integration in same sprint

### How to Validate

```bash
# Step 1: Baseline
pnpm test -- --coverage
# → 28.7% lines, 55.8% functions, 74.7% branches

# Step 2: Add 500 lines of Convex contract tests
# → Catch the BACKLOG auth bugs
# → Run: pnpm test -- convex

# Step 3: Add 1,500 lines of game logic tests
# → Focus: Range validation, score calculation, win/lose
# → Run: pnpm test -- src/lib

# Step 4: Add 1,000 lines of hook behavior tests
# → Focus: Submission flow, streak persistence, error handling
# → Run: pnpm test -- src/hooks

# Step 5: Review coverage
pnpm test -- --coverage
# → Target 65-70% achieved
# → All BACKLOG auth issues now tested

# Step 6: Add 1-2 Playwright tests
pnpm test:e2e
# → Validates end-to-end flow
```

### Success Looks Like

- [ ] Coverage ≥70% (all metrics)
- [ ] Tests read like user stories, not implementation specs
- [ ] BACKLOG security issues now have regression tests
- [ ] No test mocks critical Convex calls (real schema validation)
- [ ] E2E tests exist but are lightweight (2-3 journeys, not 6)
- [ ] <4,000 lines of test code added (not 11,500)

---

## FINAL THOUGHT (Kent Beck)

> "The most important feature of a test is that it fails when the code is wrong."

If your tests pass but a CRITICAL bug exists (like client passing userId), you're testing the wrong things. The TASK.md proposes testing implementations; **test behaviors instead**. You'll write fewer tests, catch more bugs, and hit 70% faster.
