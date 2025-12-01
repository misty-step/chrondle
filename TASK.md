# Test Coverage Visibility & Enforcement

## Why This Matters

Right now, we're at 14% test coverage. That means 86% of code ships without automated verification. Recent bugs trace to untested code paths. **When the daily puzzle breaks, players lose trust and abandon streaks.**

70% coverage ensures every player gets their puzzle, every day.

---

## Executive Summary

Implement test coverage visibility through PR comments, enforce coverage thresholds via ratchet mechanism, and add one README badge. Block PRs that regress coverage.

**Success Criteria**: PR comments show coverage delta, CI blocks regressions, single badge in README.

---

## Requirements

### Functional

1. **PR Coverage Comments**

   - High-level summary (lines, branches, functions, statements)
   - Comparison against main with delta indicators (+/-%)
   - Changed files only (not full codebase breakdown)
   - Threshold pass/fail status

2. **README Coverage Badge**

   - Single badge showing overall coverage percentage
   - Color-coded: red (<50%), yellow (50-79%), green (>=80%)
   - Updated on main branch push

3. **Threshold Enforcement (Ratchet)**
   - **Immediate**: Lock at current levels (14/25/65/14) - coverage SHALL NOT decrease
   - **Target**: 70% minimum for all categories (achieved through strategic test writing)
   - PRs blocked if coverage drops below current baseline

### Non-Functional

- **Cost**: $0 (free tools only)
- **Latency**: Coverage report within 2 minutes

---

## Architecture

### Selected Approach: PR Comments + Committed Badge

**Rationale** (per architecture review):

- Coverage branch is anti-pattern (hidden global state, permission escalation)
- Committing badge to `public/badges/` keeps CI stateless
- vitest-coverage-report-action handles PR comments natively

### Implementation

```
┌─────────────────────────────────────────┐
│            Test Job (Vitest)            │
│  └─ Produces: coverage-summary.json     │
├─────────────────────────────────────────┤
│         PR: Coverage Comment            │
│  └─ vitest-coverage-report-action       │
├─────────────────────────────────────────┤
│      Main: Commit Badge to Repo         │
│  └─ public/badges/coverage.svg          │
└─────────────────────────────────────────┘
```

**No orphan branches. No hidden state. CI remains pure.**

---

## Implementation

### Step 1: Update Vitest Config

```typescript
// vitest.config.ts - thresholds section
thresholds: {
  lines: 14,        // RATCHET: current baseline
  functions: 25,    // RATCHET: current baseline
  branches: 65,     // RATCHET: current baseline
  statements: 14,   // RATCHET: current baseline
},
```

Add `reportOnFailure: true` to get reports even when tests fail.

### Step 2: Add PR Coverage Action

Add to `.github/workflows/ci.yml` after test step:

```yaml
- name: Coverage Report
  if: matrix.check == 'test' && github.event_name == 'pull_request'
  uses: davelosert/vitest-coverage-report-action@v2
  with:
    vite-config-path: vitest.config.ts
    github-token: ${{ secrets.GITHUB_TOKEN }}
    file-coverage-mode: changes
```

### Step 3: Add Badge Generation (Main Only)

```yaml
- name: Generate and commit badge
  if: matrix.check == 'test' && github.ref == 'refs/heads/master'
  run: |
    npx make-coverage-badge --output-path public/badges/coverage.svg
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git add public/badges/coverage.svg
    git diff --staged --quiet || git commit -m "chore: update coverage badge [skip ci]"
    git push
```

### Step 4: Update README

```markdown
## Quality

![Coverage](https://raw.githubusercontent.com/[owner]/chrondle/master/public/badges/coverage.svg)
```

### Step 5: Write Tests to Raise Coverage

**Priority order** (critical paths first):

1. `src/lib/gameState.ts` (0% → 80%)
2. `src/hooks/useRangeGame.ts` (core hook)
3. `src/lib/scoring.ts` (game logic)
4. Range validation functions

**Goal**: Raise ratchet thresholds as coverage improves naturally.

---

## Test Scenarios

### Coverage Reporting

- [ ] PR comment appears with coverage summary
- [ ] Delta shown vs main branch
- [ ] Changed files breakdown (not full codebase)
- [ ] CI fails when coverage drops below ratchet

### Badge

- [ ] Single badge generated on main push
- [ ] Badge updates when coverage changes
- [ ] README renders badge correctly

### Threshold (Ratchet)

- [ ] CI fails if lines < 14%
- [ ] CI fails if functions < 25%
- [ ] CI fails if branches < 65%
- [ ] CI passes when all thresholds met

---

## Known Gap

**Current**: 14% lines, 25% functions, 65% branches, 14% statements

**Target**: 70% across all categories

**Effort**: Requires writing ~200-300 tests. Estimated 2-3 week sprint of strategic TDD rewrites, not "write tests to hit numbers."

**Approach**: Test-first discipline for new features. Rewrite one critical module per week with TDD until 70% achieved naturally.

---

## Dependencies

- `davelosert/vitest-coverage-report-action@v2` - PR comments
- `make-coverage-badge` - SVG badge generation (dev dependency)

---

## File Changes

### Modified

- `vitest.config.ts` - Ratchet thresholds, reportOnFailure
- `.github/workflows/ci.yml` - Add coverage action + badge commit
- `README.md` - Add single coverage badge
- `package.json` - Add make-coverage-badge

### New

- `public/badges/coverage.svg` - Auto-generated, committed

---

## Acceptance Criteria

- [ ] PRs show coverage comment with summary + changed files
- [ ] Coverage comparison to main branch visible
- [ ] CI blocks PRs that drop below current coverage
- [ ] Single README badge displays and updates
- [ ] Thresholds ratchet up as coverage improves

---

## Out of Scope (Future Work)

- E2E tests with Playwright (separate initiative after 70% achieved)
- File-by-file breakdown beyond changed files
- Multiple badges (lines/branches/functions/statements)
- Coverage branch hosting
