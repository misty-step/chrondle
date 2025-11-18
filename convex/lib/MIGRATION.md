# Range Migration Plan

Goal: retire legacy `plays.guesses[]` while keeping production playable the entire time. This document explains the staged approach, monitoring queries, and rollback procedures for the 30-day cutover.

## Summary Timeline

| Phase                     | Calendar Days | Primary Objective                                                                                                                                 |
| ------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1 – Dual Schema** | Days 1–7      | Deploy schema with both `guesses[]` and `ranges[]` available, update read paths to normalize either format.                                       |
| **Phase 2 – Dual Write**  | Days 8–30     | `submitRange` writes only `ranges[]`, monitoring ensures every new play carries range data; legacy `guesses[]` remains read-only for old records. |
| **Phase 3 – Cutover**     | Day 30+       | Backfill any stragglers, archive old data snapshot, drop `guesses[]`, remove migration helpers.                                                   |

## Phase Details

### Phase 1 – Dual Schema (Days 1–7)

- Ship the schema shown in `convex/schema.ts` (already live) with optional `ranges[]` + `guesses[]`.
- Ensure every consumer reads via `normalizePlayData` from `convex/lib/migrationHelpers.ts` so UI/hooks only see range objects.
- Validation: run the monitoring query (below) to capture baseline of legacy plays.
- Do **not** delete any legacy UI yet; the goal is stability while the new Range experience rolls out.

### Phase 2 – Dual Write (Days 8–30)

- `submitRange` mutation is authoritative; no Convex code writes to `guesses[]` anymore.
- Anonymous session storage should only emit range objects (already true with RangeInput).
- Continue to store `guesses[]` for historical records only via `normalizePlayData` to avoid surprises if a legacy client surfaces.
- Monitoring cadence: run the adoption query daily (or hook into scheduled job) to watch the number of documents without range data shrink to zero.
- Instrument logs for any attempts to call the deprecated `submitGuess` mutation; flag them in Datadog/Logtail so we can help old clients upgrade.

### Phase 3 – Cutover (Day 30+)

- Run the backfill helper one last time for documents missing `ranges[]` (see script snippet below).
- Take a Convex export or snapshot before destructive steps.
- Remove `guesses` field from schema + `legacyGuessesToRanges` + `normalizePlayData` once metrics confirm zero legacy dependence.
- Update README / release notes so downstream teams (data, analytics) know the column vanished.

## Monitoring Queries

All queries can be run via `npx convex repl` (which provides an async `db` helper). Replace the inline JS with your preferred script if you want automation.

1. **Count plays missing range data**

```ts
// legacy plays lacking ranges (should trend to 0 before Phase 3)
await db
  .query("plays")
  .filter((q) => q.or(q.eq(q.field("ranges"), undefined), q.eq(q.field("ranges"), [])))
  .collect();
```

2. **Count plays that still rely on guesses for normalization**

```ts
await db
  .query("plays")
  .filter((q) => q.and(q.neq(q.field("guesses"), undefined), q.gt(q.len(q.field("guesses")), 0)))
  .collect();
```

3. **Adoption ratio (ranges vs. total)** – useful for dashboards.

```ts
const total = await db.query("plays").collect();
const rangeBacked = total.filter((play) => Array.isArray(play.ranges) && play.ranges.length > 0);
({ total: total.length, rangeBacked: rangeBacked.length });
```

4. **Backfill helper (one-off script idea)**

```ts
import { legacyGuessesToRanges } from "../convex/lib/migrationHelpers";

for await (const play of db.query("plays")) {
  if ((!play.ranges || play.ranges.length === 0) && play.guesses?.length) {
    await db.patch(play._id, {
      ranges: legacyGuessesToRanges(play.guesses, { startingTimestamp: play.updatedAt }),
      totalScore: play.totalScore ?? 0,
    });
  }
}
```

> Tip: wrap the backfill in pages/batches (`take(1000)`) to avoid long-running transactions.

## Rollback Plan

| Scenario                                        | Action                                                                                                                                                                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Phase 1 issues (schema read errors)**         | Revert to prior Convex deploy (schema only). No data written with `ranges` yet, so rollback is trivial.                                                                                                                                          |
| **Phase 2 incident (dual writes buggy)**        | Re-enable `submitGuess` mutation temporarily (code lives in git history), disable RangeInput behind a feature flag if necessary. Use `legacyGuessesToRanges` to regenerate ranges for affected plays, then resume Phase 2 once the bug is fixed. |
| **Phase 3 incident (after dropping `guesses`)** | Restore from the snapshot/export taken before schema deletion, redeploy the build with `guesses` field intact, and re-run backfill scripts carefully. Ensure new Range writes stop until parity is restored.                                     |

General rollback steps:

1. Pause user traffic if data corruption is ongoing (toggle maintenance banner or disable mutations via Convex config).
2. Restore previous Convex deploy (via `convex deployments switch <id>`) or restore from backup if schema dropped.
3. Re-run monitoring queries to ensure legacy vs. new data counts make sense before re-opening traffic.

## Communication Checklist

- Include migration status in daily standups during the 30-day window.
- After Phase 3 completes, announce in the #prod channel + update `README.md` “Data Model” section to mention only `ranges[]`.
- Coordinate with analytics/data folks so any warehouse jobs reading `guesses[]` migrate in lockstep.

## References

- `convex/lib/migrationHelpers.ts` – normalization & backfill helpers.
- `convex/schema.ts` – authoritative schema and indexes.
- DESIGN.md “Module: Migration” – architectural rationale.
