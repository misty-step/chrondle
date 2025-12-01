# Admin Dashboard Guide

The Chrondle Admin Dashboard is the command center for managing the event pool, monitoring costs, and ensuring puzzle quality.

**URL:** `/admin/dashboard`
**Access:** Requires `admin` role in Clerk public metadata.

## 1. Overview Tab

Real-time operational health at a glance.

- **Pool Health:**
  - **Unused Events:** Total events available for new puzzles.
  - **Days Until Depletion:** Estimated runway based on 6 events/day consumption.
  - **Color Codes:** 🟢 >90 days, 🟡 30-90 days, 🔴 <30 days.
- **Cost Trends:** Daily generation costs broken down by stage (Generator/Critic/Reviser).
- **Quality Metrics:** Average scores from the Critic (0-1 scale).
- **Recent Generations:** Log of the last 20 year-generation attempts. Click a row to see failure reasons.

## 2. Events Tab

Browse and manage the 4,000+ event database.

- **Search:** Fuzzy text search for event content.
- **Filters:**
  - **Era:** Ancient / Medieval / Modern.
  - **Usage:** Filter by "Unused in Classic" or "Unused in Order" to find fresh content.
- **Actions:**
  - **Edit:** Click event text to fix typos inline.
  - **Delete:** Remove low-quality events (only if unused).

## 3. Puzzles Tab

History of daily puzzles for both game modes.

- **Modes:** Toggle between "Classic" and "Order".
- **Details:** Click a row to see:
  - Target Year / Event Range.
  - Player Stats (Play count, completion rate).
  - Full event list used in that puzzle.

## Troubleshooting

### "Pool Depletion Imminent" Alert

- **Cause:** Unused event count dropped below 30 days runway.
- **Action:** The cron job (`generateDailyBatch`) normally handles this. If it fails, check `Recent Generations` for errors (e.g., "Rate Limit", "Payment Required").
- **Manual Fix:** You can manually trigger generation via the CLI: `npx convex run actions/eventGeneration/orchestrator:generateDailyBatch --args '{"targetCount": 10}'`.

### High Cost / Low Quality

- **Cost Spike:** Check if `cache_hits` are low in the Generation Logs. Low cache hits mean we are paying full price for system prompts.
- **Quality Drop:** Check `failure_reason` in logs. If "insufficient_quality", the Generator might be producing weak candidates. Consider tuning the `generateCandidatesForYear` prompt.

### Missing Data

- If charts are empty, ensure the `generation_logs` table is being populated by the cron job.
