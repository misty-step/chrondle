# Product Strategy

_Extracted from external consultant analysis (December 2025)_

---

## North Star Metric

**Weekly Active Solvers (WAS)** = unique users who complete ≥1 puzzle in the last 7 days.

### Supporting Metrics

| Metric           | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| Activation       | % of new users who complete a puzzle on day 1              |
| D1/D7 retention  | Classic daily game benchmarks                              |
| Share rate       | % of completions that generate a share action              |
| Streak integrity | % of streak disputes / support pings (should be near zero) |
| Content quality  | % puzzles flagged / corrected, average confidence rating   |

---

## Positioning

### One-Sentence Pitch

**"A daily history game where you score more by narrowing the year—like golf for time."**

### Positioning Statement

_Chrondle is the daily time-travel puzzle that rewards how well you can calibrate your historical confidence—guess tight ranges, use fewer clues, learn something new in 3 minutes._

---

## Target Personas

### Primary: Daily Puzzle Natives

- Already plays Wordle/Connections/mini
- Likes sharing results
- "History" is a spice, not homework

### Secondary: History-Curious Adults

- Interested in learning something new each day
- Appreciates the educational aspect
- May play less consistently but engages deeply

### Future Expansion: Teachers

- Classroom "bell ringer" activity
- Values student engagement tools
- Needs assignment/tracking features

### Niche: Trivia Competitors

- Pub quiz people, trivia enthusiasts
- Good sharers and evangelists
- Attracted by scoring mechanics

---

## Differentiation Vectors

### 1. Range-Based Scoring ("Golf for Uncertainty")

Most "guess the year" games are binary or closeness-based. Chrondle rewards _confidence calibration_ (narrower ranges score higher, hints cap max). This is genuinely different and easy to explain.

### 2. Two Complementary Modes

Chronle/Chronoodle specialize in ordering; Histordle specializes in year guessing. Chrondle offers both, reducing churn ("if one mode is frustrating today, play the other").

### 3. Content Pipeline + Admin Ops

Most indie dles die because content ops becomes a grind. Chrondle has admin cost/quality observability and an AI-backed generation pipeline.

### 4. BC Support + Era UX

Many competitors avoid BC because it complicates UI. Chrondle handles it technically.

---

## Competitor Landscape

### Direct Competitors (Very Close Mechanic)

| Competitor           | Mechanic               | Notes                                           |
| -------------------- | ---------------------- | ----------------------------------------------- |
| Chronle              | Chronological ordering | Drag handles, limited moves, midnight UTC reset |
| Chronoodle           | Timeline placement     | "Between now and the big bang," themed puzzles  |
| Histordle / Histodle | Guess-the-year         | Daily history variants                          |
| Whendle              | Guess when it happened | Similar year-guessing mechanic                  |

### Adjacent Alternatives

- NYT Games (Wordle/Connections) as default daily puzzle habit
- Sporcle / trivia sites, YouTube "history shorts", Wikipedia "On this day"

### Substitutes

- Any "daily brain snack" (crosswords, mini games, Duolingo-style streak apps)

---

## Monetization Options

### Phase 1: Prove Retention (Now)

No paywall. Maximize share + habit formation.

### Phase 2: Monetize Power Users

**Subscription: $4.99/mo or $29/yr**

| Free          | Paid              |
| ------------- | ----------------- |
| Daily puzzles | Full archive      |
| 7-day archive | Themed packs      |
| Basic stats   | Advanced stats    |
|               | Streak protection |
|               | Custom puzzles    |

**Sponsorship:** 1/week sponsor slot once DAU justifies it ("Today's puzzle brought to you by...")

### Phase 3: Expansion

- **Teacher licenses**: Per teacher ($5-15/mo) or per school
- **Creator marketplace**: Community-authored themed packs; revenue share (requires moderation tooling)

---

## Go-to-Market Channels

### High Leverage (Early)

1. **Daily game aggregators** — EveryDle-style sites list games and send steady trickle traffic
2. **SEO via archive pages** — Each archived puzzle becomes a landing page with indexable metadata (theme, era, events)
3. **Share loops** — Improve share text with mode badge, score, short CTA

### Medium-Term

4. **Communities** — Reddit: r/dailygames, r/trivia, r/history, r/sideproject
5. **Partnerships** — History YouTubers / podcasters / newsletters: "Chrondle of the week"

### Expansion

6. **Schools** — Teacher Twitter / history teacher communities once classroom mode exists

---

## Risk Register

| Risk                                                    | Mitigation                                               |
| ------------------------------------------------------- | -------------------------------------------------------- |
| Content quality inconsistency (AI errors kill trust)    | Corrections queue + visible changelog + quality sampling |
| Streak/timezone bugs (daily games live/die on fairness) | Unified date semantics + countdown timer                 |
| Competitors are entrenched                              | Differentiate on range scoring + quality + social groups |
| Low share rate                                          | Better share UX (OG images, challenge links, group play) |
| Monetization backlash                                   | Keep daily free; monetize archive/themes                 |

---

## Roadmap Horizons

### 0-2 Weeks: Trust + Growth Foundation

- Security fixes (auth, privacy)
- Archive pagination
- Date reset consistency + countdown

### 2-8 Weeks: Content Quality + Theming

- Theme weeks (event tags + scheduler)
- Better onboarding (15s tutorial)
- Social loops (challenge a friend, group scoreboard)
- Quality controls for AI content (corrections queue)
- SEO expansion (indexable archive pages)

### 2-6 Months: Expansion

- Membership v1 (archive + themes paywall)
- Classroom mode (teacher ICP: assign puzzles, class completion, export scoreboard)
- UGC + moderation tooling
- Mobile wrapper / PWA polish

---

## Moats to Build

1. **High-quality, well-tagged event pool + theme system** — Defensible content advantage
2. **Social graph + group play** — "My class / my friends" creates switching costs
3. **Creator ecosystem** — If moderation tooling exists, community content compounds

---

## 1-Year Milestone Plan

### Q1: Trust + Growth Foundation

- Ship security fixes + archive pagination + reset semantics
- KPIs: D7 retention, share rate, WAS

### Q2: Content Quality + Theming

- Theme weeks + corrections workflow
- KPIs: % puzzles flagged, average solve completion rate, growth from SEO

### Q3: Monetization

- Membership v1 + premium archive
- KPIs: Conversion rate, churn, LTV

### Q4: Expansion

- Friend groups + teacher assignment MVP
- KPIs: Cohort retention + group formation rate

---

_This document synthesizes external market analysis. Update as product evolves._
