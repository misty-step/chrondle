### [FEATURE] Chrondle Matchmaker - NEW GAME MODE

**Current State**: Single Chrondle Classic game mode only
**Perspectives**: product-visionary, user-experience-advocate
**Opportunity**: New sister game mode with simpler, more accessible matching mechanic
**Status**: Ship after Range/Chips A/B test completes and Order game stabilizes

**Core Mechanic**:

- Player receives **K events** (e.g., 8) and **K candidate tokens** (years or decades)
- Goal: Drag tokens onto events in 1:1 mapping
- Single commit at end (no progressive reveals)
- Fast, mobile-friendly, approachable for casual players

**Scoring System**:

- **Exact match**: +100 points (S = 100)
- **Tolerance-based partial credit**: If `tolerance_years > 0` and token is a decade containing the answer year, award 50% (e.g., +50 points)
- **Wrong match**: 0 points
- **Total score**: Sum across all events × hint multiplier

**Hint System** (3-tier, per-event):

Each hint reduces per-event multiplier using standard ladder:

- **H0 (no hints)**: `Hmult = 1.00`
- **H1 - Eliminate tokens** (e.g., "Remove 2 wrong candidates"): `Hmult = 0.85`
- **H2 - Bracket reveal** (e.g., "Between 1880-1920" or "1960s decade"): `Hmult = 0.70`
- **H3 - Relative positioning** (e.g., "Same decade as Event X" or "Earlier than Event Y"): `Hmult = 0.50`

Hints are **pre-commit only**; after reveal, explanations are free.

**Reveal Animation**:

- Lines animate from chosen tokens to correct answers
- Show per-event score breakdown (with hint multiplier)
- Display total score and percentile
- Share card with match accuracy visualization

**Content Model** (Shared):

Uses existing `Event` schema:

```typescript
{
  id: string;
  prompt: string;
  answer_year: number;
  tolerance_years?: number;  // Enables decade-based partial credit
  sources?: string[];
  notes?: string;
  enabled: boolean;
  last_used_on?: string;
}
```

**Token Generation Strategy**:

- **Modern events (post-1900)**: Use exact years as tokens (e.g., 1969, 1984, 2001)
- **Historical events (pre-1900)**: Use decades to reduce cognitive load (e.g., "1860s", "1770s")
- Auto-select based on event date ranges in daily set
- Add 1-2 "close but wrong" distractor tokens per event

**Scoring Pseudocode**:

```typescript
function scoreMatchmakerPairs(pairs: Array<{ event_id; token }>, Hmult: number) {
  let total = 0;
  for (const { event_id, token } of pairs) {
    const event = getEvent(event_id);
    const tokenYear = parseToken(token); // "1960s" → 1965 midpoint

    // Exact match
    if (tokenYear === event.answer_year) {
      total += 100 * Hmult;
      continue;
    }

    // Decade-based partial credit
    if (event.tolerance_years && Math.abs(tokenYear - event.answer_year) <= 5) {
      total += 50 * Hmult;
    }
  }
  return Math.floor(total);
}
```

**UX Considerations**:

- **Mobile-first**: Large touch targets, swipe to match
- **Clear feedback**: Visual connection lines during drag
- **Undo support**: Allow remapping before final commit
- **Keyboard accessible**: Tab navigation, Enter to select
- **Colorblind safe**: Use shapes + colors for token types

**Implementation Complexity**:

- **UI**: Medium (drag-drop, token grid, connection lines)
- **Scoring**: Low (simple exact/decade matching)
- **Content**: Zero (reuses Event schema)
- **Backend**: Low (scoring endpoint reuses puzzle validation)
- **Total Effort**: 5-7 days

**Success Metrics**:

- **D1→D7 retention**: Target +10-15% relative uplift vs. Classic alone
- **Session length**: 2-3 minutes (faster than Classic 2.5-4.5 min)
- **Completion rate**: ≥85% (lower cognitive load than Classic)
- **Share rate**: ≥12% of completed sessions
- **Cross-mode engagement**: 40%+ of users play both Classic and Matchmaker daily

**Integration with Chrondle Hub**:

- **Tab navigation**: Classic / Order / Matchmaker
- **Shared daily puzzle set**: All three modes use same events (different mechanics)
- **Unified stats**: Combined streak, total score aggregation
- **Mode switcher**: Persistent preference (localStorage)
- **Share cards**: Mode-specific visualization (timeline bars vs. connection lines)

**Competitive Analysis**:

- **NYT Connections**: Matching mechanic with cognitive grouping
- **Wordle variants**: Multiple daily games (Wordle + Connections + Mini Crossword)
- **Quordle/Octordle**: Parallel puzzle solving
- **Key differentiator**: Historical education + simpler matching vs. abstract word grouping

**A/B Test Plan**:

1. **Phase 1**: Launch Classic Range/Chips A/B test (4 weeks)
2. **Phase 2**: Stabilize Order game (2 weeks)
3. **Phase 3**: Soft launch Matchmaker to 20% of users (2 weeks)
4. **Phase 4**: Measure cross-mode engagement and retention
5. **Metrics**: Compare single-mode vs. multi-mode user cohorts

**Monetization Opportunity**:

- **Premium tier**: Access to all three game modes
- **Free tier**: Classic only (daily puzzle)
- **Freemium upsell**: "Try Order and Matchmaker modes - unlock with Premium"
- **Expected conversion**: 8-12% of active users (higher than industry 3-5% due to daily habit formation)

**Value**: 9/10 (high-value addition with low implementation cost)
**Risk**: Low (isolated mode, shared content, proven matching mechanic)
**Recommendation**: Implement after Range/Chips winner determined and Order game validated

---
