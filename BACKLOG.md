# BACKLOG

Last groomed: 2025-11-18
Analyzed by: 8 specialized perspectives (complexity-archaeologist, architecture-guardian, security-sentinel, performance-pathfinder, maintainability-maven, user-experience-advocate, product-visionary, design-systems-architect)

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

## Soon (Exploring, 3-6 months)

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
