# Chrondle Events and Puzzle System

**Last Updated**: 2025-12-27

This directory contains information about how Chrondle's puzzle system works.

## How Puzzles Work in Chrondle

**IMPORTANT: Puzzles are generated DYNAMICALLY from the events table**

The Convex database contains:

- **Historical events** in the `events` table (expanding via LLM generation)
- Events span from year -776 (First Olympic Games) to 2024+
- Each event has a year, description, and optional metadata (difficulty, categories)

## Game Modes

### Classic Mode (Range Guessing)

1. A deterministic hash of the current date selects a target year
2. All events from that year are retrieved as hints (6 max)
3. Players submit year ranges trying to contain the target year
4. Scoring based on range width × hints used

### Order Mode (Chronological Sorting)

1. A deterministic hash selects 5 events from different years
2. Events are shuffled; players drag to reorder chronologically
3. Golf-style scoring: fewer attempts = better score
4. All players see the same 5 events on a given day

## Daily Puzzle Generation

Both modes generate puzzles dynamically each day:

1. A deterministic hash of the current date drives selection
2. Events are retrieved from the `events` table
3. Puzzle metadata is stored for tracking (puzzleNumber, date)
4. The same date always produces the same puzzle globally

**There is NO migration needed** - the events table contains all necessary data.

## Event Generation (LLM-Powered)

Events are expanded via an LLM pipeline:

1. **Generator**: Creates candidate events via Gemini 3 / GPT-5
2. **Critic**: Validates accuracy, uniqueness, quality
3. **Reviser**: Improves rejected events based on feedback
4. **Orchestrator**: Manages batch processing with rate limiting

See `convex/actions/eventGeneration/` for implementation details.

## Database Structure

- **events table**: Historical events (LLM-generated and curated)
- **puzzles table**: Classic mode puzzle metadata
- **orderPuzzles table**: Order mode puzzle metadata
- **plays table**: Classic mode user attempts
- **orderPlays table**: Order mode user attempts
- **users table**: User accounts and streaks

## Verification

To verify the events are present:

```bash
# Check event count
npx convex run events:count

# Check in Convex dashboard
npx convex dashboard

# View generation logs
npx convex run generationLogs:getRecentLogs
```

The system is working as designed - puzzles are generated on-demand from events.
