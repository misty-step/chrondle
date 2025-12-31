# Event Generation System

The event generation system creates high-quality historical event clues for Chrondle puzzles. It follows Ousterhout's deep module principles: simple interfaces hiding complex implementations.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Event Generator                         │
│           generateEvents(year, era, count)                  │
│                                                             │
│  • Single LLM call (Gemini 3 Pro)                          │
│  • Self-validates events in prompt                         │
│  • Deterministic safety net post-generation                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Puzzle Quality                          │
│              hasObviousRedundancy(hints)                    │
│              selectDiverseHints(events)                     │
│                                                             │
│  • Pure functions, no LLM                                  │
│  • Fast pre-filtering at puzzle composition                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Puzzle Critic                           │
│              critiquePuzzle(hints, year)                    │
│                                                             │
│  • LLM-based semantic analysis (Gemini 3 Flash)            │
│  • Checks redundancy, vagueness, diversity                 │
│  • Optional quality gate before puzzle creation            │
└─────────────────────────────────────────────────────────────┘
```

## Modules

### Event Generator (`convex/lib/eventGenerator.ts`)

**Purpose:** Generate high-quality events for a given year.

**Interface:**

```typescript
interface QualityEvent {
  text: string;           // Event description (≤20 words)
  title: string;          // Brief title
  category: string;       // politics, war, science, culture, etc.
  difficulty: 1-5;        // 1=famous, 5=obscure
  region: string;         // Geographic region
}

async function generateEvents(
  year: number,
  era: "BCE" | "CE",
  count?: number,         // Default: 10
): Promise<GenerationResult>
```

**Quality Rules (enforced by LLM + safety net):**

1. Factual: Event must be real and dated to exact target year
2. No leakage: No numbers ≥10, no "century", "decade", "BC", "AD", etc.
3. Proper nouns: Each event names a person, place, or institution
4. Concise: Present tense, ≤20 words
5. Guessable: Helps players deduce year without being obvious
6. Not vague: No generic phrases like "A major event occurs"

**Example:**

```typescript
const result = await generateEvents(1969, "CE", 10);
// result.events = [
//   { text: "Armstrong becomes first human to walk on Moon", ... },
//   { text: "Woodstock festival draws hundreds of thousands", ... },
//   ...
// ]
```

### Puzzle Quality (`convex/lib/puzzleQuality.ts`)

**Purpose:** Pure functions for fast quality checks without LLM calls.

**Functions:**

```typescript
// Check if any two hints have >60% word overlap
function hasObviousRedundancy(hints: string[]): boolean;

// Check if hints cover at least N different categories
function hasTopicDiversity(
  events: Array<{ text: string; category: string }>,
  minCategories?: number, // Default: 3
): boolean;

// Select diverse hints from a larger pool
function selectDiverseHints(
  events: Array<{ text: string; category: string; difficulty: number }>,
  count?: number, // Default: 6
): string[];
```

**Usage in puzzle creation:**

```typescript
// puzzleHelpers.ts uses hasObviousRedundancy to avoid bad hint sets
const hints = selectedEvents.map((e) => e.event);
if (!hasObviousRedundancy(hints)) {
  // Good set, use it
}
```

### Puzzle Critic (`convex/lib/puzzleCritic.ts`)

**Purpose:** LLM-based evaluation of puzzle hint sets.

**Interface:**

```typescript
interface PuzzleQuality {
  passed: boolean; // No critical issues
  overallScore: number; // 0-1 (1.0 = perfect)
  issues: PuzzleIssue[]; // Specific problems found
  suggestions: string[]; // Improvement hints
}

async function critiquePuzzle(hints: string[], year: number): Promise<CritiqueResult>;
```

**Checks performed:**

1. **Redundancy:** Do any 2+ hints describe the same event/topic?
2. **Vagueness:** Are any hints too generic to be useful?
3. **Diversity:** Do hints cover different domains?
4. **Difficulty curve:** Is there a range from easy to hard?

**Example:**

```typescript
const result = await critiquePuzzle(
  [
    "Armstrong walks on Moon",
    "Aldrin walks on Moon", // Redundant!
    "Apollo 11 returns safely",
    // ...
  ],
  1969,
);

// result.quality = {
//   passed: false,
//   overallScore: 0.4,
//   issues: [{ type: "redundancy", hintIndex: 1, description: "Same event as hint 1" }],
//   suggestions: ["Replace hint 2 with a non-Apollo event"]
// }
```

### Simple Pipeline (`convex/actions/eventGeneration/simplePipeline.ts`)

**Purpose:** Orchestrate event generation for batch processing.

**Actions:**

```typescript
// Generate events for a single year
generateYearEventsSimple({ year: number }): Promise<SimpleGenerationResult>

// Generate events for multiple years
generateBatchSimple({ years: number[] }): Promise<BatchResult>
```

## Design Principles

### 1. LLM Does the Work

Instead of complex code validation, we put quality rules in the LLM prompt:

```
QUALITY RULES - Self-validate each event before including:
1. FACTUAL: Event must be real and dated to the exact target year
2. NO LEAKAGE: No numbers ≥10, no "century", "decade", ...
...
Only return events that pass ALL requirements.
```

The LLM is much better at semantic understanding than regex rules.

### 2. Simple Safety Net

Post-generation, we run fast deterministic checks to catch obvious failures:

```typescript
function passesValidation(event: QualityEvent): boolean {
  if (hasLeakage(event.text)) return false; // Regex check
  if (!hasProperNoun(event.text)) return false; // Regex check
  if (!isValidWordCount(event.text, 20)) return false;
  // Vagueness patterns
  if (/^(a|an|the) (major|important)/.test(event.text)) return false;
  return true;
}
```

### 3. No Complex Loops

The old system had:

- 4 total attempts
- 2 critic cycles per attempt
- Reviser stage for failing events
- Score blending (0.7 LLM + 0.3 semantic)

The new system:

- 1 LLM call
- Filter results
- Done

### 4. Pure vs LLM Functions

**Pure functions** (`puzzleQuality.ts`):

- Can be used from Convex mutations/queries
- No "use node" directive needed
- Fast, deterministic

**LLM functions** (`eventGenerator.ts`, `puzzleCritic.ts`):

- Require "use node" directive
- Used from Convex actions
- Async, non-deterministic

## Extending the System

### Adding New Quality Checks

1. **For event generation:** Update `SYSTEM_PROMPT` in `eventGenerator.ts`
2. **For fast filtering:** Add patterns to `passesValidation()` or `puzzleQuality.ts`
3. **For puzzle validation:** Update `SYSTEM_PROMPT` in `puzzleCritic.ts`

### Changing LLM Models

Update the `getClient()` function in the relevant module:

```typescript
cachedClient = createGemini3Client({
  model: "google/gemini-3-pro-preview", // Change this
  fallbackModel: "openai/gpt-5-mini",
  // ...
});
```

### Adding New Event Categories

Update the Zod schema in `eventGenerator.ts`:

```typescript
category: z.enum([
  "politics", "war", "science", "culture",
  "technology", "religion", "economy", "sports",
  "exploration", "arts",
  // Add new categories here
]),
```

## File Reference

| File                                               | Purpose                               |
| -------------------------------------------------- | ------------------------------------- |
| `convex/lib/eventGenerator.ts`                     | Event generation with self-validation |
| `convex/lib/puzzleCritic.ts`                       | LLM-based puzzle quality evaluation   |
| `convex/lib/puzzleQuality.ts`                      | Pure functions for quality checks     |
| `convex/lib/eventValidation.ts`                    | Regex-based validation helpers        |
| `convex/lib/gemini3Client.ts`                      | LLM client for OpenRouter             |
| `convex/lib/puzzleHelpers.ts`                      | Database operations for puzzles       |
| `convex/actions/eventGeneration/simplePipeline.ts` | Batch generation orchestration        |
