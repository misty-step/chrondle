# BACKLOG

Last groomed: 2025-11-25
Analyzed by: 8 specialized perspectives (complexity-archaeologist, architecture-guardian, security-sentinel, performance-pathfinder, maintainability-maven, user-experience-advocate, product-visionary, design-systems-architect)

**Recent Addition (2025-11-25):** Event & Puzzle Generation System Modernization deferred items added to "Soon" and "Later" sections. See TODO.md for approved Phase 1-3 implementation tasks (120 hours, 6 weeks).

---

## Now (Sprint-Ready, <2 weeks)

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

### [PERFORMANCE] HIGH - getArchivePuzzles Full Table Scans

**File**: `convex/puzzles/queries.ts:72-96`
**Perspectives**: performance-pathfinder
**Impact**: Two full table scans per archive page load → 500ms query time
**Code**:

```typescript
const allPuzzles = await ctx.db.query("puzzles").collect(); // 1st scan
const puzzles = await ctx.db.query("puzzles").order("desc").collect(); // 2nd scan
const paginatedPuzzles = puzzles.slice(startIndex, endIndex); // Manual pagination
```

**User Impact**: Archive page load scales linearly with puzzle count
**Fix**: Use Convex's built-in pagination with cursors
**Expected**: 500ms → 50ms (10x improvement)
**Effort**: 2h | **Impact**: 9/10 - Major user-facing performance win
**Acceptance**: Archive loads in <100ms, no full table scans

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

## Next (This Quarter, <3 months)

### [QUALITY] HIGH - Toast Provider Unmount Cleanup

**File**: `src/hooks/use-toast.tsx:51-61`
**Source**: PR #55 CodeRabbit review
**Problem**: Auto-dismiss timeouts persist after ToastProvider unmounts, causing dispatch on unmounted component
**Fix**: Track timeouts in ref, clear all on unmount

```typescript
const timeoutsRef = React.useRef<Set<NodeJS.Timeout>>(new Set());
React.useEffect(() => {
  return () => timeoutsRef.current.forEach(clearTimeout);
}, []);
```

**Effort**: 30m | **Benefit**: Prevents React warnings, memory leaks
**Acceptance**: No console warnings when provider unmounts with pending toasts

---

### [QUALITY] HIGH - Clarify Hash Privacy Guarantees

**File**: `src/observability/hash.ts:34`
**Source**: PR #55 CodeRabbit review
**Problem**: FNV-1a is non-cryptographic but docs imply PII protection
**Fix**: Update JSDoc to clarify weak privacy guarantee OR implement HMAC-SHA256 with salt

```typescript
/**
 * Hash user identifier using FNV-1a (non-cryptographic).
 * NOT reversible-proof or collision-resistant.
 * For stronger privacy, consider HMAC-SHA256 with salt.
 */
```

**Effort**: 15m (docs) or 2h (upgrade to HMAC)
**Benefit**: Clear security expectations
**Acceptance**: JSDoc updated OR cryptographic hash implemented

---

### [UX] MEDIUM - ARIA Role Clarity for Toast Notifications

**File**: `src/components/ui/toaster.tsx:13-118`
**Source**: PR #55 CodeRabbit review
**Problem**: Mixing `role="alert"` with `aria-live="polite"` sends conflicting signals
**Fix**: Use `role="status"` with `aria-live="polite"` for non-destructive toasts, reserve `role="alert"` for destructive

**Effort**: 1h | **Benefit**: Better screen reader UX
**Acceptance**: Non-destructive toasts use status role, destructive use alert

---

### [QUALITY] MEDIUM - Sentry Test Initialization Robustness

**File**: `src/observability/__tests__/sentry.client.test.ts:39-93`
**Source**: PR #55 CodeRabbit review
**Problem**: Tests depend on execution order (first test initializes, others assume initialized)
**Fix**: Add `beforeEach` to explicitly initialize Sentry with test DSN

**Effort**: 30m | **Benefit**: Tests isolated, reordering-safe
**Acceptance**: Tests pass in any order

---

### [QUALITY] MEDIUM - ConvexError for Structured Validation

**File**: `convex/orderPuzzles/mutations.ts:92-161`
**Source**: PR #55 CodeRabbit review
**Problem**: Plain `Error` objects lose client-side error classification context
**Fix**: Use `ConvexError` for validation errors to enable structured handling

```typescript
if (Math.abs(verifiedScore.totalScore - args.clientScore.totalScore) > 1) {
  throw new ConvexError("Score verification failed");
}
```

**Effort**: 1h | **Benefit**: Better client error UX, proper retryable classification
**Acceptance**: Validation errors classified as VALIDATION with retryable: false

---

### [OBSERVABILITY] MEDIUM - Deep Argument Sanitization

**File**: `convex/lib/observability.ts:119-126`
**Source**: PR #55 CodeRabbit review
**Problem**: Shallow sanitization only redacts top-level `token`/`password`, misses nested sensitive data
**Fix**: Implement recursive sanitization or use library

```typescript
{
  user: {
    password: "secret";
  }
} // Currently NOT sanitized
```

**Effort**: 2h | **Benefit**: Comprehensive PII protection in error logs
**Acceptance**: Nested sensitive fields redacted in Sentry extras

---

### [OBSERVABILITY] MEDIUM - User Context Enrichment in Observability

**File**: `convex/lib/observability.ts:31-82`
**Source**: PR #55 CodeRabbit review
**Problem**: Wrapper doesn't extract user context from args (e.g., `args.userId`)
**Fix**: Add truncated userId to Sentry tags

```typescript
tags: {
  convexFn: config.name,
  userId: args?.userId ? String(args.userId).slice(0, 8) : undefined,
  ...config.tags,
}
```

**Effort**: 30m | **Benefit**: User-scoped error tracking
**Acceptance**: userId appears in Sentry tags when present in args

---

### [OBSERVABILITY] LOW - classifyError Type Alignment

**File**: `convex/lib/observability.ts:91`
**Source**: PR #55 CodeRabbit review
**Problem**: Returns "unknown" but type includes "server" - unclassified errors likely server-side
**Fix**: Return "server" instead of "unknown" OR align type with implementation

**Effort**: 10m | **Benefit**: More accurate error classification
**Acceptance**: Unclassified errors tagged as "server" or type updated

---

### [OBSERVABILITY] MEDIUM - Sample Rate Validation

**File**: `src/observability/sentry.client.ts:27-80`
**Source**: PR #55 CodeRabbit review
**Problem**: `parseFloat` on env vars can produce NaN, breaking sampling
**Fix**: Add validation helper

```typescript
function parseSampleRate(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) || parsed < 0 || parsed > 1 ? defaultValue : parsed;
}
```

**Effort**: 30m | **Benefit**: Prevents NaN sampling rates
**Acceptance**: Invalid sample rates fall back to defaults

---

### [OBSERVABILITY] MEDIUM - Error Deduplication

**File**: `src/observability/mutationErrorAdapter.ts:78-110`
**Source**: PR #55 CodeRabbit review
**Problem**: Repeated errors (e.g., spamming submit) create noise in Sentry
**Fix**: Add 5-second deduplication window

```typescript
const recentErrors = new Map<string, number>();
const errorKey = `${error.code}:${error.message}`;
const lastSeen = recentErrors.get(errorKey);
if (!lastSeen || Date.now() - lastSeen > 5000) {
  recentErrors.set(errorKey, Date.now());
  captureClientException(error.originalError, {...});
}
```

**Effort**: 1h | **Benefit**: Reduces Sentry quota usage
**Acceptance**: Duplicate errors within 5s not sent to Sentry

---

### [INFRA] HIGH - No Structured Logging (Pino)

**Files**: `src/lib/logger.ts`, `convex/lib/logging.ts`
**Perspectives**: architecture-guardian
**Impact**: Console-based logging unusable for log aggregation, debugging in Vercel
**Current**: Custom console wrapper (248 lines) without JSON structure
**Fix**:

- Install pino + pino-pretty
- Create structured logger with request IDs, user context, timing
- Export context-aware child loggers
  **Effort**: 4h | **Impact**: Production observability, debugging
  **Acceptance**: JSON-structured logs in Vercel, correlation IDs present

---

### [INFRA] HIGH - No Vercel Speed Insights

**Perspectives**: observability-audit
**Impact**: No Core Web Vitals tracking (LCP, FID, CLS), no Real User Monitoring
**Current State**: Vercel Analytics installed but Speed Insights missing
**Fix**:

```bash
pnpm add @vercel/speed-insights
```

```typescript
// app/layout.tsx - add after <Analytics />
import { SpeedInsights } from '@vercel/speed-insights/next';
<SpeedInsights />
```

**Effort**: 10m | **Impact**: Performance visibility, Core Web Vitals tracking
**Acceptance**: Speed Insights data visible in Vercel dashboard

---

### [INFRA] HIGH - OpenTelemetry Missing Grafana Cloud Export

**File**: `src/instrumentation.ts`
**Perspectives**: observability-audit
**Impact**: Traces collected but not exported anywhere - invisible data
**Current State**: registerOTel configured but no OTLP exporter endpoint set
**Fix**: Configure Vercel env vars for Grafana Cloud (free tier: 50GB traces/month)

```bash
# In Vercel env vars
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-us-east-0.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic <base64(instanceId:apiKey)>"
```

**Effort**: 30m | **Impact**: Distributed tracing visibility
**Acceptance**: Traces visible in Grafana Cloud Tempo

---

### [INFRA] MEDIUM - Wire Custom Events to Vercel Analytics

**Files**: `src/lib/analytics.ts`, `src/hooks/useAnalytics.ts`
**Perspectives**: observability-audit
**Impact**: GameAnalytics events collected but not sent to Vercel Analytics - no conversion funnels
**Current State**: Custom analytics module exists (505 lines) but likely only logs to console
**Fix**: Wire events to Vercel Analytics track():

```typescript
import { track } from "@vercel/analytics";
track("game_completed", { score, hintsUsed, puzzleNumber });
```

**Effort**: 2h | **Impact**: Product insights, conversion tracking
**Acceptance**: Custom events visible in Vercel Analytics dashboard

---

### [INFRA] MEDIUM - Configure Intelligent Trace Sampling

**File**: `src/instrumentation.ts`
**Perspectives**: observability-audit
**Impact**: Default 100% sampling may exceed free tier quickly
**Fix**: Configure intelligent sampler (10% base, 100% errors)

```typescript
registerOTel({
  serviceName: "chrondle",
  tracesSampleRate: 0.1, // 10% base rate
  // Use custom sampler for 100% on errors
});
```

**Effort**: 30m | **Impact**: Stay within free tier, capture all errors
**Acceptance**: Sample rate configured, error traces always captured

---

### [SECURITY] MEDIUM - Data Exposure in getUserPlay/userExists

**Files**: `convex/plays/queries.ts:28-94`, `convex/users/queries.ts:73-113`
**Perspectives**: security-sentinel
**Impact**: Returns play records and emails for any userId without ownership check
**Attack Vector**: Enumerate user IDs to see others' guesses, completion status, scores
**Fix**: Verify authenticated user matches requested userId
**Effort**: 40m | **Priority**: MEDIUM
**Acceptance**: Queries return 403 when userId doesn't match auth

---

### [SECURITY] MEDIUM - Missing Rate Limiting on Mutations

**File**: `convex/puzzles.ts:316-391`
**Perspectives**: security-sentinel
**Impact**: Brute force attack - submit 1000 guesses/second to find answer
**Fix**: Rate limit: max 6 guesses per puzzle, 2-second delay between guesses
**Effort**: 45m | **Impact**: Game integrity
**Acceptance**: Rate limit errors returned when exceeded

---

### [TESTS] HIGH - Missing Hook Test Coverage

**Files**: Multiple hooks in `src/hooks/`
**Perspectives**: maintainability-maven
**Impact**: Core game logic has zero test coverage

| Hook                              | Risk                                |
| --------------------------------- | ----------------------------------- |
| `useOrderGame.ts`                 | HIGH - Main Order mode orchestrator |
| `useShareGame.ts`                 | MEDIUM - User-facing share feature  |
| `useAnalytics.ts`                 | MEDIUM - User behavior tracking     |
| `useScreenReaderAnnouncements.ts` | MEDIUM - Accessibility              |

**Fix**: Add test files for each hook with React Testing Library
**Effort**: 8h total | **Benefit**: Confidence for Order mode, sharing features
**Acceptance**: 80%+ coverage on critical hooks

---

### [DOCS] HIGH - Undocumented Scoring Constants

**File**: `src/lib/scoring.ts:3-11`
**Perspectives**: maintainability-maven
**Impact**: Developers can't tune scoring without understanding rationale
**Code**:

```typescript
export const SCORING_CONSTANTS = {
  W_MAX: 250, // Why 250?
  MAX_SCORES_BY_HINTS: [100, 85, 70, 55, 45, 35, 25] as const, // Why these?
  HINT_COSTS: [15, 15, 15, 10, 10, 10] as const, // Why 15/10 split?
};
```

**Fix**: Add documentation explaining each constant's rationale
**Effort**: 30m | **Benefit**: Safe future tuning, informed game balance
**Acceptance**: Each constant has JSDoc explaining why

---

### [ARCHITECTURE] MEDIUM - Information Leakage in Toast Handling

**File**: `src/hooks/actions/useGameActions.ts:45-81`
**Perspectives**: complexity-archaeologist
**Impact**: 13 instances of identical toast handling pattern
**Code**:

```typescript
if ("addToast" in toastContext) {
  toastContext.addToast({...});
}
```

**Violation**: Toast implementation detail leaks through abstraction
**Fix**: Extract to domain-specific notification methods:

```typescript
const notify = useNotifications();
notify.error("title", "description");
```

**Effort**: 1h | **Benefit**: Eliminates 13 duplication sites
**Acceptance**: No direct toast context access in action hooks

---

### [ARCHITECTURE] MEDIUM - GameIsland 55-Line Adapter

**File**: `src/components/GameIsland.tsx:69-125`
**Perspectives**: complexity-archaeologist
**Impact**: Adapter transforms `useRangeGame` output to match legacy interface
**Violation**: Adapter adds complexity without hiding implementation
**Fix**: Update consuming components to use new interface directly, remove adapter
**Effort**: 2h | **Benefit**: Reduces GameIsland by 50+ lines
**Acceptance**: GameLayout uses gameState directly, no adapter

---

### [DESIGN] MEDIUM - GamesGallery Hardcoded Colors

**File**: `src/components/GamesGallery.tsx:40-58, 285-287`
**Perspectives**: design-systems-architect
**Impact**: 20+ hex colors bypass token system, won't theme globally
**Code**:

```typescript
bg: "bg-[#EBE7DE] dark:bg-[#2A2420]",
fg: "text-[#3E3428] dark:text-[#EBE7DE]",
```

**Fix**: Either add semantic tokens (`--gallery-classic-bg`) or document as intentional design outlier
**Effort**: 1h | **Benefit**: Token consistency or documented exception
**Acceptance**: Colors either use tokens or have documentation

---

### [DESIGN] MEDIUM - ComparisonGrid Duplication

**File**: `src/components/order/ComparisonGrid.tsx:48-261`
**Perspectives**: design-systems-architect
**Impact**: ~100 lines duplicated between mobile and desktop views
**Violation**: Information leakage - layout concerns leak into business logic
**Fix**: Extract shared `EventListItem` component
**Effort**: 1h | **Benefit**: DRY, single source of truth
**Acceptance**: No duplicated rendering logic

---

### [PERFORMANCE] MEDIUM - getUserCompletedPuzzles In-Memory Filter

**File**: `convex/plays/queries.ts:105-118`
**Perspectives**: performance-pathfinder
**Impact**: `.filter()` after index filters in memory
**Fix**: Add compound index `by_user_completed` on `["userId", "completedAt"]`
**Expected**: 200ms → 20ms for users with many completed puzzles
**Effort**: 30m | **Impact**: 7/10
**Acceptance**: Query uses index without in-memory filter

---

### [COMPLEXITY] MEDIUM - enhancedFeedback.ts Nested Era Logic

**File**: `src/lib/enhancedFeedback.ts:185-255`
**Perspectives**: complexity-archaeologist, maintainability-maven
**Impact**: 7 nested conditionals, overlapping thresholds (10, 15, 100, 500)
**Fix**: Extract to strategy pattern with testable units
**Effort**: 2h | **Benefit**: 9/10 - Testable, extensible
**Acceptance**: Each strategy separately testable

---

### [COMPLEXITY] MEDIUM - constants.ts Configuration Explosion

**File**: `src/lib/constants.ts:1-284`
**Perspectives**: complexity-archaeologist, maintainability-maven
**Impact**: 284 lines spanning unrelated domains
**Fix**: Split into domain files: `config/game.ts`, `config/scoring.ts`, `config/ui.ts`
**Effort**: 2h | **Impact**: 6/10
**Acceptance**: Constants colocated with usage

---

### [UX] HIGH - No Loading State for Guess Submission

**File**: `src/components/game/RangeInput.tsx:296-304`
**Perspectives**: user-experience-advocate
**Impact**: No feedback while mutation processes → Users click multiple times
**Fix**: Pass `isSubmitting` to RangeInput, show loading spinner + "Submitting..."
**Effort**: 30m | **Impact**: 8/10
**Acceptance**: Button shows loading state during submission

---

### [UX] MEDIUM - Generic Error Screen

**File**: `src/components/GameIsland.tsx:249-260`
**Perspectives**: user-experience-advocate
**Impact**: Technical error messages, only "Reload Page" option
**Fix**: User-friendly error translation, multiple recovery options (Try Again, Check Connection, Contact Support)
**Effort**: 2h | **Impact**: 8/10
**Acceptance**: Errors show actionable recovery steps

---

### [UX] MEDIUM - EraToggle Focus Management

**File**: `src/components/ui/EraToggle.tsx`
**Perspectives**: user-experience-advocate
**Impact**: No visual focus indicator for keyboard users
**Fix**: Implement roving tabindex, visible focus ring on buttons
**Effort**: 1h | **Impact**: HIGH - Accessibility
**Acceptance**: Tab shows clear focus indicator, arrow keys work properly

---

### PR #61 Design System Feedback (CodeRabbit Review - 88 comments)

**Review Date**: 2025-11-25
**PR**: #61 "feat: comprehensive archival design system with Tailwind v4"
**Categorization**: 18 high-priority alignment issues, 28 code quality improvements, 40 low-priority items
**P0 Issues Fixed**: HintIndicator crash guard, bg-surface-hover missing class

#### [DESIGN] HIGH - Semantic Token Migration Completion

**Files**: 8 components with remaining hardcoded colors
**Source**: PR #61 CodeRabbit review
**Problem**: Design system migration incomplete - hardcoded colors/inline styles bypass token system
**Impact**: Inconsistent dark mode support, harder to maintain theme

**Affected Components**:

1. `src/components/magicui/ripple-button.tsx (13)` - Hardcoded `#ffffff` default
2. `src/components/ui/StreakIndicator.tsx (27-59)` - Inline styles + hardcoded `"white"`
3. `src/components/game/RangeTimeline.tsx (70, 115, 143)` - SVG hex colors won't adapt to dark mode
4. `src/components/ui/EventsCard.tsx (11-45)` - Timeline dot `to-blue-600` primitive
5. `src/components/modals/GameComplete.tsx (379-386)` - `bg-amber-100` hardcoded
6. `src/components/ui/Badge.tsx (10-18)` - `earlier`/`later` variants need semantic tokens
7. `src/components/modals/GameComplete.tsx (117-132)` - Feedback status colors hardcoded
8. `src/components/magicui/ripple-button.tsx (49-53)` - Missing semantic border color

**Fix**: Replace all with CSS custom properties/semantic Tailwind tokens
**Effort**: 4h | **Benefit**: Complete design system consistency
**Acceptance**: No hardcoded colors in components, SVGs use `currentColor` or CSS vars

---

#### [QUALITY] MEDIUM - Type Safety Improvements

**Files**: 3 files using `any` or loose typing
**Source**: PR #61 CodeRabbit review

1. **useOrderPuzzleData.ts (7, 106-119)** - Replace `any` with union type for puzzle shapes

   - **Fix**: Create `ConvexPuzzle | NormalizedPuzzle` union type
   - **Effort**: 30m

2. **convexServer.ts (17-38)** - Tighten `convexPuzzle.events` typing

   - **Fix**: Add proper event type instead of implicit `any[]`
   - **Effort**: 20m

3. **formatHints.tsx (1)** - Remove unnecessary React runtime import
   - **Fix**: Change to type-only import: `import type { ReactNode } from "react"`
   - **Effort**: 5m

**Total Effort**: 1h | **Benefit**: Catch schema drift at compile time

---

#### [QUALITY] MEDIUM - Component Cleanup

**Files**: 7 files with unused code or TODOs
**Source**: PR #61 CodeRabbit review

1. **Card.tsx (5-67)** - Remove empty string in `cn("")` call (cosmetic)
2. **OrderReveal.tsx (119-128)** - Reorder Tailwind classes for consistency
3. **DebugBanner.tsx (12-28)** - Migrate inline styles to semantic tokens
4. **OrderGameBoard.tsx (132-145)** - Remove unused destructured variable
5. **OrderGameBoard.tsx (247-262)** - Address TODO for bracket hint generation
6. **LoadingExperience.tsx (10-24)** - Remove unused `delayMs` prop
7. **GameModeLayout.tsx (17-25)** - Remove unused `_confettiRef` prop

**Effort**: 2h | **Benefit**: Cleaner codebase, addressed TODOs

---

#### [TESTS] HIGH - Test Coverage Expansion

**Files**: 9 test files with gaps identified
**Source**: PR #61 CodeRabbit review

1. **typography.tsx (1-106)** - Add unit tests for new typography components

   - **Coverage**: Variant rendering, polymorphic `as` prop, ref forwarding
   - **Effort**: 2h

2. **LoadingExperience.unit.test.tsx (6-20)** - Expand coverage

   - **Missing**: `progress`, `subMessage`, `intent`, `prefersReducedMotion`, `delayMs`
   - **Effort**: 1h

3. **convexServer.import.test.ts (5-16)** - Add fetch helper tests

   - **Missing**: `fetchOrderPuzzleByNumber`, `fetchClassicPuzzleByNumber`
   - **Effort**: 1h

4. **LoadingModules.unit.test.tsx (19-21)** - Use role/testid instead of CSS class selector

   - **Fix**: Replace `.querySelector(".h-1\\.5")` with `role="progressbar"`
   - **Effort**: 15m

5. **AppHeader.test.tsx (43-53)** - More robust test selectors

   - **Fix**: Add `data-testid="archive-button"` or use `getByRole("link", { name: /archive/i })`
   - **Effort**: 30m

6. **SubmitButton.test.tsx (14-30, 33-75, 133-149)** - Various improvements

   - **Issues**: Brittle class assertions, no-assertion test, tight coupling
   - **Effort**: 2h

7. **HintPanel.test.tsx (222-276)** - Fix conditional assertions that may hide failures

   - **Effort**: 1h

8. **GameModeLayout.test.tsx (324-343, 345-364)** - Improve hydration tests, review documentary tests
   - **Effort**: 1.5h

**Total Effort**: 9.5h | **Benefit**: Catch regressions in new components

---

#### [ACCESSIBILITY] MEDIUM - A11y Refinements

**Files**: 8 components with accessibility improvements
**Source**: PR #61 CodeRabbit review

1. **InlineWarning.tsx (28-51)** - Fix `role="alert"` + `aria-live="polite"` conflict

   - **Fix**: Use `role="status"` for polite, reserve `role="alert"` for assertive
   - **Effort**: 30m

2. **GuessHistory.tsx (21-61)** - Add `role="listitem"` to GuessRow

   - **Current**: Parent has `role="list"` but children don't have `role="listitem"`
   - **Effort**: 15m

3. **GameLayout.tsx (89-91)** - Minor stamp overlay a11y tweak

   - **Effort**: 20m

4. **ThemeToggle.tsx (50-95)** - Expose pressed state for a11y

   - **Fix**: Add `aria-pressed` attribute
   - **Effort**: 15m

5. **GameComplete.tsx (214-407)** - Progressive breakdown a11y nits

   - **Effort**: 1h

6. **RangeInput.tsx (169-170)** - Tighten reduced-motion + keyboard UX

   - **Effort**: 30m

7. **LoadingScreen.tsx (10-15)** - Clarify null-coalescing intent (add comment)

   - **Effort**: 5m

8. **OrderGameIsland.tsx (46-55)** - Use dedicated error component instead of LoadingScreen
   - **Fix**: Create proper error state component
   - **Effort**: 1h

**Total Effort**: 4h | **Benefit**: WCAG AA compliance, better screen reader UX

---

#### [DOCS] MEDIUM - Documentation Additions

**Files**: 5 files needing documentation
**Source**: PR #61 CodeRabbit review

1. **hashHintContext.ts (1-13)** - Document non-crypto intent

   - **Fix**: Add JSDoc clarifying FNV-1a is for bucketing, not security
   - **Effort**: 10m

2. **DESIGN_SYSTEM.md (9-15)** - Fix markdownlint warnings

   - **Issues**: Missing code fence languages, bare URLs
   - **Effort**: 15m

3. **.lintstagedrc.js (3-8)** - Quote file paths for spaces

   - **Fix**: Wrap filenames in quotes or use xargs for robustness
   - **Effort**: 10m

4. **HintPanel.tsx (187-188)** - Extract magic number constant
   - **Current**: Hardcoded `3` for maximum hints
   - **Fix**: `const MAX_ORDER_HINTS = 3`
   - **Effort**: 5m

**Total Effort**: 40m | **Benefit**: Better maintainability

---

#### [ARCHITECTURE] MEDIUM - Architecture Concerns

**Files**: 6 files with architectural issues
**Source**: PR #61 CodeRabbit review

1. **GameIsland.tsx (237-250)** - Error UI rendered outside ErrorBoundary scope

   - **Risk**: Errors in error UI itself won't be caught
   - **Effort**: 1h

2. **ClassicArchivePuzzleClient.tsx (49-55)** - Render explicit error state instead of perpetual loading

   - **Current**: Error shows loading spinner forever
   - **Effort**: 30m

3. **globals.css (673-682)** - Paper-edge SVG filters remain non-functional

   - **Status**: Known issue, may be intentional
   - **Effort**: 2h (if fixing)

4. **ripple-button.tsx (60-71)** - Clarify canonical ripple color source

   - **Issue**: Confusion between class-based and inline style colors
   - **Effort**: 30m

5. **RangeInput.tsx (62-90)** - Confirm `hasBeenModified` gating is intentional
   - **Current**: Validation only runs after first modification
   - **Effort**: Review + document intent (20m)

**Total Effort**: 4.5h | **Benefit**: Clearer architecture, fewer edge cases

---

#### [PRAISE] Acknowledged Positive Feedback (No Action Required)

**Source**: PR #61 CodeRabbit review - 40 comments

**Categories**:

- ✅ Test alignment and quality (7 comments)
- ✅ Component logic soundness (5 comments)
- ✅ Deep module pattern implementation (3 comments)
- ✅ Consistent styling updates (10 comments)
- ✅ Proper type usage (8 comments)
- ✅ Good foundations for testing/infrastructure (7 comments)

**Items Explicitly Praised**:

- RangeInput test alignment with new copy/scoring
- Deep module pattern in HintPanel/GameCard
- Consistent vermilion token wiring
- Extended mode detection for `/archive/order`
- Deterministic hash implementation
- Solid ARIA semantics in InlineWarning
- Archive shell composition
- Loss state styling with semantic tokens

**Total**: 40 items requiring no action, documented for context

---

**PR #61 Summary**:

- **Fixed Immediately (P0)**: 2 critical issues (HintIndicator crash, missing utility class)
- **High Priority (P1)**: 18 items → 11.5h effort (semantic tokens, type safety, cleanup)
- **Medium Priority (P2)**: 28 items → 18.5h effort (tests, a11y, docs, architecture)
- **Acknowledged**: 40 items of positive feedback

**Recommended Next Steps**:

1. Complete semantic token migration (4h) - finish design system goals
2. Address type safety improvements (1h) - prevent runtime errors
3. Expand test coverage (9.5h) - protect new components
4. Accessibility refinements (4h) - WCAG AA compliance

---

## Soon (Exploring, 3-6 months)

### [EVENT GEN] Phase 4-5: Advanced LLM Features (Deferred from Modernization Plan)

**Context**: Part of approved event generation modernization plan (Phases 1-3 = 120 hours). These Phase 4-5 features (80 hours) deferred pending Phase 1-3 success validation.
**Dependencies**: Must complete Gemini 3 migration + quality validator + observability first
**Timeline**: Revisit after Week 6 (Phase 1-3 completion)

---

#### [EVENT GEN] Historical Knowledge Base for Factual Validation

**File**: `convex/lib/historicalKnowledgeBase.ts` (new)
**Problem**: Current quality validation can't detect historically impossible events or temporal disambiguation issues
**Implementation**:

- Build database of 10K+ major historical events with embeddings
- Implement temporal disambiguation: "Which 'Battle of X' does this refer to?"
- Add year-event alignment scoring: Query "Did event Y really happen in year Z?"
- Enable knowledge base queries in qualityValidator for factual checks

**Benefits**:

- Catches historically impossible events (90%+ accuracy)
- Resolves ambiguous event descriptions
- Improves player trust in event accuracy

**Effort**: 40h | **Cost**: ~$50 to generate embeddings for 10K events (Gemini 3 text-embedding-004)
**Value**: 8/10 - Factual quality improvement

---

#### [EVENT GEN] ML-Based Quality Predictor

**File**: `convex/lib/qualityPredictor.ts` (new)
**Problem**: Expensive LLM Critic stage runs on all candidates, including obvious low-quality ones
**Implementation**:

- Collect 6 months of generation data (events + quality scores) as training set
- Train lightweight classifier (logistic regression or small neural net)
- Features: Event length, proper noun count, word diversity, metadata completeness
- Integrate as pre-filter: Only send high-confidence candidates to Critic

**Benefits**:

- Reduces Critic API calls by 30% without increasing false negatives
- Saves ~$30/year in LLM costs (30% of $108)
- Faster generation pipeline (skip Critic for obvious failures)

**Dependencies**: Need 6 months of Gemini 3 generation data first (wait until September 2025)
**Effort**: 20h | **Value**: 7/10 - Cost optimization

---

#### [EVENT GEN] Self-Improvement Loops

**Files**: `convex/lib/promptEvolution.ts`, `convex/lib/adaptiveThresholds.ts` (new)
**Problem**: System requires manual tuning when model behavior changes or quality degrades
**Implementation**:

- **Prompt Evolution Engine**: A/B test prompt variations, track quality/cost, auto-adopt better prompts
- **Adaptive Quality Thresholds**: Monitor score distributions, adjust thresholds to maintain target failure rate
- **Automated Retraining**: Quality predictor retrains monthly on new high-quality events
- **Drift Detection**: Alert when model behavior changes significantly (degradation or improvement)

**Benefits**:

- System improves quality by 10% over 6 months without manual intervention
- Prompts evolve to handle edge cases discovered in production
- Adaptive thresholds maintain stable failure rate despite model drift

**Dependencies**: Requires ML predictor + 12 months of operational data
**Effort**: 20h | **Value**: 6/10 - Long-term quality optimization

---

### [PRODUCT] Social Leaderboards & Competition System

**Current State**: Zero social features - completely single-player
**Perspectives**: product-visionary
**Competitive Gap**: 90% of daily games have leaderboards
**Missing**: Friend leaderboards, global rankings, weekly tournaments, social proof
**Implementation**: Add friendships table, weeklyScores table, challenge links
**Business Value**: Viral coefficient 1.05 → 1.3+, could 3-5x user acquisition
**Effort**: 5-7 days | **Value**: 10/10

---

### [PRODUCT] Premium Subscription Tier

**Current State**: 100% free, Bitcoin donations only
**Perspectives**: product-visionary
**Bundle ($4.99/mo)**: Unlimited archive, difficulty variants, streak freezes, badges
**Revenue Projection**: 50K DAU × 5% = $12.5K/mo = $150K/year
**Effort**: 8-10 days | **Value**: 10/10

---

### [PRODUCT] Freemium Archive Paywall

**Current State**: 1,821-puzzle archive FREE
**Perspectives**: product-visionary
**Model**: Free = Daily + 5 archive/month, Premium = Unlimited
**Effort**: 2-3 days | **Value**: 9/10 - Immediate monetization

---

### [PRODUCT] Shareable Challenge Links

**Current State**: Basic emoji share only
**Perspectives**: product-visionary
**Features**: "Beat my score" links, puzzle-specific sharing, streak flexing
**Viral Impact**: 3-5x user acquisition
**Effort**: 3 days | **Value**: 9/10

---

### [PRODUCT] Streak Freeze & Recovery

**Current State**: Miss one day = streak reset (churn trigger)
**Perspectives**: product-visionary
**Features**: Freeze tokens, emergency saves ($1.99/3-pack), vacation mode
**Business Value**: Reduce churn 20-30%, impulse purchase revenue
**Effort**: 3-4 days | **Value**: 8/10

---

### [PRODUCT] Difficulty Variants

**Current State**: Single difficulty
**Perspectives**: product-visionary
**Opportunity**: Easy Mode (beginners), Hard Mode (experts), Speed Run (competitive)
**TAM Expansion**: Easy mode opens younger audience (12-16), families
**Effort**: 4-5 days | **Value**: 8/10

---

### [DESIGN] Analog Archival Aesthetic Overhaul

**Current State**: Generic blue-on-white UI
**Perspectives**: product-visionary, design-systems-architect
**Direction**: Library card catalog, typewriter effects, wax seals, filing cabinet metaphors
**Typography**: Libre Baskerville, Courier Prime, IBM Plex Mono
**Success Metrics**: Session +15-20%, Share rate +25-30%, Return +10%
**Effort**: 160h (~4 weeks) | **Value**: 10/10 - Major differentiator
**Note**: Detailed spec preserved in `docs/design/AESTHETIC_OVERHAUL.md`

---

### [PRODUCT] Confidence Wager System

**Problem**: Players can binary-search without engaging with hints
**Mechanic**: Wager confidence before submitting guess
**Options**: Confidence slider (1-5 stars), proximity wager (±10yr/±50yr), hint trade-off
**Design Goal**: Add 5-10s contemplation time per guess
**Effort**: 4-6 days | **Value**: 8/10

---

### [INFRA] Changelog Automation (Changesets)

**Current**: Manual CHANGELOG.md updates
**Fix**: Install @changesets/cli, configure for pnpm workspace
**Effort**: 2h | **Impact**: Consistent releases

---

### [UX] Offline Support

**Current State**: App unusable without internet
**Fix**: Detect navigator.onLine, cache daily puzzle in localStorage
**Effort**: 4h | **Impact**: Opens mobile usage in connectivity-poor scenarios

---

### [UX] Archive Search

**Current**: Must browse page-by-page
**Fix**: Search by puzzle number or topic, filter by completion status
**Effort**: 4h | **Impact**: Improved archive usability

---

## Later (Someday/Maybe, 6+ months)

### Future Game Modes (Enabled by Event Metadata)

**Context**: Event metadata (difficulty, category, fame_level, tags) added in Phase 1 enables these modes without schema changes.

#### [PRODUCT] Timeline Mode

**Implementation**: Select 10 events with 1,000+ year spread, use difficulty/fame_level for progressive challenge
**Effort**: 8h | **Value**: New game mode for advanced players

#### [PRODUCT] Category Mode

**Implementation**: Themed puzzles (Science Week, War Month), filter by category metadata
**Effort**: 8h | **Value**: Educational appeal, content marketing

#### [PRODUCT] Multiplayer Mode

**Implementation**: Competitive play on same event set, skill-based matchmaking using fame_level
**Effort**: 12h | **Value**: Social engagement, leaderboards

---

### Infrastructure Enhancements (Event Generation System)

#### [INFRA] Advanced Caching Strategy

**Implementation**: Cache Critic responses for similar events, Redis layer for cross-request caching
**Benefit**: Additional 10-15% cost reduction (~$50/year)
**Effort**: 6h

#### [INFRA] Multi-Region Deployment

**Implementation**: Deploy Convex to US, EU, Asia regions, replicate event pool
**Benefit**: p95 latency reduction from 500ms → 200ms for international users
**Effort**: 12h

#### [INFRA] GraphQL API for Events

**Implementation**: Add GraphQL schema for events/puzzles/plays with rate limiting + auth
**Use Cases**: Third-party apps, data science research, content partnerships
**Effort**: 8h

---

### Quality Enhancements (Event Generation System)

#### [QUALITY] Historical Fact Checker Integration

**Implementation**: Integrate Wikipedia API for event verification, flag inaccuracies
**Benefit**: Reduces historical inaccuracies from 5% → <1%
**Effort**: 10h

#### [QUALITY] Collaborative Filtering for Event Quality

**Implementation**: Track events where players consistently fail, flag for review
**Benefit**: Player-driven quality improvement, reduces frustration
**Effort**: 6h

#### [QUALITY] Event Diversity Scoring

**Implementation**: Ensure puzzles have ≥4 categories, ≥3 regions (global representation)
**Benefit**: More interesting puzzles, educational value
**Effort**: 4h

---

### Operational Improvements (Event Generation System)

#### [INFRA] PagerDuty Integration

**Implementation**: Critical alerts → PagerDuty, warnings → Slack only
**Benefit**: Zero missed critical alerts, faster incident response
**Effort**: 3h

#### [INFRA] Cost Anomaly Detection

**Implementation**: Statistical anomaly detection (Z-score), auto-throttle on spikes
**Benefit**: Prevent budget overruns, automatic cost control
**Effort**: 4h

#### [INFRA] A/B Testing Framework

**Implementation**: Experiment config, traffic splitting, metrics comparison, auto-rollout
**Benefit**: Data-driven decisions, safe experimentation
**Effort**: 8h

---

### General Product Evolution

- **[PRODUCT] Educational B2B Platform** - Topic collections, teacher dashboard, student progress tracking
- **[PRODUCT] Public API** - REST API for puzzle data, OAuth, Zapier integration
- **[PLATFORM] Mobile PWA Enhancement** - App store presence, offline mode, native share
- **[PRODUCT] Internationalization** - Multi-language support, region-specific events
- **[PRODUCT] AI-Powered Personalization** - Adaptive difficulty, personalized content
- **[PRODUCT] Template Marketplace** - Community-contributed events with revenue share

---

## Learnings

**From this grooming session (2025-11-18):**

1. **Security gap was larger than expected**: submitGuess/submitRange accepting client-controlled userId is a critical auth bypass that wasn't previously identified. All mutations accepting userId should be audited.

2. **Infrastructure debt is blocking production readiness**: No Sentry + no structured logging = operating blind. These are prerequisites before scaling user acquisition.

3. **Toast system being non-functional explains UX complaints**: The entire error feedback system is a placeholder. This single fix will dramatically improve user experience.

4. **Performance issues in archive queries will compound**: Full table scans work with 1,821 puzzles but will break at scale. Must fix before archive paywall drives increased usage.

5. **Design system is actually solid**: Despite some hardcoded colors in GamesGallery, the token system is well-architected. The aesthetic overhaul can build on good foundations.

6. **Observability infrastructure is half-built**: OpenTelemetry and Vercel Analytics installed but not fully wired. Traces go nowhere (no Grafana export), analytics has no custom events, no health check for uptime monitoring. Quick wins available (Speed Insights = 10m, health check = 15m).

---

## Summary Metrics

**Analyzed**: Full codebase with 8 specialized perspectives + observability audit
**New Findings**: 22 security issues (+4), 8 infrastructure gaps (+6 from observability), 3 performance optimizations, 4 architecture refactors

**Priority Distribution**:

- Now (Sprint-Ready): 10 items - security critical, UX critical, performance wins, health check
- Next (Quarter): 22 items - infrastructure, observability, tests, maintainability
- Soon (Exploring): 12 items - product features, design overhaul
- Later (Someday): 6 items - platform expansion

**Critical Path Effort**:

- Security fixes: ~5h
- UX critical fixes (toast + validation): ~4h
- Performance (archive + bundle): ~3h
- Observability foundation (Sentry + Pino + health): ~7.5h
- **Total to production-ready: ~19.5h**

**Observability Quick Wins** (< 30 min each):

- Add health check endpoint (15m)
- Add Vercel Speed Insights (10m)
- Configure trace sampling (30m)

**Revenue Opportunities** (Soon):

- Premium subscription: $30K-300K/year potential
- Archive paywall: Immediate monetization of 1,821 puzzles
- Streak saves: $24K/year impulse purchases

**Top 5 ROI Items**:

1. **Fix access control in mutations** (1h, CRITICAL) - Security foundation
2. **Implement toast system** (2-3h, CRITICAL) - All UX feedback depends on this
3. **Add Sentry + Speed Insights** (3h + 10m, CRITICAL) - Production visibility before scaling
4. **Archive query optimization** (2h, 10x speedup) - Unblocks archive paywall
5. **Replace react-markdown** (1h, 44KB savings) - Largest bundle win

**Observability Foundation** (do before scaling users):

- Sentry: Error tracking with session replay
- Speed Insights: Core Web Vitals monitoring
- Health check: Uptime monitoring
- Grafana Cloud: Trace export for performance debugging
