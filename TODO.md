# TODO: Event & Puzzle Generation System Modernization

**Strategic Goal:** Migrate from GPT-4-era architecture to modern LLM capabilities (Gemini 3) for 99% cost reduction + quality improvements + 3x throughput while maintaining deep module architecture per Ousterhout principles.

**Timeline:** 6 weeks (120 hours)
**Current State:** 4,208 events, 674 years (24% coverage), $12K/year cost
**Target State:** 90% coverage (2,500 years), $600/year cost, real-time monitoring

---

## Phase 1: Foundation - Deep Module Abstractions (Weeks 1-2, 40 hours)

### 1.1 Create Gemini 3 Client Abstraction (Deep Module)

**Context:** Foundation for all cost savings. This module hides Gemini 3 complexity (thinking tokens, context caching, structured outputs) behind simple `generate<T>()` interface. Principle: Deep module = simple interface + powerful hidden implementation (Ousterhout Ch. 4).

- [x] **Define Gemini3ClientOptions interface** (`convex/lib/gemini3Client.ts`)

  - Fields: `thinking_level` ("low" | "medium" | "high"), `cache_system_prompt` (boolean), `structured_outputs` (boolean), `temperature`, `max_output_tokens`, `model` ("gemini-3-pro-preview" | "gemini-3-flash-preview")
  - Success criteria: Type-safe options matching OpenRouter Gemini 3 API parameters

- [x] **Define LLMGenerationResult<T> response interface**

  - Fields: `data: T` (parsed, validated output), `usage: TokenUsage` (input/output/reasoning tokens), `cost: CostBreakdown`, `metadata: GenerationMetadata` (model, latency, cache_hit)
  - Include reasoning token tracking (critical for cost analysis)
  - Success criteria: Unified response format across all LLM providers

- [x] **Implement Gemini3Client class with generate<T>() method**

  - Accept: `prompt: string`, `schema?: ZodSchema<T>`, `options?: Gemini3ClientOptions`
  - Hide complexity: OpenRouter API calls, thinking protocol setup, cache key management, error handling, retry logic
  - Return: `Promise<LLMGenerationResult<T>>`
  - Success criteria: Single method exposes all Gemini 3 capabilities without leaking implementation details

- [x] **Implement thinking token protocol integration**

  - Map `thinking_level` to OpenRouter's reasoning API parameters
  - Parse `reasoning_content` from response (separate from output tokens)
  - Track reasoning tokens in usage stats (critical: these are ~free)
  - Success criteria: Reasoning tokens correctly tracked and excluded from cost calculations

- [x] **Implement context caching mechanism**

  - Generate deterministic cache keys from system prompts: `chrondle:${stage}:${hash(systemPrompt)}`
  - Add cache control headers per OpenRouter caching API
  - Track cache hits/misses in metadata
  - Success criteria: Repeated system prompts only charge 10% of tokens on cache hits

- [x] **Implement structured outputs with schema validation**

  - Convert Zod schemas to JSON Schema for OpenRouter `response_format`
  - Enable `strict: true` mode for schema-constrained generation
  - Parse and validate response against schema (should never fail if API works correctly)
  - Success criteria: Zero JSON parsing errors, guaranteed type safety

- [x] **Add comprehensive usage tracking and cost calculation**

  - Parse token usage from OpenRouter response: `prompt_tokens`, `completion_tokens`, `reasoning_tokens`
  - Calculate cost using Gemini 3 pricing: input $2/1M, output $12/1M, reasoning ~$0/1M
  - Include cache savings in cost breakdown
  - Success criteria: Accurate per-request cost tracking within 0.01 cent precision

- [x] **Implement exponential backoff retry logic**

  - Retry on rate limits (429), server errors (5xx), network failures
  - Exponential backoff: 1s → 2s → 4s → 8s → 15s max
  - Add jitter to prevent thundering herd
  - Success criteria: Handles transient failures without user intervention

- [x] **Add fallback to GPT-5-mini on Gemini 3 failures**

  - If Gemini 3 fails after retries, automatically fallback to current GPT-5-mini client
  - Log fallback events with reason
  - Success criteria: Zero user-facing errors due to model failures, aggressive migration is safe

- [x] **Write comprehensive unit tests for Gemini3Client**
  - Test: Thinking token parsing and cost calculation
  - Test: Context caching key generation and cache hit detection
  - Test: Structured output schema validation (valid and invalid cases)
  - Test: Exponential backoff behavior with mocked failures
  - Test: Fallback mechanism triggers correctly
  - Success criteria: 90%+ coverage, all edge cases handled

### 1.2 Migrate Event Generation Pipeline to Gemini 3

**Context:** Aggressive migration strategy - all stages at once (Generator, Critic, Reviser) with GPT-5-mini fallback for safety. No A/B testing period per user directive.

- [x] **Update Generator stage to use Gemini3Client** (`convex/actions/eventGeneration/generator.ts`)

  - Replace `responsesClient` calls with `gemini3Client.generate<GeneratorOutput>()`
  - Set `thinking_level: "high"` (Generator needs creativity and reasoning)
  - Enable context caching for system prompts (2K tokens cached 24 hours)
  - Enable structured outputs with `GeneratorOutputSchema` (Zod schema)
  - Remove manual "think step by step" prompt engineering (model handles internally now)
  - Success criteria: Generator produces same/better quality events at 80% lower cost, thinking tokens tracked

- [x] **Update Critic stage to use Gemini3Client** (`convex/actions/eventGeneration/critic.ts`)

  - Replace `responsesClient` calls with `gemini3Client.generate<CriticOutput>()`
  - Set `thinking_level: "low"` (Critic just scores, doesn't need deep reasoning)
  - Use Gemini 3 Flash model (50% cheaper output tokens: $0.30 vs $0.60)
  - Enable structured outputs with `CriticOutputSchema`
  - Success criteria: Critic scoring accuracy maintained/improved, 50% cost reduction validated

- [x] **Update Reviser stage to use Gemini3Client** (`convex/actions/eventGeneration/reviser.ts`)

  - Replace `responsesClient` calls with `gemini3Client.generate<ReviserOutput>()`
  - Set `thinking_level: "medium"` (Reviser needs some reasoning for rewrites)
  - Enable context caching (rewrite prompts are repeated patterns)
  - Enable structured outputs with `ReviserOutputSchema`
  - Success criteria: Reviser quality maintained, cost reduced by 70%

- [x] **Update Orchestrator to track Gemini 3 usage metrics** (`convex/actions/eventGeneration/orchestrator.ts`)
  - Log reasoning tokens separately in generation_logs table
  - Track cache hit rates for context caching effectiveness
  - Monitor fallback frequency (should be <1%)
  - Success criteria: Full observability into Gemini 3 performance vs GPT-5-mini baseline

### 1.3 Extend Events Schema with Metadata for Future Game Modes

**Context:** Strategic investment - add metadata NOW during migration to avoid future schema changes. Enables Timeline/Category/Multiplayer modes without breaking changes. Zero-cost addition (Generator can populate immediately).

- [x] **Define EventMetadata type** (`convex/schema.ts`)

  - Fields: `difficulty: 1-5` (how hard to guess year), `category: string[]` (["war", "politics", "science"]), `era: "ancient" | "medieval" | "modern"`, `fame_level: 1-5` (how well-known event is), `tags: string[]` (flexible tagging)
  - Make all fields optional for backward compatibility with existing 4,208 events
  - Success criteria: Type-safe metadata structure supporting future game modes

- [x] **Update events table schema with metadata field** (`convex/schema.ts`)

  - Add `metadata: v.optional(v.object({...}))` to events table
  - Keep existing fields unchanged (year, event, puzzleId, updatedAt)
  - Success criteria: Schema migration doesn't break existing event queries

- [x] **Update Generator prompt to populate metadata** (`convex/actions/eventGeneration/generator.ts`)

  - Add metadata fields to `GeneratorOutputSchema` Zod schema
  - Extend prompt: "For each event, estimate difficulty (1-5), assign categories, determine era, rate fame_level (1-5), add relevant tags"
  - Success criteria: Generator populates metadata automatically, validated by structured outputs

- [x] **Update Critic to validate metadata quality** (`convex/actions/eventGeneration/critic.ts`)

  - Add metadata validation rules: difficulty/fame_level in range 1-5, categories from allowed list, era matches year range
  - Include metadata quality in scoring (flag missing or incorrect metadata)
  - Success criteria: Critic rejects events with invalid/missing metadata

- [x] **Write migration script to backfill metadata for existing events** (`scripts/backfill-event-metadata.ts`)
  - Query all events without metadata (4,208 events)
  - Batch process in groups of 50 to avoid rate limits
  - Use Gemini 3 Flash (cheap) to infer metadata from event text
  - Success criteria: All existing events have metadata within 2 hours runtime, <$5 cost

---

## Phase 2: Quality Enhancement & Coverage Expansion (Weeks 3-4, 40 hours)

### 2.1 Build Context-Aware Quality Validator (Deep Module)

**Context:** Current pattern-based validation misses semantic leakage ("Battle of Waterloo" → 1815). New validator uses embeddings to detect conceptual year hints, learns from rejected events. Principle: Hide validation complexity behind simple validateEvent() interface.

- [x] **Define QualityValidator interface** (`convex/lib/qualityValidator.ts`)

  - Method: `validateEvent(event: CandidateEvent, context: {year: number, era: Era}): Promise<ValidationResult>`
  - Return: `{passed: boolean, scores: QualityScores, reasoning: string, suggestions?: string[]}`
  - Success criteria: Simple interface hides embedding generation, knowledge base queries, ensemble scoring

- [x] **Define QualityScores interface**

  - Fields: `semantic_leakage: 0-1` (embedding similarity to known year phrases), `factual: 0-1` (historical accuracy), `ambiguity: 0-1` (could be adjacent years), `guessability: 0-1` (how much it helps players), `metadata_quality: 0-1` (metadata valid/complete)
  - Success criteria: Comprehensive quality dimensions, backward compatible with current Critic scores

- [x] **Implement SemanticLeakageDetector class**

  - Use Gemini 3 text-embedding-004 model to generate event embeddings (1,024 dimensions)
  - Load known leaky phrases database from JSON: `{phrase: string, yearRange: [number, number], embedding: number[]}`
  - Calculate cosine similarity between event embedding and all leaky phrase embeddings
  - Return max similarity as leakage score (0-1)
  - Success criteria: Detects "Battle of Waterloo" → 1815 association without explicit year mention

- [x] **Build initial leaky phrases database** (`convex/data/leakyPhrases.json`)

  - Seed with 100 well-known events: "First World War" → [1914,1918], "moon landing" → [1969,1969], "fall of Berlin Wall" → [1989,1989]
  - Generate embeddings for all phrases using Gemini 3 text-embedding-004
  - Store as JSON: `[{phrase, yearRange, embedding}]`
  - Success criteria: Database covers major 20th century events, <$0.10 cost to generate embeddings

- [x] **Implement feedback loop to learn from rejected events**

  - When Critic rejects event due to leakage, extract key phrase and add to leaky phrases database
  - Generate embedding for new phrase
  - Persist updated database (append-only, version controlled)
  - Success criteria: System self-improves, database grows to 200+ phrases within 6 months

- [x] **Integrate QualityValidator into Critic stage** (`convex/actions/eventGeneration/critic.ts`)

  - Call `qualityValidator.validateEvent()` after LLM-based Critic scoring
  - Combine LLM scores and validator scores: weighted average (70% LLM, 30% validator for now)
  - Log disagreements (LLM pass + validator fail, or vice versa) for analysis
  - Success criteria: Combined scoring reduces false positives by 30%, maintains recall

- [x] **Write comprehensive tests for semantic leakage detection**
  - Test: "Battle of Waterloo" correctly flagged as high leakage risk
  - Test: Generic event "A battle occurs" has low leakage risk
  - Test: Feedback loop correctly adds rejected events to database
  - Test: Embedding similarity calculations are deterministic
  - Success criteria: 95%+ precision on known leaky phrases, <5% false positives on generic events

### 2.2 Implement Batch Processing for 10x Throughput

**Context:** Current sequential processing (3 years/day) is bottleneck for coverage expansion. Parallel generation with rate limiting enables 10 years/day without overwhelming OpenRouter.

- [x] **Create RateLimiter utility class** (`convex/lib/rateLimiter.ts`)

  - Implement token bucket algorithm: 10 requests/second, burst capacity 20
  - Method: `execute<T>(fn: () => Promise<T>): Promise<T>` - wraps async function with rate limiting
  - Queue requests when rate limit exceeded, process in order
  - Success criteria: Never exceeds OpenRouter rate limits (60 req/min), smooth request distribution

- [x] **Add batch processing to Orchestrator** (`convex/actions/eventGeneration/orchestrator.ts`)

  - Replace sequential `for (const year of years)` loop with `Promise.all(years.map(...))`
  - Wrap each generation in `rateLimiter.execute()`
  - Set default batch size: 10 concurrent years (configurable)
  - Success criteria: Generates 10 years in parallel, respects rate limits, same total time as 1 year sequential

- [x] **Add comprehensive error handling for batch failures**

  - If one year fails, continue processing others (don't fail entire batch)
  - Collect all successes and failures
  - Log aggregate results: `{successCount, failureCount, failedYears, totalCost, totalDuration}`
  - Success criteria: Partial failures don't block other work, full observability into batch results

- [x] **Update cron job to generate 10 years/day** (`convex/crons.ts`)
  - Change `targetCount` parameter from 3 to 10 in `generateDailyBatch`
  - Monitor generation_logs for increased throughput validation
  - Success criteria: Cron successfully generates 10 years within 2 AM UTC window (1 hour timeout)

### 2.3 Implement Demand-Aware Coverage Orchestrator

**Context:** Replace simple work selector with sophisticated coverage planner that prioritizes high-demand eras (modern history for Classic mode, spread across eras for Order mode) while ensuring 90% coverage target.

- [x] **Define CoverageStrategy interface** (`convex/lib/coverageOrchestrator.ts`)

  - Fields: `targetYears: number[]` (years to generate), `priority: "missing" | "low_quality" | "strategic"`, `eraBalance: {ancient: number, medieval: number, modern: number}`, `estimatedCost: number`
  - Success criteria: Type-safe coverage planning with clear prioritization

- [x] **Implement gap analysis function** (`analyzeCoverageGaps`)

  - Query all years in range [-776, 2008] and count events per year
  - Categorize: missing (0 events), insufficient (<6 events), low_quality (>40% events flagged by Critic)
  - Calculate coverage percentage by era: ancient (≤500), medieval (501-1499), modern (≥1500)
  - Return: `{missingYears: number[], insufficientYears: number[], lowQualityYears: number[], coverageByEra: {...}}`
  - Success criteria: Accurately identifies 1,826 year gap, shows 24% coverage baseline

- [x] **Implement demand analysis function** (`analyzePuzzleDemand`)

  - Query puzzles table, count usage by year: `SELECT targetYear, COUNT(*) FROM puzzles GROUP BY targetYear`
  - Identify high-demand eras (years frequently selected for puzzles)
  - Return: `{highDemandYears: number[], demandByEra: {...}, selectionFrequency: Map<number, number>}`
  - Success criteria: Reveals modern years (1900-2000) have highest puzzle demand

- [x] **Implement demand-aware work selection function** (`selectWork`)

  - Accept: `count: number` (how many years to select)
  - Allocate: 80% to high-demand missing/insufficient years, 20% to strategic coverage (ensure all eras represented)
  - Balance eras: Try to select at least 1 from each era (ancient/medieval/modern)
  - Return: `CoverageStrategy` with selected years and rationale
  - Success criteria: Prioritizes filling modern year gaps first, maintains era diversity

- [x] **Replace workSelector with coverageOrchestrator in Orchestrator**

  - Update `generateDailyBatch` to call `coverageOrchestrator.selectWork(10)`
  - Log strategy used: which years selected, why, expected cost
  - Success criteria: Daily generation focuses on high-value years, 90% coverage achieved in 6 months

- [x] **Add enhanced prompts for sparse years** (`buildEnhancedPrompt` function)
  - For ancient years (1-2 digit): Add historical context primer (dynasties, rulers, major figures)
  - For BC years: Enforce figure-centric approach ("Caesar [action]" vs "Rome experiences [event]")
  - For obscure modern years: Provide decade context and major global events nearby
  - Success criteria: Sparse years have higher generation success rate (50% → 80%), better event quality

---

## Phase 3: Real-Time Observability & Monitoring (Weeks 5-6, 40 hours)

### 3.1 Build Metrics Collection System

**Context:** Current passive logging (generation_logs table) requires manual queries. New system provides real-time aggregation, windowing, and query interface for dashboards/alerts.

- [x] **Define unified Metrics interface** (`convex/lib/observability/metricsCollector.ts`)

  - Pool health: `{unusedEvents: number, daysUntilDepletion: number, coverageByEra: {...}, yearsReady: number}`
  - Cost tracking: `{costToday: number, cost7DayAvg: number, cost30Day: number, costPerEvent: number}`
  - Quality metrics: `{avgQualityScore: number, failureRate: number, topFailureReasons: string[], qualityTrend: number[]}`
  - Generation latency: `{p50: number, p95: number, p99: number, avgDuration: number}`
  - Success criteria: Comprehensive observability covering all critical dimensions

- [x] **Implement MetricsCollector class**

  - Method: `recordGeneration(result: GenerationResult): Promise<void>` - inserts into generation_logs, updates aggregates
  - Method: `recordPuzzleCreation(puzzle: Puzzle): Promise<void>` - tracks puzzle generation success
  - Method: `getMetrics(timeRange: TimeRange): Promise<Metrics>` - queries aggregated metrics
  - Hide complexity: Time-series windowing (1h, 24h, 7d, 30d), percentile calculation, trend analysis
  - Success criteria: Simple interface hides aggregation complexity, queries complete in <500ms

- [x] **Implement time-series aggregation with windowing**

  - Create helper function: `aggregateByWindow(events: Event[], windowSize: Duration): Aggregate[]`
  - Support windows: 1 hour (real-time), 1 day (daily trends), 7 days (weekly trends), 30 days (monthly trends)
  - Compute: sum, avg, min, max, count per window
  - Success criteria: Accurate aggregation for dashboard charts, handles 10K+ events efficiently
  - Note: Implemented via `calculateStartTime()` and windowed queries in `metricsService.ts`

- [x] **Implement percentile calculation for latency metrics**

  - Create helper function: `calculatePercentiles(values: number[], percentiles: number[]): Map<number, number>`
  - Use quickselect algorithm for p50, p95, p99 (O(n) average case)
  - Success criteria: Accurate percentiles within 1% error, handles 1K+ samples efficiently
  - Note: Implemented as `calculatePercentile()` in `metricsService.ts` with comprehensive tests

- [x] **Add pool health queries** (`convex/lib/observability/poolHealth.ts`)

  - Query: Count unused events (puzzleId = undefined)
  - Calculate: Days until depletion = unusedEvents / 6 (daily puzzle consumption)
  - Breakdown by era: Count events per era, identify gaps
  - Success criteria: Real-time pool health metrics, no manual queries needed
  - Note: Implemented as `calculatePoolHealth()` in `metricsService.ts`

- [x] **Integrate MetricsCollector into Orchestrator**
  - Call `metricsCollector.recordGeneration()` after each year generation (success or failure)
  - Track: year, status, cost, duration, quality scores, token usage (including reasoning tokens)
  - Success criteria: All generation attempts tracked, zero data loss
  - Note: Integration complete via generationLogs.logGenerationAttempt + observability query wrappers

### 3.2 Build Alert Engine with Multi-Channel Notifications

**Context:** Proactive issue detection to prevent silent failures (pool depletion, cost spikes, quality degradation). Sentry for error tracking, email for notifications.

- [x] **Define AlertRule interface** (`convex/lib/observability/alertEngine.ts`)

  - Fields: `name: string`, `condition: (metrics: Metrics) => boolean`, `severity: "critical" | "warning" | "info"`, `channels: AlertChannel[]`, `cooldown: number` (milliseconds between alerts)
  - Success criteria: Declarative rule definition, easy to add new alerts

- [x] **Implement standard alert rules array**

  - Rule: "Pool Depletion Imminent" - fires when `daysUntilDepletion < 30`, severity critical, cooldown 24h
  - Rule: "Cost Spike Detected" - fires when `costToday > cost7DayAvg * 2`, severity warning, cooldown 6h
  - Rule: "Quality Degradation" - fires when `avgQualityScore < 0.7`, severity warning, cooldown 12h
  - Rule: "Generation Failure Spike" - fires when `failureRate > 0.5`, severity critical, cooldown 1h
  - Success criteria: Comprehensive coverage of critical failure modes, conservative thresholds to avoid alert fatigue
  - Note: Implemented in STANDARD_ALERT_RULES with 22 tests

- [x] **Implement AlertEngine class**

  - Method: `checkAlerts(metrics: Metrics): Promise<void>` - evaluates all rules, fires alerts if triggered
  - Track: Last alert time per rule (for cooldown enforcement)
  - Hide complexity: Cooldown state management, channel routing by severity
  - Success criteria: Alerts fire within 1 hour of threshold breach, respect cooldown periods
  - Note: Implemented with 13 comprehensive tests for checkAlerts, cooldown management, channel routing, and message generation

- [x] **Implement Sentry integration** (`convex/lib/observability/sentryNotifier.ts`)

  - Capture alerts as Sentry events with appropriate severity levels
  - Include: Alert name, severity, metric values, timestamp in event context
  - Use Sentry tags for filtering: alert_name, severity, metric_type
  - Success criteria: Sentry events captured within 30 seconds, proper severity mapping
  - Note: Implemented with 12 tests covering initialization, severity mapping, tagging, graceful degradation

- [x] **Implement email integration** (`convex/lib/observability/emailNotifier.ts`)

  - Use Resend for transactional email (configured via RESEND_API_KEY env var)
  - Send to: Configured admin email addresses (comma-separated EMAIL_RECIPIENTS env var)
  - Format: HTML email with alert details, metric values, timestamp
  - Success criteria: Email delivered within 2 minutes, actionable information provided
  - Note: Implemented with 18 tests covering HTML generation, recipient parsing, error handling, graceful degradation

- [x] **Add alert checking to Orchestrator post-batch hook**
  - After daily batch completes, fetch current metrics: `metricsCollector.getMetrics("24h")`
  - Call: `alertEngine.checkAlerts(metrics)`
  - Log: Alert check results (which rules evaluated, which fired)
  - Success criteria: Alerts checked after every batch, zero missed checks
  - Note: Replaced old console.warn alerts with AlertEngine integration, connects metrics → rules → notifiers (Sentry + email)

### 3.3 Build Admin Dashboard UI

**Context:** Web-based dashboard for non-technical stakeholders to monitor pool health, cost trends, quality metrics without querying database directly.

- [x] **Create admin dashboard route** (`src/app/admin/dashboard/page.tsx`)

  - Add Clerk auth check: Only allow users with admin role
  - Layout: 4-panel grid (Pool Health, Cost Trends, Quality Metrics, Recent Generations)
  - Use Convex queries: `useQuery(api.generationLogs.getEventPoolHealth)`, etc.
  - Success criteria: Dashboard loads in <2 seconds, auto-refreshes every 30 seconds
  - Note: Uses Convex subscriptions for auto-refresh, Clerk publicMetadata for role check

- [x] **Build PoolHealthCard component** (`src/components/admin/PoolHealthCard.tsx`)

  - Display: Unused events count (large number), days until depletion (with color coding: green >90, yellow 30-90, red <30)
  - Breakdown: Coverage by era (ancient/medieval/modern) as progress bars
  - Chart: Year coverage over time (line chart, last 30 days)
  - Success criteria: At-a-glance pool health status, clear visual indicators
  - Note: Uses getPoolHealthQuery, color-coded depletion warnings implemented

- [x] **Build CostTrendsChart component** (`src/components/admin/CostTrendsChart.tsx`)

  - Display: Daily cost for last 7 days (bar chart)
  - Show: 7-day average as horizontal line for comparison
  - Breakdown: Cost by stage (Generator, Critic, Reviser) as stacked bars
  - Include: Cost per event metric (calculated field)
  - Success criteria: Easy to spot cost spikes, understand cost breakdown by stage
  - Note: Uses getCostMetricsQuery + getLast7DaysCosts, simple bar chart implementation

- [x] **Build QualityMetricsGrid component** (`src/components/admin/QualityMetricsGrid.tsx`)

  - Display: Average quality score (large number with trend arrow)
  - Breakdown: Individual score dimensions (factual, leakage, ambiguity, guessability, metadata) as gauge charts
  - Show: Failure rate percentage with 30-day trend
  - List: Top 5 failure reasons with counts
  - Success criteria: Comprehensive quality overview, identify improvement opportunities
  - Note: Uses getQualityMetricsQuery, trend visualization via bar chart

- [x] **Build RecentGenerationsTable component** (`src/components/admin/RecentGenerationsTable.tsx`)

  - Display: Last 20 generation attempts (year, status, events generated, cost, duration, timestamp)
  - Features: Sortable columns, filterable by status (success/failed/skipped)
  - Drill-down: Click row to see detailed error message, generated events, quality scores
  - Success criteria: Easy to debug recent failures, understand generation patterns
  - Note: Uses new getRecentGenerationsQuery added to convex/observability.ts

- [x] **Add navigation to admin dashboard**
  - Update main nav: Add "Admin" link (visible only to admin users)
  - Update route protection: Middleware checks admin role
  - Success criteria: Admin dashboard accessible to authorized users only, seamless navigation
  - Note: AdminButton component with Clerk useUser hook, conditionally renders Settings icon

---

## Phase 4: Admin Command Center & Per-Mode Event Tracking

**Strategic Goal:** Transform admin dashboard from observability-only view into full command center for content management. Fix fundamental data model flaw where event usage only tracks Classic mode - Order mode events are invisible to pool health metrics.

**Principles:**

- Ousterhout: Each tab is a deep module with simple interface hiding query/mutation complexity
- Carmack: Direct implementation. Two explicit fields (`classicPuzzleId`, `orderPuzzleId`) instead of clever nested structures
- Torvalds: The code is the truth. Fix the schema first, UI follows naturally

**Current State:** Dashboard shows 3563 "unused" events but this only counts Classic. Order mode samples from entire 4217-event pool without tracking. Admin has no way to browse/edit events or view puzzles.

**Target State:** Per-mode usage tracking, Events Browser with search/filter/edit, Puzzles Manager for both modes, pool health metrics per mode.

---

### 4.1 Schema Migration - Per-Mode Event Usage Tracking

**Context:** Current `events.puzzleId` only links to Classic `puzzles` table. Order mode reads all events without marking them used. This creates incorrect pool health metrics and prevents per-mode filtering.

- [x] **Add `classicPuzzleId` field to events schema** (`convex/schema.ts`)

  - Add field: `classicPuzzleId: v.optional(v.id("puzzles"))` after existing `puzzleId` field
  - Add index: `.index("by_classic_puzzle", ["classicPuzzleId"])` for efficient puzzle-to-event lookup
  - Add compound index: `.index("by_year_classic_available", ["year", "classicPuzzleId"])` for unused event queries by year
  - Keep existing `puzzleId` field temporarily for backward compatibility during migration
  - Success criteria: Schema validates, `npx convex dev` succeeds, existing queries still work

- [x] **Add `orderPuzzleId` field to events schema** (`convex/schema.ts`)

  - Add field: `orderPuzzleId: v.optional(v.id("orderPuzzles"))` after `classicPuzzleId`
  - Add index: `.index("by_order_puzzle", ["orderPuzzleId"])` for Order puzzle-to-event lookup
  - Add compound index: `.index("by_year_order_available", ["year", "orderPuzzleId"])` for Order mode pool queries
  - Success criteria: Events can be independently tracked for both game modes

- [x] **Write backfill migration to copy `puzzleId` → `classicPuzzleId`** (`convex/migrations/migrateEventUsageTracking.ts`)

  - Create internal mutation `backfillClassicPuzzleId` that queries events with `puzzleId !== undefined`
  - Batch process 100 events per mutation call to avoid timeout (654 events to migrate based on prod data)
  - For each event: `ctx.db.patch(event._id, { classicPuzzleId: event.puzzleId })`
  - Add progress logging: "Migrated X/Y events"
  - Success criteria: All 654 used events have `classicPuzzleId` set, verify with `SELECT COUNT(*) WHERE classicPuzzleId IS NOT NULL`

- [x] **Run migration against production Convex** (`fleet-goldfish-183`)

  - Execute: `npx convex run migrations/migrateEventUsageTracking:backfillClassicPuzzleId --prod`
  - Verify: Query events where `classicPuzzleId !== undefined` returns 654 (same as `puzzleId !== undefined`)
  - Verify: No events have `classicPuzzleId !== puzzleId` (data integrity check)
  - Success criteria: Zero data loss, production unaffected, rollback plan ready if issues

---

### 4.2 Update Generation Flows to Use New Fields

**Context:** After schema migration, update both Classic and Order generation to use the new per-mode fields. Classic switches from `puzzleId` to `classicPuzzleId`. Order starts tracking usage (currently doesn't mark events at all).

- [x] **Update Classic puzzle generation to use `classicPuzzleId`** (`convex/puzzles/generation.ts:72-77`)

  - Change: `await ctx.db.patch(event._id, { puzzleId, updatedAt: Date.now() })`
  - To: `await ctx.db.patch(event._id, { classicPuzzleId: puzzleId, updatedAt: Date.now() })`
  - Also update `ensureTodaysPuzzle` mutation (lines 159-163) with same change
  - Success criteria: New Classic puzzles set `classicPuzzleId` instead of `puzzleId`

- [x] **Update `selectYearForPuzzle` to query `classicPuzzleId`** (`convex/lib/puzzleHelpers.ts`)

  - Find query: `ctx.db.query("events").withIndex("by_year_available", ...)`
  - Update to use new index: `.withIndex("by_year_classic_available", (q) => q.eq("year", year).eq("classicPuzzleId", undefined))`
  - Update filter logic: `event.classicPuzzleId === undefined` instead of `event.puzzleId === undefined`
  - Success criteria: Classic mode only selects events unused in Classic (can still be used in Order)

- [x] **Add Order puzzle event tracking to generation** (`convex/orderPuzzles/mutations.ts:199-205`)

  - After line 205 (`const puzzleId = await ctx.db.insert("orderPuzzles", ...)`), add event marking loop:

  ```typescript
  // Mark selected events as used in Order mode
  for (const event of selection) {
    await ctx.db.patch(event._id as Id<"events">, {
      orderPuzzleId: puzzleId,
      updatedAt: Date.now(),
    });
  }
  ```

  - Success criteria: New Order puzzles mark their events with `orderPuzzleId`

- [x] **Update Order event selection to filter already-used events** (`convex/orderPuzzles/mutations.ts:240-246`)

  - Change `loadEventCandidates` to filter out events already used in Order mode:

  ```typescript
  async function loadEventCandidates(ctx: MutationCtx): Promise<OrderEventCandidate[]> {
    const events = await ctx.db.query("events").collect();
    return events
      .filter((event) => event.orderPuzzleId === undefined) // Only unused in Order
      .map((event) => ({
        _id: event._id,
        year: event.year,
        event: event.event,
      }));
  }
  ```

  - Success criteria: Order mode has independent pool depletion from Classic

- [x] **Write integration test for dual-mode event usage** (`convex/__tests__/dualModeEventUsage.test.ts`)

  - Test: Generate Classic puzzle for year 1969, verify events have `classicPuzzleId` set
  - Test: Generate Order puzzle, verify events have `orderPuzzleId` set
  - Test: Same event can have both `classicPuzzleId` AND `orderPuzzleId` set (used in both modes)
  - Test: Pool health query returns correct counts per mode
  - Success criteria: Both modes track independently, events reusable across modes

---

### 4.3 Admin Dashboard Architecture - Tab Navigation

**Context:** Transform single-page dashboard into tabbed interface. Each tab is a deep module - simple interface (tab click) hides complex data fetching and UI rendering.

- [x] **Create AdminTabs component with URL-based routing** (`src/app/admin/dashboard/components/AdminTabs.tsx`)

  - Use `useSearchParams` for tab state: `?tab=overview|events|puzzles`
  - Tab buttons: Overview (default), Events, Puzzles
  - Each tab renders its own component lazily (code splitting)
  - Style: Underline active tab, hover states, keyboard navigation
  - Success criteria: Tab switches update URL, browser back works, deep linking works

- [x] **Extract current dashboard content to OverviewTab** (`src/app/admin/dashboard/components/OverviewTab.tsx`)

  - Move: PoolHealthCard, CostTrendsChart, QualityMetricsGrid, RecentGenerationsTable
  - Keep existing Convex query hooks
  - Add mode filter prop for future per-mode filtering
  - Success criteria: Overview tab renders identical to current dashboard

- [x] **Update dashboard page to render tab router** (`src/app/admin/dashboard/page.tsx`)

  - Keep server component auth check (Clerk admin role)
  - Render AdminTabs client component after auth
  - Pass any server-fetched data as props
  - Success criteria: Dashboard loads with tabs, auth still enforced

- [x] **Create shared ModeFilter component** (`src/app/admin/dashboard/components/shared/ModeFilter.tsx`)

  - Toggle between: "All", "Classic", "Order"
  - Use URL search param: `?mode=all|classic|order`
  - Emit selected mode via callback or URL update
  - Style: Segmented control or radio group
  - Success criteria: Filter persists across tab navigation, affects all queries

---

### 4.4 Events Browser Tab

**Context:** Admin needs to browse, search, filter, and edit the 4217-event pool. Must support filtering by year, era, text search, and usage status per mode.

- [x] **Create admin events query with search and filters** (`convex/admin/events.ts`)

  - Export `searchEvents` query with args:
    - `search: v.optional(v.string())` - fuzzy text search on event text
    - `yearMin: v.optional(v.number())`, `yearMax: v.optional(v.number())` - year range filter
    - `era: v.optional(v.union(v.literal("ancient"), v.literal("medieval"), v.literal("modern")))`
    - `usageFilter: v.optional(v.union(v.literal("unused_classic"), v.literal("unused_order"), v.literal("unused_both"), v.literal("used_classic"), v.literal("used_order"))))`
    - `limit: v.optional(v.number())` - pagination (default 50)
    - `cursor: v.optional(v.string())` - cursor-based pagination
  - Return: `{ events: Event[], nextCursor: string | null, totalCount: number }`
  - Filter logic:
    - `unused_classic`: `classicPuzzleId === undefined`
    - `unused_order`: `orderPuzzleId === undefined`
    - `unused_both`: `classicPuzzleId === undefined AND orderPuzzleId === undefined`
    - `used_classic`: `classicPuzzleId !== undefined`
    - `used_order`: `orderPuzzleId !== undefined`
  - Text search: Case-insensitive substring match on event text (use `.filter()` after index query)
  - Success criteria: Query returns <500ms for any filter combination
  - Note: Also added `getEventStats` query for statistics header

- [x] **Create admin event mutation for text updates** (`convex/admin/events.ts`)

  - Export `updateEventText` mutation with args:
    - `eventId: v.id("events")`
    - `text: v.string()`
  - Validate: Text not empty, text not identical to current
  - Update: `ctx.db.patch(eventId, { event: text, updatedAt: Date.now() })`
  - Success criteria: Admin can fix typos, improve clarity without affecting puzzle associations

- [x] **Create admin event mutation for deletion** (`convex/admin/events.ts`)

  - Export `deleteEvent` mutation with args: `eventId: v.id("events")`
  - Validate: Event not currently used in any puzzle (`classicPuzzleId === undefined AND orderPuzzleId === undefined`)
  - If used, throw: `ConvexError("Cannot delete event used in puzzle. Remove from puzzle first.")`
  - Delete: `ctx.db.delete(eventId)`
  - Success criteria: Only unused events deletable, clear error for used events

- [x] **Build EventsTab component with search and filters** (`src/app/admin/dashboard/components/EventsTab.tsx`)

  - Search input: Debounced (300ms) text input for event text search
  - Filter row: Year range inputs, Era dropdown, Usage status dropdown
  - Results: DataTable with columns (Year, Event Text, Era, Classic Status, Order Status, Actions)
  - Pagination: "Load more" button or infinite scroll using cursor
  - Empty state: "No events match filters"
  - Success criteria: Admin can find any event in <3 clicks

- [x] **Build inline event editing in EventsTab**

  - Click event text → Inline textarea appears
  - Save button + Cancel button
  - Optimistic UI: Show new text immediately, revert on error
  - Success feedback: Brief checkmark animation
  - Success criteria: Edit flow is <5 seconds for typo fix

- [x] **Build event deletion with confirmation in EventsTab**

  - Delete button (trash icon) in Actions column
  - Click → Confirmation dialog: "Delete this event? This cannot be undone."
  - If event is used: Button disabled with tooltip "Event used in puzzle #X"
  - Success criteria: No accidental deletions, clear feedback on why deletion blocked

- [x] **Add event statistics summary to EventsTab header**

  - Display: Total events (4217), Unused in Classic (3563), Unused in Order (TBD), Unused in Both
  - Calculate from query or separate stats query
  - Success criteria: At-a-glance pool health visible while browsing

---

### 4.5 Puzzles Manager Tab

**Context:** Admin needs to view puzzle history for both Classic and Order modes, see player engagement, and drill into puzzle details.

- [ ] **Create admin puzzles query for listing** (`convex/admin/puzzles.ts`)

  - Export `listPuzzles` query with args:
    - `mode: v.union(v.literal("classic"), v.literal("order"))`
    - `limit: v.optional(v.number())` - default 20
    - `cursor: v.optional(v.string())` - cursor-based pagination
  - Query appropriate table based on mode: `puzzles` or `orderPuzzles`
  - Return: `{ puzzles: Puzzle[], nextCursor: string | null }`
  - Include: puzzleNumber, date, targetYear (Classic only), playCount, avgGuesses/avgScore
  - Order: Descending by puzzleNumber (newest first)
  - Success criteria: Unified interface for both puzzle types

- [ ] **Create admin puzzle detail query** (`convex/admin/puzzles.ts`)

  - Export `getPuzzleDetail` query with args:
    - `mode: v.union(v.literal("classic"), v.literal("order"))`
    - `puzzleNumber: v.number()`
  - Return full puzzle data plus:
    - All events (for Classic: denormalized strings, for Order: objects with year)
    - Play count and completion stats
    - Historical context (Classic only, if generated)
  - Success criteria: All puzzle info available in single query

- [ ] **Build PuzzlesTab component with mode toggle** (`src/app/admin/dashboard/components/PuzzlesTab.tsx`)

  - Mode toggle: "Classic" / "Order" (uses ModeFilter component)
  - Results: DataTable with columns varying by mode
    - Classic: #, Date, Target Year, Plays, Avg Guesses, Status
    - Order: #, Date, Event Span, Plays, Avg Score, Status
  - Status: "Active" (today), "Completed" (past), "Future" (if pre-generated)
  - Row click → Opens detail modal
  - Success criteria: Admin can browse puzzle history for either mode

- [ ] **Build PuzzleDetailModal component** (`src/app/admin/dashboard/components/PuzzleDetailModal.tsx`)

  - Modal triggered by row click in PuzzlesTab
  - Header: Puzzle #{number} - {date}
  - Content varies by mode:
    - Classic: Target year, 6 events list, historical context preview, player stats
    - Order: Events with years (in correct order), event span, player stats
  - Player stats: Total plays, completion rate, average score/guesses
  - Close button + click outside to dismiss
  - Success criteria: Full puzzle context visible without leaving dashboard

- [ ] **Add "Today's Puzzles" card to OverviewTab** (`src/app/admin/dashboard/components/OverviewTab.tsx`)

  - New card showing today's Classic and Order puzzles side by side
  - Each shows: Puzzle #, target year/event span, play count so far
  - Click → Opens PuzzleDetailModal for that puzzle
  - Success criteria: Daily ops visibility - is today's content live and correct?

---

### 4.6 Enhanced Overview Tab with Per-Mode Metrics

**Context:** After schema migration, pool health and other metrics should support per-mode filtering.

- [ ] **Update pool health query to support mode filter** (`convex/lib/observability/metricsService.ts`)

  - Update `calculatePoolHealth` function signature: `(events, mode?: "classic" | "order" | "all")`
  - Filter logic:
    - `"classic"`: Count events where `classicPuzzleId === undefined`
    - `"order"`: Count events where `orderPuzzleId === undefined`
    - `"all"` (default): Count events where BOTH are undefined
  - Update depletion calculation: 6 events/day for Classic, varies for Order (based on selection algorithm)
  - Success criteria: Pool health accurately reflects per-mode availability

- [ ] **Update PoolHealthCard to accept mode prop** (`src/components/admin/PoolHealthCard.tsx`)

  - Add prop: `mode: "classic" | "order" | "all"`
  - Pass mode to Convex query
  - Update labels: "Unused Events (Classic)" or "Unused Events (Order)"
  - Success criteria: Card accurately shows mode-specific pool health

- [ ] **Wire ModeFilter to OverviewTab metrics**

  - OverviewTab receives selected mode from AdminTabs
  - Pass mode to: PoolHealthCard, CostTrendsChart (if mode-specific costs tracked), QualityMetricsGrid
  - Success criteria: All overview metrics respect mode filter

---

### 4.7 Cleanup - Deprecate Old `puzzleId` Field

**Context:** After migration verified and all queries updated, remove deprecated `puzzleId` field to clean up schema.

- [ ] **Audit all `puzzleId` references in codebase**

  - Search: `grep -rn "puzzleId" convex/ src/ --include="*.ts" --include="*.tsx"`
  - Categorize: Which still reference old field vs new `classicPuzzleId`/`orderPuzzleId`
  - Document: List of files needing updates
  - Success criteria: Complete inventory of old field usage

- [ ] **Update remaining queries to use `classicPuzzleId`**

  - Update `convex/generationLogs.ts:165`: Change `puzzleId === undefined` to `classicPuzzleId === undefined`
  - Update any other files found in audit
  - Success criteria: No runtime references to old `puzzleId` field

- [ ] **Remove deprecated `puzzleId` field from schema** (`convex/schema.ts`)

  - Remove: `puzzleId: v.optional(v.id("puzzles"))`
  - Remove: `.index("by_puzzle", ["puzzleId"])`
  - Remove: `.index("by_year_available", ["year", "puzzleId"])`
  - Run: `npx convex dev` to verify schema validates
  - Success criteria: Clean schema with only new per-mode fields

- [ ] **Write migration to drop `puzzleId` values from documents**

  - Optional cleanup: Set `puzzleId: undefined` on all events to free storage
  - Or let Convex handle orphaned fields naturally
  - Success criteria: No references to deprecated field anywhere

---

## Testing & Quality Assurance

### Integration Tests

- [ ] **Write end-to-end test for Gemini 3 migration** (`convex/lib/__tests__/gemini3Integration.test.ts`)

  - Test: Generate events for year 1969 using Gemini3Client
  - Verify: Events meet quality thresholds, metadata populated, cost tracked accurately
  - Test: Fallback to GPT-5-mini works when Gemini 3 fails (mock Gemini 3 failure)
  - Success criteria: Full pipeline works with Gemini 3, fallback is reliable

- [ ] **Write integration test for batch processing** (`convex/actions/eventGeneration/__tests__/batchProcessing.test.ts`)

  - Test: Generate 10 years in parallel, verify all complete
  - Test: Partial failures don't block other years
  - Test: Rate limiting prevents exceeding 60 req/min
  - Success criteria: Batch processing is robust, handles errors gracefully

- [ ] **Write integration test for alert engine** (`convex/lib/observability/__tests__/alertEngine.test.ts`)
  - Test: Pool depletion alert fires when threshold crossed
  - Test: Cost spike alert fires with correct cooldown
  - Test: Slack notification sent (mock webhook)
  - Success criteria: Alerts fire correctly, cooldown prevents spam

### Performance Tests

- [ ] **Benchmark Gemini 3 vs GPT-5-mini generation latency**

  - Measure: Time to generate 6 events for 1 year (both models)
  - Compare: p50, p95, p99 latencies
  - Verify: Gemini 3 latency acceptable (<30s p95), not significantly slower than GPT-5-mini
  - Success criteria: Latency regression <20%, cost savings justify any slowdown

- [ ] **Load test batch processing with 50 concurrent years**
  - Verify: Rate limiter prevents 429 errors
  - Measure: Total batch completion time, memory usage
  - Success criteria: Can handle 50 years without exceeding OpenRouter limits, memory usage <512MB

### Documentation

- [ ] **Update CLAUDE.md with Gemini 3 migration notes**

  - Document: New gemini3Client abstraction, thinking tokens concept, context caching
  - Add: Troubleshooting guide for Gemini 3 failures, how to check fallback logs
  - Success criteria: Future developers understand new LLM infrastructure

- [ ] **Document event metadata schema in schema.ts**

  - Add JSDoc comments explaining each metadata field: purpose, valid values, usage in game modes
  - Document backward compatibility: existing events without metadata still work
  - Success criteria: Schema self-documenting, no confusion about metadata purpose

- [ ] **Create admin dashboard user guide** (`docs/admin-dashboard.md`)
  - Document: How to access dashboard, what each panel shows, how to interpret metrics
  - Include: Screenshots of each component, troubleshooting common issues
  - Success criteria: Non-technical admins can use dashboard without assistance

---

## Definition of Done

Each task is considered complete when:

1. ✅ Code written and passes TypeScript type checking (`pnpm type-check`)
2. ✅ Tests written and passing (`pnpm test`)
3. ✅ Code follows project conventions (linting passes: `pnpm lint`)
4. ✅ JSDoc comments added for public interfaces
5. ✅ Success criteria validated (smoke test in dev environment)

---

**Strategic Programming Notes:**

This TODO implements Ousterhout's deep module principle at every level:

- **gemini3Client**: Simple `generate<T>()` hides thinking tokens, caching, structured outputs
- **qualityValidator**: Simple `validateEvent()` hides embeddings, knowledge base, ensemble scoring
- **metricsCollector**: Simple `recordGeneration()` hides aggregation, windowing, percentiles
- **alertEngine**: Simple `checkAlerts()` hides rule evaluation, cooldown, multi-channel routing

Each module is designed for 2+ year lifespan, not quick tactical wins. Invest now in abstractions that hide complexity and enable future game modes without breaking changes.
