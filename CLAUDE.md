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

**Event Generation (Simplified Architecture):**

The event generation system follows Ousterhout's deep module principles with two main modules:

- **Event Generator** (`convex/lib/eventGenerator.ts`): Single LLM call that generates AND self-validates events. No separate critique/revise stages.

  - `generateEvents(year, era, count)` → `QualityEvent[]`
  - LLM validates events before returning (no year leakage, proper nouns, ≤20 words)
  - Deterministic safety net catches obvious failures post-generation

- **Puzzle Critic** (`convex/lib/puzzleCritic.ts`): Validates 6 hints as a cohesive puzzle set.

  - `critiquePuzzle(hints, year)` → `PuzzleQuality`
  - Checks: redundancy, vagueness, diversity, difficulty curve
  - Uses Gemini Flash (cheap/fast) for evaluation

- **Puzzle Quality** (`convex/lib/puzzleQuality.ts`): Pure functions for fast pre-filtering.

  - `hasObviousRedundancy(hints)` → quick word-overlap check, no LLM
  - `selectDiverseHints(events)` → picks hints maximizing category diversity

- **Simple Pipeline** (`convex/actions/eventGeneration/simplePipeline.ts`): Streamlined orchestration.
  - `generateYearEventsSimple(year)` → generates events, filters, imports to DB
  - No retry loops or complex state machines

**LLM Client:** `convex/lib/gemini3Client.ts` – Deep module wrapping OpenRouter APIs.

- `generate<T>()` with Zod schema validation, retries, fallback, caching
- Models: `google/gemini-3-pro-preview` (generator), `google/gemini-3-flash-preview` (critic)
- Fallback: `openai/gpt-5-mini` on repeated failures

### Event Generation Troubleshooting

**Symptom:** Generated events have quality issues

- Check: LLM prompt in `eventGenerator.ts` SYSTEM_PROMPT
- Action: Update self-validation rules in the prompt; add patterns to `passesValidation()` safety net

**Symptom:** Puzzles have redundant hints

- Check: `puzzleQuality.ts` `hasObviousRedundancy()` threshold (currently 60% word overlap)
- Action: Lower threshold or use `critiquePuzzle()` for LLM-based semantic redundancy check

**Symptom:** Frequent 429s / rate-limit errors

- Check: `convex/lib/rateLimiter.ts` config
- Action: Reduce batch sizes; verify OpenRouter limits

**Symptom:** Gemini 3 outages

- Check: `fallbackFrom` in response metadata
- Action: Temporarily pin `model` to GPT-5-mini in `eventGenerator.ts`

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

- **Event Generation:** `docs/EVENT_GENERATION.md` (architecture, usage, extension guide)
- **Detailed Patterns:** `.claude/context.md` (1,246 lines of discovered patterns)
- **Backlog:** `BACKLOG.md` (prioritized issues + estimates)
- **README:** Deployment, setup, architecture overview
- **Archive:** `CLAUDE.archive.md` (full 1,091-line original guide)
