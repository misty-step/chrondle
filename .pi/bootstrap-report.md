# Pi Bootstrap Report

- Domain: chrondle
- Repo: /Users/phaedrus/Development/chrondle
- Generated: 2026-03-02T00:54:23.494Z
- Package manager: bun
- Stack hints: convex, nextjs, react, tailwindcss, typescript, vitest

## Notes

- Fallback plan used because synthesis was unavailable or invalid.

## Repository Context Digest

contextSnippets:
[AGENTS.md]

# Repository Guidelines

## Project Structure & Module Organization

- `src/app` houses Next.js route groups per layout; `src/components` stores UI modules (PascalCase files, scoped folders like `ui/`, `providers/`); `src/lib` keeps domain logic and shared utilities; `src/hooks` for stateful abstractions.
- Convex backend logic lives in `convex/` (mutations, cron, schema). Shared types reside in `src/types`; Tailwind tokens live in `src/styles`; static assets in `public/`; scripts and quality checks in `scripts/`.
- Tests colocate with features (`src/components/__tests__`, `src/test/setup.ts`); end-to-end scaffolding sits in `e2e/`; operational playbooks and ADRs live in `docs/`.

## Build, Test, and Development Commands

- Use `pnpm install` (guarded by `npx only-allow pnpm`) and Node 20 via `nvm use`.
- `pnpm dev` boots Next with Turbopack; `pnpm dev:full` also runs Convex (`npx convex dev`) for full-stack testing.
- `pnpm build` then `pnpm start` for production preview; `pnpm bundle-analysis` with `ANALYZE=true` inspects bundle health.
- Guardrails: `pnpm lint`, `pnpm lint:fix`, `pnpm type-check`, `pnpm size`, `pnpm ts-prune`, `pnpm unimported`, `pnpm quality` (cache + dependency audit).
- Tests: `pnpm test`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:watch`, `pnpm test:coverage`.

## Coding Style & Naming Conventions

- Stack: TypeScript + React 19 + Next 15; design deep modules that hide implementation and expose intention.
- Prettier (`pnpm format`) enforces

[CLAUDE.md]

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
- Game state derivation: Pure functional via `deriveGameState` in `src/lib/gameState.t

.claude inventory:
.claude/context.md, .claude/settings.local.json, .claude/commands/more-puzzles.md

.codex inventory:
(none)

.pi inventory:
.pi/state/session-handoff.json, .pi/state/session-handoff.ndjson

scripts inventory:
scripts/.eslintrc.json, scripts/audit-events.ts, scripts/backfill-event-metadata.ts, scripts/benchmark-models.ts, scripts/check-cache-age.mjs, scripts/check-convex-state.mjs, scripts/check-deployment-ready.mjs, scripts/cleanup-puzzles.mjs, scripts/CLI_USAGE.md, scripts/cost-analysis.ts, scripts/create-daily-puzzle.mjs, scripts/diagnose-vercel-failure.mjs, scripts/fix-schema.mjs, scripts/load-test-batch.ts, scripts/manage-events.ts, scripts/migrate-year-events.mjs, scripts/quality-audit-sampler.ts, scripts/quality-report.mjs, scripts/README.md, scripts/run-evals.ts, scripts/synthesize-release-notes.mjs, scripts/test-convex-connection.mjs, scripts/test-convex.mjs, scripts/test-event-generation-bulk.ts, scripts/test-event-generation.ts, scripts/test-module-system.mjs, scripts/test-responses-api.ts, scripts/upload-langfuse-prompts.ts, scripts/verify-auth-production.mjs, scripts/verify-convex-files.mjs, scripts/verify-deployment.mjs, scripts/verify-env-config.mjs, scripts/verify-stripe-config.mjs, scripts/verify-vercel-env.mjs, scripts/verify-webhook-config.sh, scripts/WORKFLOW.md

## Single Highest-Leverage Addition

- Idea: Establish a minimal planner -> worker -> reviewer local workflow loop that compounds repo familiarity through memory-first context reuse.
- Source lane: ambition-pass
- Why now: This creates immediate throughput gains with low maintenance while preserving room for optional advanced overlays.
- 72h validation experiment: Run this bootstrap on two active tasks, then compare plan-to-merge latency and rework churn against the prior baseline.
- Kill criteria: If cycle time or defect/rework metrics worsen by more than 15%, roll back to prior local config and revisit assumptions.

## Lane Evidence

## repo-scout

- model: openai-codex/gpt-5.3-codex
- thinking: xhigh
- status: ok
- elapsed: 11s

(no output)

---

## context-bridge

- model: openrouter/anthropic/claude-sonnet-4.6
- thinking: high
- status: ok
- elapsed: 88s

Now I have a comprehensive picture. Let me synthesize the full analysis.

---

## Existing Context Signals

### Signal Map

| Source                             | Content Quality                                                                              | Staleness Risk                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `CLAUDE.md`                        | 🟢 Rich — scoring formulas, arch decisions, Stripe incident, dev commands, stack constraints | Medium (refs GPT-5/Gemini 3 preview models) |
| `.claude/context.md`               | 🟡 Useful — Convex patterns, LocalStorage keys, BC/AD logic                                  | Low (stable patterns)                       |
| `.claude/commands/more-puzzles.md` | 🟢 Dense — full ChronBot workflow, event quality standards, CLI tooling                      | Low                                         |
| `AGENTS.md`                        | 🟡 Partially stale — says `pnpm`/Node 20, but project uses `bun` (conflict)                  | High                                        |
| `GEMINI.md`                        | 🟡 Thin — setup/architecture overview, design token system                                   | Low                                         |
| `.pi/state/`                       | 🔵 Shell only — session JSON is empty/fresh, ndjson has one start event                      | N/A                                         |
| `.groom/retro.md`                  | 🟢 Single retro entry (issue #193, PostHog proxy)                                            | N/A                                         |
| `.design-catalogue/HANDOFF.md`     | 🟡 Active design task in-flight (8 proposals needed, 1 exists)                               | Active                                      |
| `.triage.json`                     | 🟢 Minimal — health endpoint URL only                                                        | Stable                                      |
| `docs/`                            | 🟢 Rich — ADRs, architecture, debugging guides, specs                                        | Varies                                      |
| `.mcp.json`                        | 🔵 MCP tool config (exa, shadcn enabled)                                                     | N/A                                         |

### Key Conventions Extracted

1. **Package manager collision**: `AGENTS.md` says `pnpm` + Node 20; `CLAUDE.md` says `bun` (hard requirement, pnpm/npm blocked). Bun is correct.
2. **Core game invariant**: Never leak answer through UI. BC/AD toggle must never auto-select.
3. **Dead code marker**: `useChrondle` is dead; `useRangeGame` is canonical.
4. **Scoring formula**: Fully documented quadratic in `CLAUDE.md`.
5. **Convex deployment IDs**: dev=`handsome-raccoon-955`, prod=`fleet-goldfish-183`.
6. **Motion**: `motion` package only — never `framer-motion`.
7. **BC/AD format**: Enforced via `enforceADBC()`, never BCE/CE.
8. **Test thresholds**: CI 25ms vs local 16ms.
9. **Stripe webhook incident**: POST redi…

---

## docs-research

- model: openrouter/google/gemini-3.1-pro
- thinking: high
- status: ok
- elapsed: 99s

## High-Value References

- **Next.js 15+ App Router Caching Semantics**
  - **URL:** [https://nextjs.org/docs/app/building-your-application/data-fetching/fetching](https://nextjs.org/docs/app/building-your-application/data-fetching/fetching)
  - **Why it matters:** Next.js >= 15 reversed default caching. Native `fetch` requests, `GET` route handlers, and client navigations are un-cached by default (`no-store`). Agents no longer need to layer defensive `export const dynamic = 'force-dynamic'` or manual `cache: 'no-store'` declarations across pages to prevent stale data.

- **React 19 Forms and Actions (`useActionState`, `useFormStatus`)**
  - **URL:** [https://react.dev/blog/2024/12/05/react-19](https://react.dev/blog/2024/12/05/react-19)
  - **Why it matters:** React 19 entirely deprecates boilerplate `useState` / `useEffect` patterns for handling forms. Agents can exclusively generate `<form action={...}>` alongside `useActionState` for pending states and data mutations, significantly reducing lines of code and state synchronization bugs.

- **Convex React 19 Server Components Paradigm**
  - **URL:** [https://docs.convex.dev/react/react-19](https://docs.convex.dev/react/react-19)
  - **Why it matters:** Convex cleanly maps to React 19 boundaries. Agents must distinguish workflows: static/initial reads should occur in Next.js Server Components using `fetchQuery`, while real-time reactivity remains inside Client Components via `useQuery`. Misinterpreting these boundaries causes heavy hydration mismatch loops.

- **Tailwind CSS v4 Configuration**
  - **URL:** [https://tailwindcss.com/blog/tailwindcss-v4](https://tailwindcss.com/blog/tailwindcss-v4)
  - **Why it matters:** v4 pivots from `tailwind.config.*` ASTs to native CSS variables natively compiled via `@theme`. Agentic manipulation of design tokens should target `globals.css` variable insertions rather than attempting to mutate complex configuration logic.

- \*\*Bun test…

---

## workflow-critic

- model: openrouter/anthropic/claude-sonnet-4.6
- thinking: high
- status: ok
- elapsed: 146s

Now I have everything I need for a sharp, evidence-driven review. Here it is:

---

## Critical Failure Modes

### 1. **Live production secrets committed to git** — `.env.production` and `.env.vercel`

These files are on disk, not gitignored as tracked files, and contain:

```
CLERK_SECRET_KEY="sk_live_0hcfCIf..."
CONVEX_DEPLOY_KEY="prod:fleet-goldfish-183|eyJ..."
STRIPE_SECRET_KEY="sk_live_51SV2rA..."
STRIPE_WEBHOOK_SECRET="whsec_xq23..."
OPENROUTER_API_KEY="sk-or-v1-c01142..."
```

The `.gitignore` lists `.env.production` and `.env.vercel` but the files are local — if they were ever accidentally staged (e.g. `git add .`), the pre-commit secret scan **would not catch them**: OpenRouter `sk-or-v1-` and Convex `prod:...|...` formats are absent from `SECRET_PATTERNS`. Neither the commit hook nor the CI scan covers these key formats.

**Risk**: One `git add .` from a clean working tree → full production credential exposure on push before CI runs.

### 2. **Deploy runs in parallel with CI, not after it**

`deploy.yml` triggers on `push` to `master` with no `workflow_run` gate or `needs` dependency on `ci.yml`. So a push to master launches deploy and CI simultaneously. A broken build, failing test, or type error will be caught _after_ the bad code is already deployed to production Convex and Vercel.

**Evidence**: `deploy.yml` `on.push.branches: [main, master]` — no `workflow_run` gating on ci.yml completion.

### 3. **`validate-puzzles` CI job silently passes when Convex is unreachable**

In `check-convex-state.mjs`:

```js
if (!CONVEX_URL) {
  console.log("Skipping Convex validation in CI environment");
  process.exit(0); // ← exits 0, green check
}
```

The `validation` job in CI provides **no** `NEXT_PUBLIC_CONVEX_URL` env var, so puzzle validation is a guaranteed no-op on every CI run. The job always passes and provides zero integrity signal.

### 4. **E2E tests run against DEV Convex, but the build artifact was compiled against PROD**

The CI `build` job hardcodes `NE…

---

## ambition-pass

- model: openrouter/google/gemini-3-flash-preview
- thinking: high
- status: ok
- elapsed: 32s

To optimize for high-quality agentic engineering throughput in **Chrondle**, we move beyond mere automation toward **Autonomous Quality Self-Correction**.

The repository already possesses a sophisticated suite of verification scripts and evaluation harnesses. The "ambition-pass" move is to close the loop: making the agent not just a code-writer, but a **Guardian of Game Integrity** that updates its own "mental model" based on automated quality failures.

## Foundation Workflow Pattern: "The Loop"

Integrate **Eval-Driven Development (EDD)** into the core `pnpm dev` or `git push` flow.

1.  **Continuous Simulation**: Every significant logic change (`src/lib`, `convex/`) triggers a headless simulation of the game using the current "Integrity Rules" (from `CLAUDE.md`).
2.  **Constraint Triage**: If the simulator detects a "UI Tell" (e.g., an era suggestion appearing too early), it doesn't just fail; it generates a **Triage Report** (`.triage.json`) mapping the failure to specific `CLAUDE.md` violations.
3.  **Instruction Injection**: The agent reads `.triage.json` on the next start to "patch" its own strategy before writing more code.

## Prompt + Pipeline Ideas

- **`/enforce-integrity` Skill**: A specialized prompt that audits the current diff against the "Puzzle Integrity" section of `CLAUDE.md`. It uses an LLM-as-a-Judge to look for sub-perceptual leaks (e.g., "The hint text for ancient events is shorter than modern ones").
- **"Ghost Player" Integration**: A Vitest environment that uses an LLM agent to _try_ to cheat at the game. If the "Ghost Player" can guess the AD/BC era without using the hint system, the PR is blocked.

## Minimal Viable Bootstrap vs Optional Upgrades

| Category      | Minimal Viable Bootstrap (Must-Have) | Optional Upgrades (Refinement)                               |
| :------------ | :----------------------------------- | :----------------------------------------------------------- |
| **Logic**     | Manual `pnpm quality` check on PR.   | **Auto-Triage**: Failing tests write to `.pi/local-context`. |
| **Integrity** | `CLAUDE.md` reading.                 | **Semantic Linting**: Custom…                                |

---

## implementation-critic

- model: openrouter/anthropic/claude-sonnet-4.6
- thinking: xhigh
- status: ok
- elapsed: 132s

---

## Durability Risks

### 1. Package-manager schizophrenia — active, silent sabotage risk

The repo uses **Bun** (`bun.lock`, `.bun-version: 1.3.9`, all `package.json` scripts use `bun run`/`bunx`). But `AGENTS.md` instructs agents to use **pnpm** throughout — `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm lint`, etc. — and claims `pnpm` is "guarded by `npx only-allow pnpm`".

`settings.local.json` has **55 pnpm allow-list entries and 0 bun entries**, meaning any agent using the tool permission list as a command guide will be systematically wrong. `CLAUDE.md` correctly says "Bun (pnpm/npm blocked)" but AGENTS.md directly contradicts it. Six months from now, a fresh agent reading only AGENTS.md will silently use the wrong package manager.

### 2. CLAUDE.md references three non-existent artifacts

- `~/.claude/skills/billing-security/` — does not exist; `/stripe-health` and `/billing-preflight` are cited as runnable commands but are nowhere on disk.
- `CLAUDE.archive.md` — cited as the "full 1,091-line original guide"; does not exist.
- `BACKLOG.md` — cited as "prioritized issues + estimates"; does not exist.

Any operator following the billing runbook during an incident will hit dead paths at the worst possible moment.

### 3. `.claude/context.md` line count is 9× overstated

CLAUDE.md states "1,246 lines of discovered patterns." Actual file: **136 lines**, last modified December 10. The archive link it points to (`docs/archive/context_archive_2025-12.md`) may or may not exist but was not enumerated. Stale line-count claims signal the doc is not being maintained in sync with the file, which erodes trust in all other quantitative claims.

### 4. Scoring formula documented in CLAUDE.md diverges from actual code

CLAUDE.md documents a **quadratic** `widthFactor` formula:

```
widthFactor = 1 - ((width - 1) / (W_MAX - 1))² * (1 - MIN_WIDTH_FACTOR_FLOOR)
```

`src/lib/scoring.ts` implements a **linear** `progress`-based formula:

```ts
const widthFactor = 1 - progress * (1…

## Quality Gate Scorecard
- Gate pass: yes
- Ambition score: 85/100 (pass)
  - novelty: 5/5
  - feasibility: 4/5
  - evidence: 5/5
  - rollbackability: 3/5
- Consensus score: 96/100 (pass)
```
