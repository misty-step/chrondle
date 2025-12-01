# Admin Dashboard Guide

The Chrondle Admin Dashboard is the command center for managing the event pool, monitoring costs, and ensuring puzzle quality.

**URL:** `/admin/dashboard`  
**Access:** Requires `admin` role in Clerk public metadata.

---

## 0. Access & Permissions

- Sign in with your normal Chrondle account.
- Your Clerk user must have `publicMetadata.role = "admin"` (set by an engineer).
- Navigate directly to `/admin/dashboard`.
- If you see a 403 or redirect to the home page, you are not provisioned as an admin.

---

## 1. Overview Tab

Real-time operational health at a glance.

### 1.1 Mode Filter (Classic / Order / All)

- Top-right of the Overview tab you’ll see a mode selector.
- **Classic** – metrics calculated from Classic puzzles only.
- **Order** – metrics calculated from Order mode only.
- **All** – global pool view (events unused in both modes).
- Use this when answering questions like “Are we going to run out of Order events?” versus “Global pool health?”.

### 1.2 Pool Health Card

- **Unused Events:** Count of events not yet used for the selected mode.
- **Days Until Depletion:** Approximate runway based on current daily usage (Classic assumes 6 events/day).
- **Color Codes:**
  - 🟢 > 90 days – safe.
  - 🟡 30–90 days – plan a backfill soon.
  - 🔴 < 30 days – treat as operationally urgent.
- **What to do:**
  - Yellow: schedule additional generation runs this week.
  - Red: run a manual batch (`generateDailyBatch`) and validate Recent Generations for failures.

### 1.3 Cost Trends Chart

- Shows daily LLM generation costs for the last 7 days.
- Bars are broken down by stage: **Generator**, **Critic**, **Reviser**.
- Horizontal line = 7‑day average.
- **Interpretation:**
  - If today’s bar is > 2× the 7‑day average, a cost alert may trigger.
  - Spikes in a single stage often mean a prompt change or a bug in that stage.
- **What to do:**
  - Confirm whether a recent deployment changed prompts or batch size.
  - If costs rise with no visible benefit, flag for engineering to tune prompts/model choices.

### 1.4 Quality Metrics Grid

- **Average Quality Score:** Overall score from 0–1 (higher is better).
- Sub-metrics (may appear as gauges or small tiles):
  - **Factual** – historical accuracy.
  - **Leakage** – how often events leak the exact year.
  - **Ambiguity** – whether multiple years could fit.
  - **Guessability** – how helpful events are for players.
  - **Metadata Quality** – completeness/validity of event metadata.
- **Interpretation:**
  - Sustained drops in Quality or spikes in Leakage are red flags.
- **What to do:**
  - Drill into Recent Generations to see which years are failing.
  - If leakage is increasing, notify engineering – it may require new leaky phrases or stricter prompts.

### 1.5 Recent Generations Table

- Shows the last ~20 year generation attempts.
- Columns typically include: year, status (success/failed/skipped), events generated, cost, duration, timestamp.
- Filters allow you to focus on failed or skipped rows.
- Clicking a row opens details:
  - Error messages.
  - Generated events.
  - Quality scores.
- **What to do:**
  - Use this to confirm that cron is running (new rows appear daily).
  - When alerts fire, find the affected time window here and inspect errors.

### 1.6 Today’s Puzzles Card

- Shows **today’s Classic and Order puzzles** side by side.
- For each mode you’ll see:
  - Puzzle number.
  - Target year or event span.
  - Current play count.
- Clicking a card opens the puzzle detail view.
- **What to do:**
  - Use this to quickly verify that today’s puzzles generated correctly and are live.

---

## 2. Events Tab

Browse and manage the 4,000+ event database.

### 2.1 Searching & Filtering

- **Search box:** Type part of an event to find it (e.g., "moon landing").
- **Filters:**
  - **Era:** Ancient / Medieval / Modern (based on event `year` or metadata).
  - **Usage:**
    - "Unused in Classic" – events not yet tied to any Classic puzzle.
    - "Unused in Order" – events not yet tied to any Order puzzle.
- Use these filters to find fresh content for upcoming puzzles or to spot coverage gaps.

### 2.2 Editing Events

- Click an event’s text to edit typos or wording inline.
- Keep changes minimal: fix grammar/clarity without adding year-specific spoilers.
- The `year` field should only be changed in coordination with engineering (it affects scoring and leak risk).

### 2.3 Deleting Events

- Deletion is intended for low-quality or unsafe events (e.g., wrong facts, PII).
- Prefer to delete events **only if they are unused** in the relevant mode:
  - Check usage columns or tooltips before deleting.
- If an event is already used in puzzles, consult with engineering before removal to avoid inconsistencies.

### 2.4 Common Workflows

- **Find events to backfill a weak era:**
  - Filter by era (e.g., Ancient) and usage (unused in Classic).
  - Export or note candidate events for targeted generation/backfill.
- **Clean up obviously wrong events:**
  - Search for suspicious phrases, edit for correctness, or delete if unsalvageable.

---

## 3. Puzzles Tab

History and details of daily puzzles for both game modes.

### 3.1 Switching Modes

- Use the mode toggle at the top of the Puzzles tab to switch between **Classic** and **Order** puzzle lists.
- Each row represents a single daily puzzle for that mode.

### 3.2 Puzzle List & Detail View

- Columns typically include: puzzle number, date, and a short summary.
- Click a row to open the puzzle detail modal.
- **Classic puzzle details:**
  - Target year.
  - List of 6 events used as hints.
  - Historical context snippet.
  - Player stats (play count, completion rate, average guesses).
- **Order puzzle details:**
  - List of events with their years and positions.
  - Event span (earliest–latest).
  - Player stats (play count, completion rate, average score).

### 3.3 Common Workflows

- **Verify a specific puzzle:**
  - Filter or scroll to the puzzle number/date in question.
  - Open detail view and confirm events, year, and context look correct.
- **Investigate player complaints:**
  - Use date or puzzle number to find the puzzle.
  - Check event list and context for factual errors or confusing events.
  - If necessary, coordinate with engineering to correct future generations.

---

## 4. Troubleshooting

### 4.1 "Pool Depletion Imminent" Alert

- **Cause:** Unused event count dropped below 30 days runway for the selected mode.
- **Action:**
  - Confirm Pool Health card shows red and which mode is affected.
  - Check **Recent Generations** for errors (e.g., "Rate Limit", "Payment Required").
  - If cron is failing, you can manually trigger generation via CLI:
    - `npx convex run actions/eventGeneration/orchestrator:generateDailyBatch --args '{"targetCount": 10}'`

### 4.2 High Cost / Low Quality

- **Cost Spike:**
  - Look at Cost Trends; if a single day or stage spikes, confirm whether a deployment changed prompts or batch size.
- **Quality Drop:**
  - Check Quality Metrics and Recent Generations for an increase in failed generations or low scores.
- **Action:**
  - Escalate to engineering with specific dates, affected years, and screenshots of the dashboard panels.

### 4.3 Charts or Tables Empty

- If Overview charts are empty:
  - Verify that the `generation_logs` table is being populated (cron must be running).
- If Events/Puzzles data looks stale:
  - Confirm that daily cron jobs and event generation batches have been running in the last 24 hours.
