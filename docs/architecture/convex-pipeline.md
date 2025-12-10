# Convex Event Generation Pipeline Documentation

## Table of Contents

1. [Scheduled Functions (Cron Jobs)](#scheduled-functions-cron-jobs)
2. [Actions vs Mutations](#actions-vs-mutations)
3. [Long-Running Operations](#long-running-operations)
4. [Error Handling & Retry Logic](#error-handling--retry-logic)
5. [Data Persistence & Transactions](#data-persistence--transactions)
6. [Current Implementation Analysis](#current-implementation-analysis)
7. [Best Practices for Scaling](#best-practices-for-scaling)

---

## Scheduled Functions (Cron Jobs)

### Overview

Convex provides a powerful scheduling system via `cronJobs()` from `convex/server`. Scheduled functions are durable and guaranteed to run even if your deployment changes.

### Basic Setup

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily at UTC midnight
crons.daily(
  "generate daily puzzle",
  { hourUTC: 0, minuteUTC: 0 },
  internal.puzzles.generateDailyPuzzle,
  {}, // args object
);

// Hourly schedule
crons.hourly(
  "cleanup old data",
  { minuteUTC: 15 }, // At :15 past each hour
  internal.cleanup.removeOldRecords,
  {},
);

// Custom cron expression (every 5 minutes)
crons.cron("frequent task", "*/5 * * * *", internal.tasks.processQueue, {});

export default crons;
```

### Schedule Types

```typescript
// Monthly (1st of month at 00:00 UTC)
crons.monthly(
  "monthly report",
  { day: 1, hourUTC: 0, minuteUTC: 0 },
  internal.reports.generate,
  {},
);

// Weekly (Monday at 09:00 UTC)
crons.weekly(
  "weekly sync",
  { weekday: "monday", hourUTC: 9, minuteUTC: 0 },
  internal.sync.runWeeklySync,
  {},
);

// Interval-based (every 10 seconds)
crons.interval("heartbeat", { seconds: 10 }, internal.monitoring.heartbeat, {});
```

### Dynamic Scheduling

For runtime-controlled scheduling, use `ctx.scheduler`:

```typescript
// In any mutation or action
export const scheduleCustomTask = mutation({
  args: { delay: v.number(), data: v.string() },
  handler: async (ctx, args) => {
    // Schedule to run after delay (in milliseconds)
    const jobId = await ctx.scheduler.runAfter(args.delay, internal.tasks.processData, {
      data: args.data,
    });

    // Can cancel scheduled tasks
    await ctx.scheduler.cancel(jobId);

    return { jobId };
  },
});
```

### Cron Expression Syntax

```
* * * * * *
│ │ │ │ │ │
│ │ │ │ │ └─ day of week (0-6, 0=Sunday)
│ │ │ │ └─── month (1-12)
│ │ │ └───── day of month (1-31)
│ │ └─────── hour (0-23)
│ └───────── minute (0-59)
└─────────── second (0-59, optional)

Examples:
"0 0 * * *"      - Daily at midnight
"*/15 * * * *"   - Every 15 minutes
"0 9-17 * * 1-5" - Weekdays 9am-5pm every hour
"0 0 1 * *"      - 1st of every month at midnight
```

---

## Actions vs Mutations

### Decision Matrix

| Use Case                         | Choose                |
| -------------------------------- | --------------------- |
| Database reads/writes            | **Mutation** or Query |
| External API calls (fetch, HTTP) | **Action**            |
| File uploads/downloads           | **Action**            |
| LLM API calls                    | **Action**            |
| Web scraping                     | **Action**            |
| Long computations (>1 second)    | **Action**            |
| Need ACID guarantees             | **Mutation**          |
| Need transactional consistency   | **Mutation**          |

### Key Differences

```typescript
// MUTATIONS: Transactional, deterministic, database access
export const createPuzzle = mutation({
  args: { date: v.string(), year: v.number() },
  handler: async (ctx, args) => {
    // ✅ Can read/write database
    const puzzleId = await ctx.db.insert("puzzles", {
      date: args.date,
      targetYear: args.year,
    });

    // ✅ Can schedule actions/mutations
    await ctx.scheduler.runAfter(0, internal.actions.generateContext, {
      puzzleId,
    });

    // ❌ CANNOT fetch() - not allowed in mutations
    // ❌ CANNOT use non-deterministic operations

    return { puzzleId };
  },
});

// ACTIONS: Non-deterministic, external APIs, no direct DB access
export const generateContext = internalAction({
  args: { puzzleId: v.id("puzzles") },
  handler: async (ctx, args) => {
    // ✅ Can fetch external APIs
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_KEY}` },
      body: JSON.stringify({
        /* ... */
      }),
    });

    const data = await response.json();

    // ✅ Can call mutations to write to database
    await ctx.runMutation(internal.puzzles.updateContext, {
      puzzleId: args.puzzleId,
      context: data.choices[0].message.content,
    });

    // ❌ CANNOT directly access ctx.db
    // Must use ctx.runMutation() or ctx.runQuery()
  },
});
```

### Performance Patterns

**❌ Anti-Pattern: Sequential mutation calls from actions**

```typescript
// BAD: Multiple separate transactions, slow and inconsistent
export const importData = action({
  handler: async (ctx) => {
    const items = await fetchExternalData();

    // ❌ Each insert is a separate transaction
    for (const item of items) {
      await ctx.runMutation(internal.data.insertItem, item);
    }
  },
});
```

**✅ Pattern: Batch operations in single mutation**

```typescript
// GOOD: Single transaction, consistent and fast
export const importData = action({
  handler: async (ctx) => {
    const items = await fetchExternalData();

    // ✅ Process all items in one transaction
    await ctx.runMutation(internal.data.insertManyItems, { items });
  },
});

export const insertManyItems = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    // All inserts happen in single transaction
    for (const item of args.items) {
      await ctx.db.insert("items", item);
    }
  },
});
```

### Calling Patterns

```typescript
// From mutations/queries: Use ctx.scheduler
export const triggerBackgroundWork = mutation({
  handler: async (ctx) => {
    // Must use scheduler to call actions
    await ctx.scheduler.runAfter(0, internal.actions.doWork, {});
  },
});

// From actions: Use ctx.run* directly
export const orchestrateWorkflow = action({
  handler: async (ctx) => {
    // Can call mutations directly
    const id = await ctx.runMutation(internal.data.create, {});

    // Can call other actions
    const result = await ctx.runAction(internal.external.fetchData, {});

    // Can call queries
    const data = await ctx.runQuery(internal.data.get, { id });
  },
});
```

---

## Long-Running Operations

### Timeout Limits

- **Mutations**: 60 seconds max execution time
- **Actions**: 10 minutes max execution time
- **HTTP Actions**: 5 minutes max execution time

### Pattern: Work Queue for Long Operations

For tasks that might take >10 minutes, use a queue pattern:

```typescript
// 1. Create a job record
export const startLongJob = mutation({
  args: { dataUrl: v.string() },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("jobs", {
      status: "pending",
      dataUrl: args.dataUrl,
      progress: 0,
    });

    // Schedule first batch
    await ctx.scheduler.runAfter(0, internal.jobs.processBatch, {
      jobId,
      offset: 0,
    });

    return { jobId };
  },
});

// 2. Process in batches
export const processBatch = internalAction({
  args: { jobId: v.id("jobs"), offset: v.number() },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.jobs.getJob, { id: args.jobId });

    if (job.status === "cancelled") return;

    // Fetch batch of data
    const batch = await fetchDataBatch(job.dataUrl, args.offset, 100);

    // Process batch in mutation (transactional)
    await ctx.runMutation(internal.jobs.processBatchData, {
      jobId: args.jobId,
      batch,
    });

    // Schedule next batch if more data exists
    if (batch.length === 100) {
      await ctx.scheduler.runAfter(0, internal.jobs.processBatch, {
        jobId: args.jobId,
        offset: args.offset + 100,
      });
    } else {
      // Mark job complete
      await ctx.runMutation(internal.jobs.markComplete, { jobId: args.jobId });
    }
  },
});

// 3. Track progress
export const processBatchData = internalMutation({
  args: { jobId: v.id("jobs"), batch: v.array(v.any()) },
  handler: async (ctx, args) => {
    // Process batch items
    for (const item of args.batch) {
      await ctx.db.insert("processed_items", item);
    }

    // Update progress
    const job = await ctx.db.get(args.jobId);
    await ctx.db.patch(args.jobId, {
      progress: job.progress + args.batch.length,
    });
  },
});
```

### Pattern: Timeout Detection

```typescript
export const startTask = mutation({
  handler: async (ctx) => {
    const taskId = await ctx.db.insert("tasks", {
      status: "running",
      startedAt: Date.now(),
    });

    // Schedule timeout check
    await ctx.scheduler.runAfter(
      30_000, // 30 seconds
      internal.tasks.checkTimeout,
      { taskId },
    );

    await ctx.scheduler.runAfter(0, internal.tasks.execute, { taskId });

    return { taskId };
  },
});

export const checkTimeout = internalMutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);

    if (task.status === "running") {
      await ctx.db.patch(args.taskId, {
        status: "timeout",
        error: "Task exceeded 30 second limit",
      });
    }
  },
});
```

---

## Error Handling & Retry Logic

### Exponential Backoff Pattern

Your existing implementation in `historicalContext.ts` demonstrates excellent retry logic:

```typescript
export const generateHistoricalContext = internalAction({
  handler: async (ctx, args) => {
    const maxAttempts = 3;
    let lastError: Error;

    // Helper: Calculate exponential backoff with jitter
    const calculateBackoffDelay = (attempt: number): number => {
      const baseDelay = 1000; // 1 second
      const exponentialDelay = baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 0.5 + 0.75; // ±25% jitter
      return Math.floor(exponentialDelay * jitter);
    };

    // Helper: Determine if error is retryable
    const shouldRetry = (error: Error): boolean => {
      const status = (error as any).status;

      // Don't retry client errors (4xx) except rate limits
      if (status >= 400 && status < 500 && status !== 429) {
        return false;
      }

      // Retry server errors (5xx) and network failures
      const message = error.message?.toLowerCase() || "";
      return (
        message.includes("network") ||
        message.includes("timeout") ||
        message.includes("fetch") ||
        status >= 500
      );
    };

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await fetch(/* ... */);
        return result; // Success!
      } catch (error) {
        lastError = error;

        // Don't retry on last attempt
        if (!shouldRetry(error) || attempt === maxAttempts - 1) {
          throw error;
        }

        // Wait before retry
        const delay = calculateBackoffDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  },
});
```

### Pattern: Graceful Degradation

```typescript
export const generatePuzzle = internalMutation({
  handler: async (ctx, args) => {
    const puzzleId = await ctx.db.insert("puzzles", {
      /* ... */
    });

    // Schedule non-critical work (graceful degradation)
    try {
      await ctx.scheduler.runAfter(0, internal.actions.generateContext, {
        puzzleId,
      });
      console.log("Scheduled context generation");
    } catch (schedulerError) {
      // Log but don't fail puzzle creation
      console.error("Failed to schedule context:", schedulerError);
      // Puzzle still works without context!
    }

    return { puzzleId };
  },
});
```

### Pattern: Fallback Chain

```typescript
export const generateWithFallback = internalAction({
  handler: async (ctx, args) => {
    const models = ["gpt-5", "gpt-5-mini", "gemini-2.5-flash"];

    for (const model of models) {
      try {
        const result = await callLLM(model, args.prompt);
        return result;
      } catch (error) {
        console.warn(`${model} failed, trying next...`);

        // Don't try fallback if we hit rate limit on last model
        if (model === models[models.length - 1]) {
          throw error;
        }
      }
    }
  },
});
```

### Error Types & Status Codes

```typescript
// Custom error types
class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableError";
  }
}

class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableError";
  }
}

// HTTP status code handling
const classifyError = (status: number): string => {
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server_error";
  if (status >= 400) return "client_error";
  return "unknown";
};

// Retry decision tree
const shouldRetryStatus = (status: number): boolean => {
  switch (classifyError(status)) {
    case "rate_limit":
      return true; // Always retry rate limits
    case "server_error":
      return true; // Retry 5xx errors
    case "client_error":
      return false; // Never retry 4xx (except 429)
    default:
      return false;
  }
};
```

### System Table for Job Monitoring

Convex provides `_scheduled_functions` system table for monitoring:

```typescript
export const checkJobStatus = query({
  args: { jobId: v.id("_scheduled_functions") },
  handler: async (ctx, args) => {
    const job = await ctx.db.system.get(args.jobId);

    if (!job) {
      return { status: "not_found" };
    }

    switch (job.state.kind) {
      case "pending":
        return { status: "pending", scheduledTime: job.scheduledTime };
      case "inProgress":
        return { status: "running" };
      case "success":
        return { status: "completed", completedAt: job.completedTime };
      case "failed":
        return {
          status: "failed",
          error: job.state.error,
          failedAt: job.completedTime,
        };
      case "canceled":
        return { status: "canceled" };
    }
  },
});
```

---

## Data Persistence & Transactions

### ACID Guarantees

Convex mutations provide full ACID guarantees:

- **Atomicity**: All or nothing - if mutation throws, no writes persist
- **Consistency**: Schema validation enforced
- **Isolation**: Optimistic Concurrency Control (OCC) prevents conflicts
- **Durability**: Writes are durable before mutation completes

### Transaction Pattern

```typescript
// All database operations in a mutation are transactional
export const transferFunds = mutation({
  args: { from: v.id("accounts"), to: v.id("accounts"), amount: v.number() },
  handler: async (ctx, args) => {
    const fromAccount = await ctx.db.get(args.from);
    const toAccount = await ctx.db.get(args.to);

    if (fromAccount.balance < args.amount) {
      throw new Error("Insufficient funds");
      // Implicit rollback - nothing persists
    }

    // Both patches happen atomically
    await ctx.db.patch(args.from, {
      balance: fromAccount.balance - args.amount,
    });

    await ctx.db.patch(args.to, {
      balance: toAccount.balance + args.amount,
    });

    // Both writes commit together or both roll back
  },
});
```

### Pattern: Multiple Table Writes

```typescript
export const createPuzzleWithEvents = mutation({
  handler: async (ctx, args) => {
    // 1. Insert puzzle
    const puzzleId = await ctx.db.insert("puzzles", {
      date: args.date,
      targetYear: args.year,
      events: args.events,
    });

    // 2. Update all referenced events (atomic with puzzle insert)
    for (const eventId of args.eventIds) {
      await ctx.db.patch(eventId, { puzzleId });
    }

    // 3. Create initial stats record
    await ctx.db.insert("stats", {
      puzzleId,
      playCount: 0,
      avgGuesses: 0,
    });

    // If any step fails, ENTIRE transaction rolls back
    return { puzzleId };
  },
});
```

### OCC Conflict Handling

Convex uses Optimistic Concurrency Control - mutations that read/write the same data may conflict:

```typescript
// Conflict Example
// Two users trying to increment a counter simultaneously

// ❌ CONFLICT PRONE: Reading then writing same document
export const incrementCounter = mutation({
  handler: async (ctx) => {
    const counter = await ctx.db.query("counters").first();

    // If two mutations read same counter, then both write,
    // one will conflict and retry
    await ctx.db.patch(counter._id, {
      count: counter.count + 1,
    });
  },
});

// ✅ CONFLICT AVOIDING: Use separate records per user
export const incrementUserCounter = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Each user has own counter - no conflicts!
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    await ctx.db.patch(counter._id, {
      count: counter.count + 1,
    });
  },
});
```

### Pattern: Deduplication

```typescript
export const createPuzzle = mutation({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    // Check for existing puzzle (idempotent)
    const existing = await ctx.db
      .query("puzzles")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();

    if (existing) {
      return { status: "exists", puzzleId: existing._id };
    }

    const puzzleId = await ctx.db.insert("puzzles", {
      date: args.date,
      // ... other fields
    });

    return { status: "created", puzzleId };
  },
});
```

### Batch Processing Pattern

```typescript
// Process large datasets without unbounded queries
export const processAllEvents = internalAction({
  handler: async (ctx) => {
    let cursor: string | null = null;
    let totalProcessed = 0;

    do {
      // Fetch batch (100 items)
      const result = await ctx.runMutation(internal.events.processBatch, {
        cursor,
      });

      cursor = result.nextCursor;
      totalProcessed += result.processed;

      console.log(`Processed ${totalProcessed} events so far...`);
    } while (cursor !== null);

    return { totalProcessed };
  },
});

export const processBatch = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Use pagination to avoid unbounded queries
    const page = await ctx.db
      .query("events")
      .withIndex("by_year")
      .paginate({ cursor: args.cursor, numItems: 100 });

    // Process this batch
    for (const event of page.page) {
      await ctx.db.patch(event._id, {
        processed: true,
      });
    }

    return {
      processed: page.page.length,
      nextCursor: page.isDone ? null : page.continueCursor,
    };
  },
});
```

---

## Current Implementation Analysis

### Your Chrondle Pipeline

**Current Architecture:**

1. **Cron Job** (`convex/crons.ts`):

   - Daily trigger at UTC midnight
   - Calls `internal.puzzles.generateDailyPuzzle`

2. **Puzzle Generation** (`convex/puzzles/generation.ts`):

   - Creates puzzle record (mutation)
   - Schedules context generation (non-blocking)
   - Updates event records with puzzleId

3. **Context Generation** (`convex/actions/historicalContext.ts`):
   - External API call to OpenRouter (action)
   - 3 retry attempts with exponential backoff
   - GPT-5 → GPT-5-mini fallback on rate limit
   - Updates puzzle with context via mutation

**Strengths:**

✅ Excellent separation of concerns (mutation → action → mutation)
✅ Graceful degradation (puzzle works without context)
✅ Robust retry logic with backoff and jitter
✅ Proper error sanitization (prevents API key leaks)
✅ Transactional puzzle + events update
✅ Idempotent cron job (checks for existing puzzle)

**Optimization Opportunities:**

1. **Rate Limit Handling**: Current implementation switches to GPT-5-mini on 429 - perfect!

2. **Error Recovery**: Consider logging failed context generations to a separate table for retry:

```typescript
// Add to schema
contextGenerationFailures: defineTable({
  puzzleId: v.id("puzzles"),
  attemptCount: v.number(),
  lastError: v.string(),
  nextRetryAt: v.number(),
}).index("by_retry_time", ["nextRetryAt"]),
  // Retry failed contexts hourly
  crons.hourly(
    "retry failed contexts",
    { minuteUTC: 30 },
    internal.actions.retryFailedContexts,
    {},
  );
```

3. **Progress Monitoring**: Add context generation status to puzzle:

```typescript
// In schema
puzzles: defineTable({
  // ... existing fields
  contextStatus: v.optional(v.union(
    v.literal("pending"),
    v.literal("generating"),
    v.literal("completed"),
    v.literal("failed")
  )),
}),
```

---

## Best Practices for Scaling

### 1. Avoid Unbounded Queries

```typescript
// ❌ BAD: Could load millions of records
const allEvents = await ctx.db.query("events").collect();

// ✅ GOOD: Use indexes with limits
const recentEvents = await ctx.db
  .query("events")
  .withIndex("by_creation_time")
  .order("desc")
  .take(100);

// ✅ GOOD: Use pagination for large datasets
const page = await ctx.db.query("events").paginate({ numItems: 50 });
```

### 2. Index Strategy

```typescript
// Your current indexes are excellent:
events: defineTable({
  // ...
})
  .index("by_year", ["year"])
  .index("by_puzzle", ["puzzleId"])
  .index("by_year_available", ["year", "puzzleId"]), // Compound index!

// Pattern: Query unused events efficiently
const unusedEvents = await ctx.db
  .query("events")
  .withIndex("by_year_available", q =>
    q.eq("year", targetYear).eq("puzzleId", undefined)
  )
  .collect();
```

### 3. Queue Pattern for High Throughput

```typescript
// Process events in batches to avoid conflicts
export const enqueueEvent = mutation({
  args: { event: v.string(), year: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.insert("event_queue", {
      event: args.event,
      year: args.year,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// Process queue in batches (FIFO)
export const processBatch = internalMutation({
  handler: async (ctx) => {
    // Only process old events (30 seconds ago)
    const cutoff = Date.now() - 30_000;

    const batch = await ctx.db
      .query("event_queue")
      .withIndex("by_status_time", (q) => q.eq("status", "pending").lt("createdAt", cutoff))
      .take(10);

    for (const item of batch) {
      await ctx.db.insert("events", {
        event: item.event,
        year: item.year,
      });

      await ctx.db.delete(item._id);
    }
  },
});

// Schedule frequent processing
crons.interval("process event queue", { minutes: 1 }, internal.queue.processBatch, {});
```

### 4. Hot/Cold Table Split

```typescript
// Split frequently-updated fields from rarely-updated ones
// Your current schema is already well-designed!

// ✅ GOOD: Puzzle metadata (cold) separate from stats (hot)
puzzles: defineTable({
  // Rarely changed
  targetYear: v.number(),
  events: v.array(v.string()),
  historicalContext: v.optional(v.string()),
}),

// Could add separate stats table for high-write scenarios
puzzleStats: defineTable({
  // Frequently updated
  puzzleId: v.id("puzzles"),
  playCount: v.number(),
  avgGuesses: v.number(),
}).index("by_puzzle", ["puzzleId"]),
```

### 5. Monitoring & Observability

```typescript
// Log important metrics
export const generateDailyPuzzle = internalMutation({
  handler: async (ctx) => {
    const startTime = Date.now();

    // ... puzzle generation logic

    const elapsed = Date.now() - startTime;
    console.log(`Puzzle generation took ${elapsed}ms`);

    // Could store metrics for analysis
    await ctx.db.insert("metrics", {
      operation: "puzzle_generation",
      duration: elapsed,
      timestamp: Date.now(),
    });
  },
});
```

### 6. Argument Validation (Security)

```typescript
// ✅ GOOD: Your functions use validators
export const generateHistoricalContext = internalAction({
  args: {
    puzzleId: v.id("puzzles"),
    year: v.number(),
    events: v.array(v.string()),
  },
  // ...
});

// Always validate for public functions
export const submitGuess = mutation({
  args: {
    puzzleId: v.id("puzzles"),
    guess: v.number(),
  },
  handler: async (ctx, args) => {
    // Validation happens automatically
    // Type-safe in TypeScript!
  },
});
```

### 7. Use Internal Functions

```typescript
// ✅ EXCELLENT: You're already doing this
export const generateDailyPuzzle = internalMutation({
  /* ... */
});
export const generateHistoricalContext = internalAction({
  /* ... */
});

// Only expose what clients need
export const getTodaysPuzzle = query({
  handler: async (ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    return await ctx.db
      .query("puzzles")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first();
  },
});
```

---

## Example: Event Scraping Pipeline

Here's a complete example for a potential event-scraping pipeline:

```typescript
// convex/scraping/pipeline.ts

// 1. Action: Fetch external data
export const scrapeWikipedia = internalAction({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const response = await fetch(`https://en.wikipedia.org/wiki/${args.year}`);
    const html = await response.text();

    // Parse events from HTML (simplified)
    const events = parseEventsFromHTML(html);

    // Store in mutation (transactional)
    await ctx.runMutation(internal.scraping.storeEvents, {
      year: args.year,
      events,
    });
  },
});

// 2. Mutation: Store scraped data
export const storeEvents = internalMutation({
  args: {
    year: v.number(),
    events: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for duplicates
    for (const event of args.events) {
      const existing = await ctx.db
        .query("events")
        .withIndex("by_year_event", (q) => q.eq("year", args.year).eq("event", event))
        .first();

      if (!existing) {
        await ctx.db.insert("events", {
          year: args.year,
          event,
          updatedAt: Date.now(),
        });
      }
    }
  },
});

// 3. Orchestrator: Process multiple years
export const scrapeMultipleYears = internalAction({
  args: { startYear: v.number(), endYear: v.number() },
  handler: async (ctx, args) => {
    for (let year = args.startYear; year <= args.endYear; year++) {
      try {
        await ctx.runAction(internal.scraping.scrapeWikipedia, { year });
        console.log(`Scraped ${year}`);

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to scrape ${year}:`, error);

        // Log failure for retry
        await ctx.runMutation(internal.scraping.logFailure, {
          year,
          error: String(error),
        });
      }
    }
  },
});

// 4. Cron: Schedule regular scraping
// convex/crons.ts
crons.weekly(
  "scrape new events",
  { weekday: "sunday", hourUTC: 2, minuteUTC: 0 },
  internal.scraping.scrapeMultipleYears,
  { startYear: 2020, endYear: 2024 },
);
```

---

## Resources

### Official Documentation

- [Scheduled Functions](https://docs.convex.dev/scheduling/scheduled-functions)
- [Cron Jobs](https://docs.convex.dev/scheduling/cron-jobs)
- [Actions](https://docs.convex.dev/functions/actions)
- [Mutations](https://docs.convex.dev/functions/mutation-functions)
- [Best Practices](https://docs.convex.dev/understanding/best-practices)
- [OCC & Transactions](https://docs.convex.dev/database/advanced/occ)

### Stack Articles

- [Automatically Retry Actions](https://stack.convex.dev/retry-actions)
- [Background Job Management](https://stack.convex.dev/background-job-management)
- [High Throughput Mutations](https://stack.convex.dev/high-throughput-mutations-via-precise-queries)
- [Durable Workflows](https://stack.convex.dev/durable-workflows-and-strong-guarantees)

### Components

- [Action Retrier Component](https://www.convex.dev/components/retrier)
- [Workflow Component](https://www.convex.dev/components/workflow)
- [Crons Component](https://www.convex.dev/components/crons)

---

## Summary

Your current implementation demonstrates excellent Convex practices:

1. ✅ **Proper separation**: Mutations for DB, actions for external APIs
2. ✅ **Graceful degradation**: Puzzle works without context
3. ✅ **Robust error handling**: Retry logic with backoff
4. ✅ **Security**: API key sanitization in errors
5. ✅ **Transactional integrity**: Atomic puzzle + events updates
6. ✅ **Idempotent operations**: Checks for existing puzzles

For scaling to event generation pipeline, consider:

- Queue-based processing for high throughput
- Separate failure tracking table for retry logic
- Status tracking on long-running operations
- Batch processing for large datasets
- Hot/cold table splits if stats updates become frequent

The patterns and examples above provide a solid foundation for building a reliable, scalable event generation system with Convex.
