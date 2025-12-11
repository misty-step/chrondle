# CHRONDLE OPERATIONS BRIEF

**Chrondle** = Daily historical year-guessing game. Players submit year ranges, get scored on range width + hints used + containment. Built with Next.js 15, React 19, TypeScript, Convex, Clerk.

## 🚨 CRITICAL: Puzzle Integrity

**NEVER implement features that reveal answers outside the 6-hint system.**

**Anti-patterns:**

- Auto-selecting BC/AD based on typed year
- Smart validation messages ("Too early for AD")
- Predictive era suggestions
- UI behaviors that change based on correct answer proximity

**Why:** Players deduce the year from historical event hints ("Construction of Pyramids" → BC, "Battle of Waterloo" → AD), not from UI tells.

## Architecture (Current Development)

**Range-Based Game:**

- Players submit normalized year ranges (e.g., 1960–1980 AD) instead of single guesses.
- Scoring: Uses quadratic interpolation with 4% minimum floor. Gentle curve in playable range, steep at extremes:
  ```
  widthFactor = 1 - ((width - 1) / (W_MAX - 1))² * (1 - MIN_WIDTH_FACTOR_FLOOR)
  score = Math.floor(MAX_SCORES_BY_HINTS[hintsUsed] × widthFactor)
  ```
  where `MAX_SCORES_BY_HINTS = [100, 85, 70, 55, 45, 35, 25]` and `MIN_WIDTH_FACTOR_FLOOR = 0.04`.
  This ensures maximum-width ranges (W_MAX=250) earn 4% of the score tier rather than 0 points. Containment is binary—no containment, no score.
- Core hook: `useRangeGame` (NOT `useChrondle` - that's dead code)
- Game state derivation: Pure functional via `deriveGameState` in `src/lib/gameState.ts`

**Puzzle Generation:**

- Dynamic, not static: 1,821 events in Convex `events` table
- Deterministic hash selects year daily → events for that year = hints
- Same date = same puzzle globally

**Convex Deployments:**

- **DEV:** `handsome-raccoon-955` (for development)
- **PROD:** `fleet-goldfish-183` (all event data lives here)

**Historical Context:**

- OpenRouter Responses API Alpha + GPT-5
- BC/AD format enforced (never BCE/CE) via `enforceADBC()` post-processing
- File: `convex/actions/historicalContext.ts`

**Event Generation Infrastructure (Gemini 3):**

- **Client:** `convex/lib/gemini3Client.ts` – Deep module that wraps OpenRouter Gemini 3 APIs behind a single `generate<T>()` call. Hides thinking-token options, cache headers, structured outputs, retries, and fallback logic.
- **Models:** Defaults to `google/gemini-3-pro-preview` (Generator) with optional `fallbackModel` (`openai/gpt-5-mini`) when Gemini 3 is unhealthy.
- **Thinking Tokens:** `thinking_level` (`"low" | "medium" | "high"`) maps to Gemini reasoning settings; reasoning tokens are tracked in `usage.reasoningTokens` but priced at ~$0. They should increase quality, not cost.
- **Context Caching:** When `cache_system_prompt` is true, the client derives a deterministic cache key via `buildCacheKey(systemPrompt, stage)` and sends `X-Cache-Key`/`X-Cache-TTL` headers. Cache hits are surfaced via `metadata.cacheHit` and `metadata.cacheStatus` and reflected in `cost.cacheSavingsUsd`.
- **Structured Outputs:** If a Zod schema is provided, the client converts it to JSON Schema (`response_format`) and parses/validates the response. Callers should only ever see typed, validated data – JSON parsing errors are handled inside the client.
- **Usage & Cost:** All calls return `usage` (input/output/reasoning/total tokens) and `cost` (input/output/reasoning/cacheSavings/total, in USD). Use this for cost dashboards and alert thresholds.
- **Fallback:** On repeated 429/5xx/network failures (after retries + backoff), `generate<T>()` automatically falls back from the Gemini 3 model to the configured `fallbackModel`, tagging `metadata.fallbackFrom` so we can track fallbacks over time.
- **Where It’s Used:** Generator, Critic, Reviser stages in `convex/actions/eventGeneration/*` and scripts that backfill/benchmark events.

### Gemini 3 Troubleshooting

**Symptom:** Frequent 429s / rate-limit errors

- Check: `convex/lib/rateLimiter.ts` config and orchestrator batch sizes.
- Action: Lower `targetCount` in `generateDailyBatch` or adjust `RateLimiter` tokens/burst; verify OpenRouter limits.

**Symptom:** Spiking cost or unexpected token usage

- Check: `result.usage` and `result.cost` from `gemini3Client`. Look for large `inputTokens` (oversized prompts) or `outputTokens` (overly verbose schemas/prompts).
- Action: Tighten prompts, reduce batch sizes, or switch some stages to a cheaper model (e.g., Flash) via `options.model`.

**Symptom:** Silent shape mismatches / runtime errors in pipelines

- Check: Zod schemas in `convex/actions/eventGeneration/schemas.ts` and the corresponding `generate<T>` calls.
- Action: Keep schemas and prompts in lockstep; if outputs change, update Zod + tests before touching callers.

**Symptom:** Gemini 3 outages

- Check: Alerting around failure rate / fallbacks. If `fallbackFrom` spikes, treat Gemini as degraded.
- Action: Temporarily pin `model` to GPT-5-mini in env/config for critical paths, then revert once Gemini stabilizes.

---

## Stack

**Hard requirements:** pnpm (npm blocked), Vitest + React Testing Library + jest-dom matchers, motion (NOT framer-motion)

**Core:** Next.js 15, React 19, TypeScript 5 (strict), Convex, Clerk, Tailwind 4, Radix UI

## Quality Gates

```bash
# Before committing
pnpm lint && pnpm type-check && pnpm test

# Convex DB integrity
npx convex run puzzles:getTotalPuzzles

# Start dev environment
npx convex dev  # Terminal 1
pnpm dev        # Terminal 2
```

## Live Patterns

**Search before building:**

```bash
rg "formatYear" --type ts  # Find existing patterns
ast-grep --lang typescript -p 'function $_($$$)' # Semantic search
```

**Vitest + RTL stack:**

- ✅ `expect(element).toBeInTheDocument()` / `toHaveTextContent()` via `@testing-library/jest-dom/vitest`
- ✅ Screen queries from `@testing-library/react`
- ⚠️ Keep assertions behavioral—favor user-visible effects over implementation details

**Motion mocks (required):**

```typescript
vi.mock("motion/react", () => ({
  motion: { div: ({ children, ...props }) => <div {...props}>{children}</div> },
  AnimatePresence: ({ children }) => <>{children}</>,
}));
```

**Animation constants:**

- Import from `@/lib/animationConstants`
- Always divide durations by 1000 (Framer Motion uses seconds)
- Always check `useReducedMotion()` before animating

## Common Traps

1. **Hydration:** Return safe defaults until `mounted=true`
2. **Convex paths:** `npx convex run dir/file:fn` (NOT `dir:fn`)
3. **Perf tests:** CI needs 1.5× local threshold (25ms vs 16ms)
4. **BC/AD:** Internal = negative numbers (BC), positive (AD)

## References

- **Detailed Patterns:** `.claude/context.md` (1,246 lines of discovered patterns)
- **Backlog:** `BACKLOG.md` (prioritized issues + estimates)
- **README:** Deployment, setup, architecture overview
- **Archive:** `CLAUDE.archive.md` (full 1,091-line original guide)
