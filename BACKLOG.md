# BACKLOG

Last groomed: 2025-12-13
Analyzed by: 8 specialized perspectives (complexity-archaeologist, architecture-guardian, security-sentinel, performance-pathfinder, maintainability-maven, user-experience-advocate, product-visionary, design-systems-architect)

**Recent Addition (2025-12-13):** Incorporated external consultant security/architecture audit. Added privacy leak, Convex filter bug, boundary coupling, and timezone consistency items. Product/market analysis extracted to `docs/product/STRATEGY.md`.

**Previous (2025-11-25):** Event & Puzzle Generation System Modernization deferred items added. See TODO.md for Phase 1-3 implementation tasks.

---

## Now (Sprint-Ready, <2 weeks)

### [UX BUG] Order mode drag and drop restrictions are not intuitive

- too easy for new players to think it doesn't work
- they try to drag the whole card
- they don't press and hold the handle icon long enough

### [QUALITY] HIGH - Convex Contract Enforcement for Order Submissions

**Files**: `convex/orderPuzzles/mutations.ts`, `src/hooks/useOrderGame.ts`
**Problem**: Client payloads can drift from Convex validators (extra fields like `hintsUsed`) and only fail at runtime.
**Fix**: Export a shared `SubmitOrderPlayArgs`/`ClientScore` type derived from Convex validator and use `satisfies` in the client payload. Add a Vitest integration test that calls `submitOrderPlay` against an in-memory Convex test instance.
**Effort**: 2h | **Benefit**: Prevents runtime ArgumentValidationError + silent submission failures
**Acceptance**: Shared type consumed by hook; integration test fails if payload shape diverges.

### [QUALITY] HIGH - Order E2E Persistence Test (Auth + Refresh)

**Files**: `e2e/order.spec.ts` (new)
**Problem**: No end-to-end coverage to ensure authenticated Order submission persists after reload; UI can succeed locally while server write fails.
**Fix**: Playwright/Cypress test: sign in (stub Clerk), play Order, submit, assert 200 on `submitOrderPlay`, reload, expect completed state. Run in mobile viewport.
**Effort**: 3h | **Benefit**: Catches auth/token/validator regressions in real flow
**Acceptance**: Test passes in CI; fails if server submission is rejected or progress not returned on reload.

### [QUALITY] MEDIUM - Mock Contracts Must Match Convex Schema

**Files**: `src/hooks/__tests__/useOrderGame.auth-submit.test.tsx`
**Problem**: Unit tests mock Convex mutation and don’t validate payload shape; they can pass with extra fields.
**Fix**: Update mocks to assert exact payload using shared `ClientScore` type; add lint rule/custom matcher to forbid spreading unknown keys into Convex payloads in tests.
**Effort**: 1h | **Benefit**: Prevents test false-positives on schema drift
**Acceptance**: Tests fail if payload has extra/missing fields; lint rule in place.

### [DEV UX] MEDIUM - Convex Drift Check in CI

**Files**: `scripts/ci/convex-check.sh` (new), pipeline config
**Problem**: Convex codegen/validators can change without failing CI.
**Fix**: Add CI step: `pnpm convex codegen && git diff --exit-code convex/_generated` plus `pnpm convex lint` to fail on drift.
**Effort**: 45m | **Benefit**: Early detection of schema changes
**Acceptance**: CI fails on uncommitted codegen or lint errors.

### [SECURITY] CRITICAL - Broken Access Control in submitGuess/submitRange

**Files**: `convex/puzzles/mutations.ts:84-177, 179-287`
**Perspectives**: security-sentinel
**Severity**: CRITICAL
**Impact**: Users can manipulate other users' game state by passing arbitrary userId
**Attack Vector**: Attacker authenticates as User A, calls `submitGuess` with User B's userId → manipulates B's streak, scores, game progress
**Code**:

```typescript
export const submitGuess = mutation({
  args: {
    userId: v.id("users"), // Client-controlled!
    // ...
  },
  handler: async (ctx, args) => {
    // NO VERIFICATION that args.userId matches authenticated user
  },
});
```

**Fix**: Derive userId from auth context, not arguments:

```typescript
const identity = await ctx.auth.getUserIdentity();
const user = await ctx.db
  .query("users")
  .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
  .first();
// Use user._id instead of args.userId
```

**Effort**: 1h | **Risk**: CRITICAL - Production auth compromise
**Acceptance**: Manual test confirms users cannot submit guesses for other users

---

### [SECURITY] HIGH - Public createUserFromWebhook Mutation

**File**: `convex/users/mutations.ts:65-95`
**Perspectives**: security-sentinel
**Severity**: HIGH
**Impact**: User pre-registration attack - attacker creates user record with known Clerk ID before legitimate user
**Attack Vector**: Create fake user with target's Clerk ID → When real user signs in, they get attacker-controlled record
**Fix**: Make it `internalMutation` called only from webhook via internal action
**Effort**: 45m | **Risk**: HIGH - Account takeover vector
**Acceptance**: Verify mutation only callable internally, not from client

---

### [SECURITY] MEDIUM - Webhook Empty Secret Handling

**File**: `src/app/api/webhooks/clerk/route.ts:42-48`
**Perspectives**: security-sentinel
**Severity**: MEDIUM
**Impact**: Proceeds with empty string if secret not configured, misleading warning
**Fix**: Return 500 immediately if `CLERK_WEBHOOK_SECRET` not set
**Effort**: 5m | **Risk**: MEDIUM - Misconfiguration in development
**Acceptance**: Webhook returns 500 with clear error when secret missing

---

### [SECURITY] HIGH - Anonymous Streak Manipulation

**File**: `convex/users.ts:556-697`
**Perspectives**: security-sentinel
**Severity**: HIGH
**Impact**: Users can inflate streaks through repeated merge calls (no idempotency check)
**Attack Vector**: Loop calling `mergeAnonymousStreak` with 89-day streaks → Each call increments → 1000+ day streak
**Violation**: Missing rate limiting, no idempotency key, no merge tracking
**Fix**: Add `sessionId` parameter, track `mergedSessions` array, implement rate limiting (2 merges/minute max)
**Effort**: 2h | **Risk**: HIGH - Game integrity compromise
**Acceptance**: Duplicate merge calls are rejected, rate limit enforced

---

### [SECURITY] HIGH - Privacy Leak in Play Read APIs

**Files**: `convex/plays/queries.ts:28-94`, `convex/orderPlays/queries.ts:4-17`
**Perspectives**: security-sentinel
**Severity**: HIGH
**Impact**: Any authenticated user can read any other user's play history by passing arbitrary userId
**Attack Vector**: Call `getUserPlay` or `getOrderPlay` with another user's ID → read their scores, attempts, completion status
**Code**:

```typescript
export const getUserPlay = query({
  args: {
    puzzleId: v.id("puzzles"),
    userId: v.id("users"), // Client-controlled, no auth check!
  },
  handler: async (ctx, { puzzleId, userId }) => {
    // NO VERIFICATION that userId matches authenticated user
  },
});
```

**Fix**: Create `getMyPlay(puzzleId)` variants deriving userId from `ctx.auth.getUserIdentity()`. Pattern exists in Order submission - use as reference.
**Effort**: 1h | **Risk**: HIGH - Privacy violation
**Acceptance**: Cannot fetch another user's play record; tests verify rejection

---

### [DATA INTEGRITY] MEDIUM - Convex Filter Bug (neq matches undefined)

**Files**: `convex/plays/queries.ts:113`, `convex/orderPlays/queries.ts:27`
**Perspectives**: data-integrity-guardian
**Severity**: MEDIUM
**Impact**: Completion stats include in-progress games (undefined treated as not-null)
**Code**:

```typescript
.filter((q) => q.neq(q.field("completedAt"), null))  // BUG: also matches undefined!
```

**Fix**: Explicitly check for defined value: `.filter((q) => q.neq(q.field("completedAt"), undefined))`
**Effort**: 15m | **Risk**: MEDIUM - Incorrect streak/history displays
**Acceptance**: Verified via Convex test that undefined records are excluded

---

### [UX] CRITICAL - Toast System Non-Functional

**Files**: `src/components/ui/toaster.tsx`, `src/hooks/use-toast.ts`
**Perspectives**: user-experience-advocate, architecture-guardian
**Severity**: CRITICAL
**Impact**: Users receive ZERO feedback on any errors - toast system returns null
**Code**:

```typescript
export function Toaster() {
  return null; // Placeholder!
}
```

**User Experience**: Connection issues, submit failures, auth errors all invisible
**Fix**: Implement actual ToastProvider with UI component displaying messages
**Effort**: 2-3h | **Impact**: 10/10 - All error feedback currently invisible
**Acceptance**: Toast notifications appear for errors, show retry options

---

### [UX] CRITICAL - Silent Validation Errors in RangeInput

**File**: `src/components/game/RangeInput.tsx:152-161, 172-181`
**Perspectives**: user-experience-advocate
**Severity**: CRITICAL
**Impact**: Invalid input silently resets to previous value - users think "500 BC" was accepted
**User Experience**: User types year outside range → Input resets → No feedback → Wrong range submitted
**Fix**: Add validation error messages below inputs with red border + icon
**Effort**: 1h | **Impact**: 9/10 - Prevents incorrect submissions
**Acceptance**: Clear error message shows valid range when input rejected

---

### [ARCHITECTURE] HIGH - Dead Code in gameState.ts

**File**: `src/lib/gameState.ts:57-156`
**Perspectives**: complexity-archaeologist, architecture-guardian, maintainability-maven
**Impact**: 100+ lines of non-functional code confuses developers
**Evidence**: `saveProgress()`, `loadProgress()`, `saveSettings()`, `loadSettings()` all log "skipped" and do nothing
**Violation**: Module presents interface complexity without providing implementation value
**Fix**: Delete non-functional functions, keep only type exports and `createInitialGameState()`
**Effort**: 30m | **Impact**: Removes 90+ lines of misleading code
**Acceptance**: File contains only functional code, imports updated

---

### [PERFORMANCE] HIGH - Archive Full Table Scans (Classic + Order)

**Files**: `convex/puzzles/queries.ts:72-96`, `convex/orderPuzzles/queries.ts:67-92`
**Perspectives**: performance-pathfinder
**Impact**: Two full table scans per archive page load → 500ms+ query time, scales linearly with puzzle count
**Code** (both modes use identical anti-pattern):

```typescript
const allPuzzles = await ctx.db.query("puzzles").collect(); // 1st scan
const puzzles = await ctx.db.query("puzzles").order("desc").collect(); // 2nd scan
const paginatedPuzzles = puzzles.slice(startIndex, endIndex); // Manual pagination
```

**User Impact**: Archive page load becomes progressively slower as puzzles accumulate
**Fix**: Create shared cursor-based pagination helper using Convex's built-in pagination, apply to both modes
**Expected**: 500ms → 50ms (10x improvement)
**Effort**: 2h | **Impact**: 9/10 - Major user-facing performance win
**Acceptance**: Archive loads in <100ms, no full table scans, works for both Classic and Order modes

---

### [PERFORMANCE] CRITICAL - react-markdown Bundle Overhead (44KB)

**File**: `src/components/ui/HintText.tsx:4`, `src/components/HistoricalContextCard.tsx:6`
**Perspectives**: performance-pathfinder
**Severity**: HIGH
**Impact**: 44KB bundle (14% of total) for rendering only **bold** and _italics_
**User Impact**: Mobile 3G load ~1s slower
**Fix**: Replace with 50-line inline formatter using simple regex
**Expected**: 44KB → 1KB (44x reduction)
**Effort**: 1h | **Impact**: 9/10 - Largest bundle reduction opportunity
**Acceptance**: Same formatting output, bundle size verified reduced

---

### [INFRA] HIGH - No Health Check Endpoint

**Perspectives**: observability-audit
**Impact**: Cannot set up uptime monitoring, no way to detect downtime
**Fix**: Create `/api/health` route returning status and timestamp

```typescript
// src/app/api/health/route.ts
export function GET() {
  return Response.json({ status: "ok", timestamp: new Date().toISOString() });
}
```

- Set up UptimeRobot or BetterUptime free tier for monitoring
  **Effort**: 15m | **Impact**: Downtime detection in < 5 minutes
  **Acceptance**: Health endpoint returns 200, uptime monitoring configured

---

## Soon (Next Sprint, 2-4 weeks)

### [ARCHITECTURE] MEDIUM - Boundary Coupling (Backend ↔ Frontend)

**File**: `convex/puzzles/mutations.ts:7-8`
**Perspectives**: architecture-guardian
**Problem**: Convex backend imports from `src/lib/scoring` - mixes frontend/backend build surfaces

```typescript
import { scoreRange } from "../../src/lib/scoring";
```

**Risk**: Build/deploy coupling, drift risk between frontend/backend logic
**Fix Options**:

1. Move scoring to `convex/lib/scoring.ts` (quick)
2. Create `packages/domain/` workspace (proper, enables future modes)
   **Effort**: 1-2h | **Risk**: MEDIUM - No runtime impact, but maintenance burden
   **Acceptance**: Convex code never imports from `src/`

---

### [UX] HIGH - Timezone/Date Consistency

**Problem**:

- README claims specific timezone reset
- Classic `getDailyPuzzle` uses UTC
- Order `getOrderPuzzleByDate` accepts client local date
  **Impact**: "my puzzle changed early/late" complaints, streak distrust
  **Decision**: Standardize on **client local date** everywhere (more intuitive UX)
  **Fix**:

1. Update Classic to use `getByDate(clientDate)` pattern like Order
2. Add visible countdown timer showing time until local midnight
3. Update README to document local-date behavior
   **Effort**: 2h | **Risk**: HIGH - User trust, streak integrity
   **Acceptance**: Both modes use consistent local-date logic, countdown visible

---
