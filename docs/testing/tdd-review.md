# TDD & Simple Design Review: Chrondle Test Coverage Initiative

**Review Date**: December 3, 2025
**Reviewer Perspective**: Kent Beck (Extreme Programming, TDD)
**Current Coverage**: 28.7% lines | Target: 70%
**Recommendation**: Replace TASK.md with COVERAGE_ROADMAP.md

---

## Document Index

### START HERE

**README_REVIEW.md** (8 KB, 216 lines)
Quick orientation. Read this first. Explains what each document covers and how to use them.

---

### DECISION MAKERS (15 min read)

1. **COMPARISON.txt** (8 KB, 180 lines)
   ASCII tables comparing TASK.md vs proposed COVERAGE_ROADMAP.md
   - Side-by-side metrics (test lines, timeline, approach)
   - Coverage trajectory comparison
   - Bug catching analysis (BACKLOG security issues)
   - Visual test pyramid shapes
2. **ANALYSIS_SUMMARY.md** (8 KB, 211 lines)
   Executive matrices and decision tables
   - Behavior vs Implementation Matrix
   - Sprint breakdown with file paths
   - Keep/Reject decision matrix
   - 3-day validation plan

**Decision**: After these two, you'll know whether to use TASK.md or COVERAGE_ROADMAP.md

---

### ACTIONABLE PLAN (If adopting new approach)

**COVERAGE_ROADMAP.md** (8 KB, 162 lines)
Drop-in replacement for TASK.md's 5 phases

**Contains**:

- 3 Focused Sprints (12 hours total instead of weeks)
- Specific files to create/modify with paths
- What to DELETE from TASK.md (5 things)
- Test Writing Checklist
- Success Criteria
- Daily validation steps

**Use this to**: Start writing tests tomorrow. Contains concrete file paths.

---

### DEEP ANALYSIS (If you want the "why")

**TEST_DESIGN_REVIEW.md** (20 KB, 498 lines)
Comprehensive critique structured in 7 parts

**Part 1**: Test Pyramid Assessment

- Current state (well-balanced)
- TASK.md proposals (inverted pyramid problem)
- Beck's take

**Part 2**: Behavior vs Implementation (with code examples)

- puzzleData.ts example (implementation vs behavior focus)
- useAuthState.ts example (state machines vs user journeys)
- Better approaches with actual code

**Part 3**: Test Scenarios - Missing the Right Failures

- Range validation (0% coverage proposed, critical)
- Game completion flow (missing)
- Streak persistence (gaps)
- Puzzle determinism (critical)

**Part 4**: Over-Engineering Concerns

1. Mocking strategy (brittle tests)
2. Phase approach (waterfall, hard to pivot)
3. Test factory complexity (unnecessary indirection)

**Part 5**: The Simplest Path to 70%

- Gap analysis (which 5 files = 80% of gaps)
- Red-Green-Refactor approach
- Step 1-4 breakdown by hours → coverage %

**Part 6**: Specific Recommendations

- REMOVE from plan (5 items)
- ADD to plan (4 items)
- REDUCE estimate (11,500 → 3,500 lines)

**Part 7**: Red Flags in Current Codebase

- CRITICAL auth bug not tested
- HIGH: Public mutation vulnerability
- MEDIUM: Schema drift risk

---

## How to Use This Review

### Scenario A: Quick Decision (15 minutes)

1. Read README_REVIEW.md (5 min)
2. Read COMPARISON.txt (8 min)
3. Decide: Keep TASK.md or use COVERAGE_ROADMAP.md? ← Decision point

### Scenario B: Need to Convince Team (30 minutes)

1. Read README_REVIEW.md (5 min)
2. Read COMPARISON.txt (8 min)
3. Read ANALYSIS_SUMMARY.md (10 min)
4. Show team: "TASK.md is 65% good, 35% over-engineered" matrix

### Scenario C: Implementing New Plan (60 minutes)

1. Read README_REVIEW.md (5 min)
2. Read COVERAGE_ROADMAP.md (10 min)
3. Read TEST_DESIGN_REVIEW.md Part 2 (20 min) ← For examples
4. Read COVERAGE_ROADMAP.md again with code editor open (25 min)
5. Start Sprint 1

### Scenario D: Deep Learning (2+ hours)

Read all documents in order:

1. README_REVIEW.md (orientation)
2. COMPARISON.txt (overview)
3. ANALYSIS_SUMMARY.md (details)
4. TEST_DESIGN_REVIEW.md (comprehensive)
5. COVERAGE_ROADMAP.md (implementation)

---

## Key Findings Summary

### Problem

TASK.md proposes 11,500 test lines over 5 waterfall phases, emphasizing infrastructure and implementation details.

### Issues Identified

1. **Test Pyramid Inverted**: E2E tests (Phase 4) added last, can't guide earlier phases
2. **Behavior vs Implementation**: Tests focus on "how code works" not "what user experiences"
3. **Over-Engineering**: 3,500 lines would suffice; 11,500 is wasteful
4. **Heavy Mocking**: Tests pass, production fails silently
5. **Misses Security Bugs**: CRITICAL access control issue in BACKLOG not addressed

### Solution Offered

**COVERAGE_ROADMAP.md**: 3 sprints, 12 hours, 3,500 test lines, behavior-first

**Sprint 1** (4h) → 45% coverage + catches CRITICAL bugs
**Sprint 2** (4h) → 55% coverage + validates game flow  
**Sprint 3** (4h) → 70% coverage + backend + polish

### What Changes

**DELETE**: 11,500 test lines worth of over-specification
**ADD**: 500 Convex contract tests (catch auth bugs)
**FOCUS**: Behavior testing instead of implementation testing

---

## Files Referenced in Analysis

### Chrondle Codebase

```
TASK.md                      ← Original plan (criticisms apply here)
BACKLOG.md                   ← Contains critical security bugs
vitest.config.ts             ← Current thresholds: 28% lines
convex/puzzles.ts            ← 0% coverage, has broken auth
src/lib/scoring.ts           ← Partial coverage
src/lib/gameState.ts         ← Deprecated storage code
```

### Test Infrastructure

```
89 test files (57 unit, 6 integration, 0 E2E)
1,081 tests passing
12.77s suite runtime
```

---

## Critical Issues to Catch

From BACKLOG.md. These MUST have regression tests before 70% coverage counts:

1. **CRITICAL: submitGuess/submitRange access control**

   - Client passes userId → Server doesn't verify auth
   - Allows user to manipulate other users' game state
   - Fix: Test that userId must match authenticated user
   - File: convex/**tests**/puzzles.contract.test.ts (Sprint 1)

2. **HIGH: createUserFromWebhook mutation is public**

   - Should be internalMutation only
   - Allows account takeover via pre-registration
   - Fix: Test that client call returns 403
   - File: Same as above (Sprint 1)

3. **MEDIUM: Order submission payload drift**
   - Client can add fields not in Convex schema
   - Tests mock Convex, miss this
   - Fix: Real Convex in tests, export shared types
   - File: src/hooks/**tests**/useOrderGame.behavior.test.tsx (Sprint 2)

---

## Metrics & Estimates

### TASK.md Approach

```
Test Lines Added:    11,500
Phases:              5 (sequential)
Timeline:            4-5 weeks
Lines per test:      ~10.6 lines/test
Risk:                High (waterfall, can't pivot)
Bug Catch Rate:      Low (mocking hides issues)
```

### COVERAGE_ROADMAP.md Approach

```
Test Lines Added:    3,500
Sprints:             3 (agile)
Timeline:            2 weeks (12 hours focused work)
Lines per test:      ~3.2 lines/test
Risk:                Low (feedback after each sprint)
Bug Catch Rate:      High (real Convex, contract tests)
```

---

## Questions This Review Answers

**Q: Is 11,500 test lines necessary?**
A: No. 3,500 lines of behavior-focused tests with real Convex integration would achieve higher confidence.

**Q: What's wrong with heavy mocking?**
A: Tests pass with mocked Convex. Real Convex fails silently. Discovered in production, not CI.

**Q: Why is E2E in Phase 4 bad?**
A: Can't validate unit/integration are correct until Phase 4 completes. Waterfall structure.

**Q: Should we test canvas-confetti?**
A: No. Test that victory triggers animation. Don't test the library itself.

**Q: Why focus on "behavior" over "implementation"?**
A: Users care what the app does, not how it works. Behavior tests are more valuable and resilient.

**Q: Will 70% coverage catch critical bugs?**
A: Only if tests focus on behavior + contract (schema validation). Otherwise, no.

---

## Recommendation

**USE COVERAGE_ROADMAP.md as primary guide.**

It provides:

- Clearer focus (behavior, not coverage %)
- Faster timeline (12 hours vs weeks)
- Better risk management (3 sprints with feedback)
- Higher bug catch rate (real Convex, auth tests)
- Fewer test lines (3,500 vs 11,500)

**IF keeping TASK.md**, at minimum:

- Add Convex contract tests (Part 6 of TEST_DESIGN_REVIEW.md)
- Convert implementation tests to behavior tests (Part 2 examples)
- Move E2E to Phase 3 (not Phase 4)
- Reduce estimate to 5,000 lines (not 11,500)

---

## Next Steps

**Today**:

- Read README_REVIEW.md + COMPARISON.txt (20 min)
- Decide: TASK.md or COVERAGE_ROADMAP.md?

**Tomorrow** (if adopting new plan):

- Create convex/**tests**/puzzles.contract.test.ts (Sprint 1)
- Create src/lib/**tests**/scoring.behavior.test.ts
- Run tests, measure coverage gain
- Review COVERAGE_ROADMAP.md for Sprint 2 guidance

**This Week**:

- Complete 3 sprints (12 hours focused work)
- Hit 70% coverage
- Catch BACKLOG security bugs
- Document patterns for future contributors

---

## Attribution

This review is conducted from the perspective of **Kent Beck**, creator of Extreme Programming and Test-Driven Development.

**Key Principles Applied**:

- Red-Green-Refactor cycle (small steps)
- Simple design > clever design (fewer, better tests)
- Evolutionary architecture (continuous feedback)
- Courage to delete (unnecessary code/tests)
- Tests as documentation (read like specifications)

**Quote**: "The most important feature of a test is that it fails when the code is wrong."

If your tests pass but critical bugs exist (BACKLOG access control), you're testing the wrong things.

---

**Review Generated**: December 3, 2025
**Status**: Ready for implementation
**Primary Document**: COVERAGE_ROADMAP.md
**Supporting Documents**: TEST_DESIGN_REVIEW.md, ANALYSIS_SUMMARY.md, COMPARISON.txt
