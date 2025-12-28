# Convex Backend Architecture

**Last Updated**: 2025-12-27
**Architecture Status**: Deep Modules + Dual Game Modes + Observability

## Overview

The Chrondle backend is built on Convex, providing real-time database operations, scheduled tasks, and server-side business logic. This architecture follows the **Deep Modules** principle from Ousterhout's "A Philosophy of Software Design" - simple interfaces hiding complex implementations.

## Architecture Principles

### 1. **Deep Modules**: Simple Interface, Powerful Implementation

- **Module Value = Functionality - Interface Complexity**
- Each module exposes 1-6 focused functions (simple interface)
- Internal implementation handles complex business logic (deep functionality)
- Example: `puzzles/queries.ts` exposes 4 query functions, hides puzzle selection algorithm

### 2. **Single Responsibility**

- Each module owns ONE domain responsibility
- Clear boundaries prevent coupling and tangled dependencies
- Example: `streaks/mutations.ts` ONLY handles streak updates, nothing else

### 3. **Backward Compatibility via Barrel Files**

- Legacy `puzzles.ts` and `users.ts` remain as re-export barrels
- Frontend continues using `api.puzzles.*` and `api.users.*`
- Zero breaking changes during refactoring
- Allows gradual migration when needed

### 4. **Security by Design**

- Client data validation in `migration/anonymous.ts` (6-rule streak validation)
- Untrusted localStorage data never accepted without validation
- Internal mutations for sensitive operations (stats updates, context generation)

## Module Structure

### Barrel Files (Backward Compatibility Layer)

```
convex/
├── puzzles.ts           40 lines   Re-exports from puzzles/, plays/, system/
└── users.ts             20 lines   Re-exports from users/, migration/
```

**Purpose**: Maintain `api.puzzles.*` and `api.users.*` interfaces for frontend

### Puzzle System (561 lines across 4 modules)

```
convex/puzzles/
├── queries.ts          129 lines   Daily puzzle retrieval, puzzle lookups
├── mutations.ts        115 lines   Guess submission, validation, play records
├── generation.ts       264 lines   Cron-based daily puzzle creation
└── context.ts           53 lines   AI historical context updates
```

**Responsibilities**:

- **queries.ts**: Read-only puzzle access (getDailyPuzzle, getPuzzleById, getPuzzleByDate, getPuzzleByNumber)
- **mutations.ts**: Guess submission workflow with validation and stats updates
- **generation.ts**: Daily puzzle generation from events, AI context orchestration
- **context.ts**: Historical context updates via OpenRouter GPT-5

**Critical Business Rules**:

- Puzzle generation is deterministic (same events for all users on same day)
- Only today's daily puzzle updates streaks (archive puzzles don't affect streaks)
- All events must have `year`, `title`, and `recognizability` fields

### Play History System (164 lines across 2 modules)

```
convex/plays/
├── queries.ts          111 lines   User play history, completion tracking
└── statistics.ts        53 lines   Play data aggregation
```

**Responsibilities**:

- **queries.ts**: Retrieve user play records (getUserPlay, getUserPlays, getUserCompletedPuzzles)
- **statistics.ts**: Aggregate play data for user stats (calculateUserStats)

### User System (463 lines across 3 modules)

```
convex/users/
├── queries.ts          157 lines   User data retrieval
├── mutations.ts        206 lines   User CRUD operations
└── statistics.ts       100 lines   User metrics aggregation
```

**Responsibilities**:

- **queries.ts**: Read-only user access (getCurrentUser, getUserByClerkId, userExists, getUserStats)
- **mutations.ts**: User creation via webhooks, JIT user creation, username updates
- **statistics.ts**: Update totalPlays, perfectGames, streaks after puzzle completion

**Authentication Flow**:

1. Clerk handles authentication
2. `getOrCreateCurrentUser` creates user record JIT (Just-In-Time)
3. Webhooks create users via `createUserFromWebhook` (backup mechanism)
4. All operations require `ctx.auth.getUserIdentity()` for security

### Anonymous Migration System (437 lines in 1 module)

```
convex/migration/
└── anonymous.ts        437 lines   Anonymous data merge with validation
```

**Responsibilities**:

- Merge anonymous game progress when user signs in
- Merge anonymous streaks with server streaks
- **Security validation** (6 rules to prevent client-side manipulation)

**Validation Rules** (Critical Security):

1. Date format must be valid ISO YYYY-MM-DD
2. Date must not be in the future
3. Date must not be too old (>90 days)
4. Streak count must be positive
5. Streak count must not exceed 365 days
6. Streak length must be consistent with date range

**Merge Strategy**:

- Game state: Prefer more progress (longer guess list)
- Streaks: Combine if consecutive, otherwise keep longer streak
- Dates: Use most recent for equal-length streaks

### Streak System (108 lines in 1 module)

```
convex/streaks/
└── mutations.ts        108 lines   Streak calculation and updates
```

**Responsibilities**:

- Update user streaks after completing daily puzzles
- **CRITICAL**: Archive puzzles do NOT update streaks
- Calculate consecutive days, reset on gaps or failures

**Streak Logic**:

- Continues if previous puzzle was yesterday
- Resets to 1 if gap > 1 day
- Breaks (resets to 0) on failed puzzle
- Unchanged if already played today

### Order Mode System (New in Dec 2025)

```
convex/orderPuzzles/
├── queries.ts          ~100 lines   Order puzzle retrieval by date/number
├── mutations.ts        ~500 lines   Order play submission, scoring
└── generation.ts       ~180 lines   Daily Order puzzle generation

convex/orderPlays/
└── queries.ts           27 lines   Order play history
```

**Responsibilities**:

- **queries.ts**: Fetch Order puzzles by date or puzzle number
- **mutations.ts**: Submit ordering attempts, calculate scores, persist plays
- **generation.ts**: Generate daily Order puzzles from events

**Order Mode Game Rules**:

- Players arrange 5 historical events in chronological order
- Golf-style scoring: fewer attempts = better score
- Events selected from different years for clear ordering

### Observability System (New in Dec 2025)

```
convex/lib/observability/
├── metricsService.ts   ~350 lines   Metrics collection and aggregation
├── metricsCollector.ts ~140 lines   Metric ingestion pipeline
├── alertEngine.ts      ~280 lines   Threshold monitoring and alerting
├── emailNotifier.ts    ~220 lines   Email notification delivery
└── sentryNotifier.ts   ~120 lines   Sentry error reporting integration
```

**Responsibilities**:

- Real-time metrics for event generation pipeline
- Configurable alert thresholds (cost, failure rate, latency)
- Multi-channel notifications (email, Sentry)
- Dashboard data for monitoring LLM costs and quality

### Event Generation Pipeline (LLM-Powered)

```
convex/actions/eventGeneration/
├── orchestrator.ts     ~500 lines   Batch generation coordination
├── generator.ts        ~350 lines   LLM event generation (Gemini 3)
├── critic.ts           ~380 lines   Quality validation and scoring
├── reviser.ts          ~180 lines   Event improvement via LLM feedback
├── schemas.ts           ~60 lines   Zod schemas for structured outputs
└── values.ts            ~20 lines   Constants and configuration
```

**Responsibilities**:

- **orchestrator.ts**: Coordinate batch event generation with rate limiting
- **generator.ts**: Generate historical events via Gemini 3 / GPT-5
- **critic.ts**: Validate events for accuracy, uniqueness, quality
- **reviser.ts**: Improve rejected events based on critic feedback
- **schemas.ts**: Type-safe LLM response parsing

### System Utilities

```
convex/system/
└── scheduling.ts        53 lines   Cron schedule queries

convex/
├── health.ts            ~10 lines   Health check endpoint
├── crons.ts             ~50 lines   Scheduled task definitions
└── observability.ts    ~120 lines   Metrics wrapper for mutations
```

**Responsibilities**:

- Provide next midnight UTC for countdown timer
- Support puzzle generation scheduling
- Health endpoint for monitoring
- Observability wrapper for tracking mutation performance

## API Surface

### Frontend Usage Patterns

```typescript
// Barrel file re-exports maintain simple interface
import { api } from "@/convex/_generated/api";

// Puzzle operations
const puzzle = useQuery(api.puzzles.getDailyPuzzle);
const submitGuess = useMutation(api.puzzles.submitGuess);

// User operations
const user = useQuery(api.users.getCurrentUser);
const mergeStreak = useMutation(api.users.mergeAnonymousStreak);

// Play history
const completedPuzzles = useQuery(api.puzzles.getUserCompletedPuzzles);
```

**Module Routing** (via barrel files):

```
api.puzzles.getDailyPuzzle        → puzzles/queries.ts
api.puzzles.submitGuess           → puzzles/mutations.ts
api.puzzles.getUserCompletedPuzzles → plays/queries.ts
api.users.getCurrentUser          → users/queries.ts
api.users.mergeAnonymousStreak    → migration/anonymous.ts
```

### Internal Operations

```typescript
// Internal mutations called by actions (not exposed to frontend)
ctx.runMutation(internal.puzzles.updateHistoricalContext, { ... });
ctx.runMutation(internal.users.updateUserStats, { ... });
```

## Data Flow

### Daily Puzzle Generation

```
1. Cron job triggers (midnight UTC)
   └─> generateDailyPuzzle mutation

2. Select events for the day
   ├─> Deterministic date hash algorithm
   ├─> Fetch all events for selected year
   └─> Create puzzle record in database

3. Trigger AI context generation (async)
   └─> historicalContext action
       └─> OpenRouter GPT-5 API
           └─> updateHistoricalContext mutation (internal)
```

### Guess Submission Flow

```
1. User submits guess
   └─> submitGuess mutation (puzzles/mutations.ts)

2. Validate guess and puzzle state
   ├─> Check user authentication
   ├─> Verify puzzle exists and is playable
   └─> Validate year input

3. Create/update play record
   ├─> Check for existing play (prevents duplicates)
   ├─> Store guess in plays table
   └─> Mark completion if correct

4. Update user statistics (if daily puzzle)
   ├─> updateUserStats (users/statistics.ts)
   └─> updateUserStreak (streaks/mutations.ts)
       └─> ONLY for today's puzzle, NOT archive puzzles
```

### Anonymous User Sign-In

```
1. User signs in with Clerk
   └─> Frontend triggers merge mutations

2. Merge game progress
   └─> mergeAnonymousState (migration/anonymous.ts)
       ├─> Validate localStorage data
       ├─> Create play records for completed puzzles
       └─> Update user stats

3. Merge streaks
   └─> mergeAnonymousStreak (migration/anonymous.ts)
       ├─> Validate streak data (6 security rules)
       ├─> Calculate if streaks are consecutive
       ├─> Combine or choose better streak
       └─> Update user record
```

## Architecture Metrics

### Current State (Dec 2025)

```
Total backend code:     ~23,600 lines   (convex/ directory)
Module count:                30+        (focused modules)
Test coverage:            1,757 tests   (129 test files)
Game modes:                   2         (Classic + Order)
```

### Architecture Achievements

✅ **Deep modules**: Simple interfaces hiding complex LLM pipelines
✅ **Dual game modes**: Classic (year guessing) + Order (chronological sorting)
✅ **Full observability**: Metrics, alerts, cost tracking for LLM operations
✅ **LLM pipeline**: Generator → Critic → Reviser with structured outputs
✅ **Type safety**: Zod schemas for LLM responses, strict TypeScript throughout
✅ **1,757 tests passing**: Comprehensive coverage across all modules

### Key Module Groups

| Group            | Modules                      | Lines  | Responsibility                 |
| ---------------- | ---------------------------- | ------ | ------------------------------ |
| Classic Puzzles  | puzzles/, plays/             | ~700   | Daily year-guessing game       |
| Order Mode       | orderPuzzles/, orderPlays/   | ~800   | Chronological ordering game    |
| Users            | users/, migration/, streaks/ | ~900   | Auth, stats, anonymous merge   |
| Event Generation | actions/eventGeneration/     | ~1,500 | LLM-powered event creation     |
| Observability    | lib/observability/           | ~1,100 | Metrics, alerts, notifications |
| Core Lib         | lib/                         | ~2,000 | Shared utilities, clients      |

## Testing Strategy

### Automated Tests (1,757 tests across 129 files)

```
✅ Core game logic:        ~200 tests  (deriveGameState, scoring, validation)
✅ Order mode:             ~150 tests  (ordering, scoring, persistence)
✅ React hooks:            ~300 tests  (useChrondle, useOrderGame, etc.)
✅ Convex mutations:       ~250 tests  (puzzles, users, plays)
✅ Event generation:       ~100 tests  (LLM pipeline, critic, reviser)
✅ Observability:          ~150 tests  (metrics, alerts, notifications)
✅ Integration tests:      ~200 tests  (full user flows, E2E)
```

### Manual Smoke Tests (User Verification Required)

```
⏳ Classic mode: Daily puzzle loads and is playable
⏳ Classic mode: Range submission works and updates stats
⏳ Order mode: Daily puzzle loads with 5 events
⏳ Order mode: Drag-to-reorder and submit works
⏳ Archive page displays completed puzzles (both modes)
⏳ Streaks update correctly for daily puzzles
⏳ Anonymous play works (both modes)
⏳ Sign-in merges anonymous data
⏳ Webhook creates users
⏳ Historical context generates for new puzzles
⏳ LLM event generation produces valid events
```

## Database Schema

### Tables

```typescript
// puzzles table (Classic mode)
{
  _id: Id<"puzzles">,
  puzzleNumber: number,           // Sequential puzzle number (1, 2, 3...)
  year: number,                   // The correct answer year
  date: string,                   // ISO date (YYYY-MM-DD)
  eventIds: Id<"events">[],       // 6 events for this puzzle
  historicalContext?: string,     // AI-generated context (added after creation)
  createdAt: number,
}

// orderPuzzles table (Order mode)
{
  _id: Id<"orderPuzzles">,
  puzzleNumber: number,           // Sequential, mirrors Classic numbering
  date: string,                   // ISO date (YYYY-MM-DD)
  events: [{                      // 5 events to order chronologically
    id: string,
    year: number,
    text: string,
  }],
  seed: string,                   // Deterministic shuffle seed
  updatedAt: number,
}

// events table
{
  _id: Id<"events">,
  year: number,                   // Year this event occurred
  title: string,                  // Event description
  recognizability: number,        // 1-5 scale (5 = most recognizable)
  metadata?: {                    // Optional enrichment
    difficulty?: number,          // 1-5 difficulty rating
    categories?: string[],        // Semantic categories
  },
}

// users table
{
  _id: Id<"users">,
  clerkId: string,                // Clerk authentication ID
  email: string,
  username?: string,
  currentStreak: number,
  longestStreak: number,
  totalPlays: number,
  perfectGames: number,
  lastCompletedDate?: string,     // ISO date of last completed puzzle
  updatedAt: number,
}

// plays table (Classic mode)
{
  _id: Id<"plays">,
  userId: Id<"users">,
  puzzleId: Id<"puzzles">,
  guesses: number[],              // Years guessed (legacy)
  ranges: [{                      // Range submissions (current)
    start: number,
    end: number,
    score: number,
  }],
  completedAt?: number,
  updatedAt: number,
}

// orderPlays table (Order mode)
{
  _id: Id<"orderPlays">,
  userId: Id<"users">,
  puzzleId: Id<"orderPuzzles">,
  ordering: string[],             // Final ordering (event ids)
  attempts: [{                    // All attempts with feedback
    ordering: string[],
    feedback: string[],           // "correct" | "incorrect" per position
    pairsCorrect: number,
    totalPairs: number,
    timestamp: number,
  }],
  completedAt?: number,
  updatedAt: number,
}
```

### Indexes

```typescript
// users table
by_clerk: ["clerkId"]; // Fast lookup by Clerk authentication ID

// plays table (Classic)
by_user: ["userId"]; // All plays for a user
by_puzzle: ["puzzleId"]; // All plays for a puzzle
by_user_puzzle: ["userId", "puzzleId"]; // Unique constraint

// orderPuzzles table
by_number: ["puzzleNumber"]; // Lookup by puzzle number
by_date: ["date"]; // Lookup by date

// orderPlays table
by_user: ["userId"]; // All Order plays for a user
by_puzzle: ["puzzleId"]; // All Order plays for a puzzle
by_user_puzzle: ["userId", "puzzleId"]; // Unique constraint
```

## Deployment Considerations

### Environment Variables

```bash
# Convex deployment (required)
CONVEX_DEPLOYMENT=prod:fleet-goldfish-183  # Production deployment ID

# OpenRouter API (optional - for AI context generation)
OPENROUTER_API_KEY=sk-or-v1-...            # GPT-5 historical context
```

### Cron Jobs

```typescript
// Daily puzzle generation at midnight UTC
export default cronJobs;
cronJobs.interval("generate daily puzzle", { hours: 24 }, internal.puzzles.generateDailyPuzzle);
```

**Current Schedule**: Every 24 hours starting from deployment time
**Recommendation**: Use `cronJobs.daily()` to ensure consistent midnight UTC generation

### Data Requirements

```
✅ 1,821 historical events in events table (years -776 to 2008)
✅ 6 puzzle records in puzzles table (metadata only)
⚠️ Puzzles generated dynamically from events (NOT pre-stored)
```

## Common Operations

### Generate Puzzle for Specific Date (Debug)

```typescript
// Via Convex dashboard
npx convex run puzzles:generateDailyPuzzle --debugDate "2025-10-16"
```

### Query Puzzle Count

```typescript
// Via Convex dashboard
npx convex run puzzles:getTotalPuzzles
// Returns: { count: 6 }
```

### Verify Event Data

```typescript
// Via Convex dashboard
npx convex run events:getEventCount
// Returns: { count: 1821 }
```

## Future Improvements

### Potential Optimizations

1. **Event Pool Health**: Monitor per-era event coverage, backfill gaps
2. **LLM Cost Optimization**: Tune batch sizes, implement caching for similar prompts
3. **Puzzle Caching**: Cache today's puzzle in memory to reduce database reads
4. **Historical Context Prefetch**: Generate context before puzzle goes live

### Observability Already Implemented ✅

- Real-time metrics for event generation pipeline
- LLM cost tracking and alerting
- Failure rate monitoring with thresholds
- Email and Sentry notifications for alerts
- Generation log storage for debugging

## Contributing

### Adding New Modules

1. Create focused module in appropriate directory
2. Keep interface simple (1-6 exported functions)
3. Add comprehensive JSDoc comments
4. Write unit tests (target 100% coverage for new modules)
5. Update barrel file with re-export (if needed for backward compatibility)
6. Update this README.md with module documentation

### Modifying Existing Modules

1. Preserve single responsibility - don't add unrelated functionality
2. Maintain backward compatibility via barrel files
3. Add tests for new behavior
4. Update JSDoc comments
5. Run `pnpm type-check && pnpm test` before committing

## References

- **Convex Documentation**: https://docs.convex.dev
- **A Philosophy of Software Design** by John Ousterhout (Deep Modules principle)
- **Original Refactoring Plan**: See `TODO.md` Phases 2-5

---

**This architecture achieves the Deep Modules ideal: Simple, powerful interfaces hiding complex implementation details. Dual game modes (Classic + Order), LLM-powered event generation, and full observability all coexist with clean module boundaries.**
