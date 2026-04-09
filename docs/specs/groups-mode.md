# Context Packet: Chrondle Groups

Working title: `Groups`

## Goal

Deliver a third daily Chrondle mode that makes players discover four exact historical years by partitioning a 4x4 board of event clues into four solved groups.

## Non-Goals

- Clone Connections branding or ship a wordplay-first category game
- Generalize Classic, Order, and Groups into one shared engine before the first release
- Use decade buckets, partial credit, or token-drag mechanics in V1
- Require complete `events.metadata` coverage before the mode can launch

## Constraints / Invariants

- The hidden solution is always four exact years with four events per year.
- Players get four incorrect submissions total.
- `One away` appears only when a submitted four-card set contains exactly three cards from one hidden group.
- A solved group may reveal only its own year and tier. Unsolved groups remain hidden.
- The mode must reuse the shared `events` pool and track freshness independently from Classic and Order.
- V1 must preserve the Prime Directive from `AGENTS.md` and `CLAUDE.md`: no answer-leaking UI or validation copy.
- V1 should work even when event metadata is missing; metadata is a balancing signal, not a hard dependency.

## Authority Order

tests > type system > code > docs > lore

## Prior Art

- Existing third-mode concept, now archived as an alternative: [matchmaker-game.md](./matchmaker-game.md)
- Daily-puzzle storage and retrieval pattern: [generation.ts](/Users/phaedrus/Development/chrondle/convex/puzzles/generation.ts), [queries.ts](/Users/phaedrus/Development/chrondle/convex/puzzles/queries.ts)
- Second-mode generation and play validation pattern: [mutations.ts](/Users/phaedrus/Development/chrondle/convex/orderPuzzles/mutations.ts), [queries.ts](/Users/phaedrus/Development/chrondle/convex/orderPuzzles/queries.ts)
- Shared event-pool and mode-isolated usage tracking: [schema.ts](/Users/phaedrus/Development/chrondle/convex/schema.ts), [dualModeEventUsage.test.ts](/Users/phaedrus/Development/chrondle/convex/__tests__/dualModeEventUsage.test.ts)
- Connections mechanics confirmed during shaping research: 16-card board, four groups of four, four mistakes, `One away`, and one revealed group per difficulty color. Sources:
  - https://www.nytimes.com/2023/06/26/crosswords/new-game-connections.html
  - https://www.nytimes.com/2023/11/06/crosswords/connections-tips-and-tricks.html
  - https://www.cnet.com/tech/services-and-software/nyt-connections-seven-hints-answers-tricks-and-tips-for-winning-every-game/
  - https://en.wikipedia.org/wiki/The_New_York_Times_Connections

## Repo Anchors

- [schema.ts](/Users/phaedrus/Development/chrondle/convex/schema.ts)
- [generation.ts](/Users/phaedrus/Development/chrondle/convex/puzzles/generation.ts)
- [mutations.ts](/Users/phaedrus/Development/chrondle/convex/orderPuzzles/mutations.ts)
- [puzzleHelpers.ts](/Users/phaedrus/Development/chrondle/convex/lib/puzzleHelpers.ts)
- [GamesGallery.tsx](/Users/phaedrus/Development/chrondle/src/components/GamesGallery.tsx)
- [ModeDropdown.tsx](/Users/phaedrus/Development/chrondle/src/components/ModeDropdown.tsx)
- [GameModeLayout.tsx](/Users/phaedrus/Development/chrondle/src/components/GameModeLayout.tsx)
- [admin/puzzles.ts](/Users/phaedrus/Development/chrondle/convex/admin/puzzles.ts)

## Product Shape

- Board: 16 event cards in a 4x4 layout.
- Hidden solution: 4 exact years, 4 events per year.
- Turn loop:
  - Player selects exactly 4 unsolved cards.
  - Submission is checked against the 4 hidden groups.
  - Exact match locks the group, removes those cards from active play, and reveals that group's year and tier.
  - Exact 3/4 overlap returns `One away`.
  - Any other mismatch consumes one mistake.
- Loss condition: 4 incorrect submissions.
- Win condition: all 4 groups solved within the mistake budget.
- Difficulty ladder:
  - `easy`: globally famous or highly distinctive year/event set
  - `medium`: recognizable but requires some filtering
  - `hard`: lower-fame or more confusable event set
  - `very hard`: obscure or deliberately subtle but still fair
- Postgame reveal: all four groups with years, tier labels, and share-safe summary.

## Recommended Technical Design

### Data model

- Add a dedicated `groupsPuzzles` table.
- Add a dedicated `groupsPlays` table.
- Extend `events` with a third mode-specific usage field and supporting indexes rather than abstracting all modes behind a generic relation table in V1.

### Suggested `groupsPuzzles` shape

```ts
{
  puzzleNumber: number;
  date: string;
  board: Array<{
    id: string;
    text: string;
    year: number;
    groupId: string;
  }>;
  groups: Array<{
    id: string;
    year: number;
    tier: "easy" | "medium" | "hard" | "very hard";
    eventIds: string[];
  }>;
  seed: string;
  updatedAt: number;
}
```

### Suggested `groupsPlays` shape

```ts
{
  userId: Id<"users">;
  puzzleId: Id<"groupsPuzzles">;
  solvedGroupIds: string[];
  mistakes: number;
  submissions: Array<{
    eventIds: string[];
    result: "solved" | "one_away" | "miss";
    timestamp: number;
  }>;
  completedAt?: number;
  updatedAt: number;
}
```

### Generator design

1. Query years with at least 4 events unused for the new mode.
2. Select 4 candidate years with conservative spacing and fairness constraints.
3. Sample 4 events from each year using existing pool helpers and metadata when present.
4. Assign one tier per year-group based on a board-level score, not raw year age.
5. Run a board judge that rejects:
   - years that cluster too tightly
   - groups with multiple plausible cross-year blends
   - boards where one group is obviously easier or harder than its assigned tier
   - boards that depend on metadata fields absent from too many selected events

### Difficulty assignment

- Use `metadata.difficulty` and `metadata.fame_level` as balancing inputs.
- Use ambiguity and board-level separability as the real gate.
- Do not tie tier directly to era. Ancient should not always mean `very hard`, and modern should not always mean `easy`.

## Fairness Rules

- No V1 board should contain two target years that are so close that multiple event cards plausibly belong to either year without specialist knowledge.
- No V1 board should require category or tag metadata to be present on every selected event.
- `One away` must be computed server-side from the authoritative hidden groups.
- Solved cards must not remain selectable.
- Error copy must stay neutral; no “too early,” “too late,” or era-specific hints.

## Alternative Considered

Pure semantic-category grouping is closer to Connections, but it is a worse first build here because the current `metadata` surface is still incomplete. Exact-year grouping better fits the existing database and preserves Chrondle's core historical-year identity.

## Oracle (Definition of Done)

- [ ] A new daily mode exists alongside Classic and Order.
- [ ] The daily generator can create a valid 16-card board from the shared event pool for a given date.
- [ ] A correct four-card submission solves exactly one group and reveals only that group's year and tier.
- [ ] A 3/4 near miss returns `One away`.
- [ ] Four incorrect submissions end the puzzle and reveal the full board.
- [ ] Archive and admin surfaces can inspect the new mode's daily puzzle.
- [ ] `bun run lint && bun run type-check && bun run test`

## Implementation Sequence

1. Prototype board construction and ambiguity scoring against the live pool.
2. Add Convex schema, generation, queries, and server-side play validation for Groups.
3. Build the 4x4 gameplay surface and local/authenticated session handling.
4. Extend home, mode switching, archive, and admin surfaces.
5. Roll out behind a soft-launch or manual-review gate before fully autonomous daily generation.

## Risk + Rollout

- Main risk: unfair boards, not lack of content.
- Recommended rollout: start with pre-generated or manually reviewed boards, then automate once board-quality heuristics are stable.
- Backfill metadata opportunistically in parallel, but do not make it a launch blocker.
