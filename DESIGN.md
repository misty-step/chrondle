# DESIGN: Test Coverage Visibility & Enforcement

## Architecture Overview

**Selected Approach**: PR Comments + Committed Badge (Stateless CI)

**Rationale**: Coverage branches are anti-pattern (hidden state, permission escalation). Committing badge to repo keeps CI pure - outputs are visible artifacts, not orphan refs.

**Core Modules**:

- **CI Coverage Step**: Runs Vitest coverage, produces `coverage-summary.json`
- **PR Comment Action**: Posts coverage delta on PRs via `vitest-coverage-report-action`
- **Badge Generator**: Creates SVG badge, commits to `public/badges/` on main push

**Data Flow**:

```
Test Run → coverage-summary.json → PR Comment (on PR)
                                 → Badge SVG (on main push) → README display
```

**Key Design Decisions**:

1. **Stateless CI**: No coverage branches, no external services, no secrets beyond `GITHUB_TOKEN`
2. **Ratchet via Vitest**: Thresholds in `vitest.config.ts` already enforce regression blocking (14/25/65/14)
3. **Badge in repo**: `public/badges/coverage.svg` auto-committed on main, README references raw GitHub URL

---

## Module Design

### Module: CI Coverage Pipeline

**Responsibility**: Orchestrate coverage generation, reporting, and badge updates in GitHub Actions.

**Interface** (CI workflow additions):

```yaml
# After test step in quality-checks job
- name: Coverage Report
  if: matrix.check == 'test' && github.event_name == 'pull_request'
  uses: davelosert/vitest-coverage-report-action@v2

- name: Generate Coverage Badge
  if: matrix.check == 'test' && github.ref == 'refs/heads/master'
  run: npx make-coverage-badge --output-path public/badges/coverage.svg

- name: Commit Badge
  if: matrix.check == 'test' && github.ref == 'refs/heads/master'
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git add public/badges/coverage.svg
    git diff --staged --quiet || git commit -m "chore: update coverage badge [skip ci]"
    git push
```

**Dependencies**:

- Requires: `coverage-summary.json` from test run
- Used by: README badge display

**Error Handling**:

- Missing coverage file → Action fails gracefully with warning
- Badge commit fails → Non-blocking (badge stale until next main push)
- Git push race → `[skip ci]` prevents loop, stale badge acceptable

### Module: Vitest Coverage Config

**Responsibility**: Enforce coverage thresholds and produce reports in expected format.

**Interface** (already exists, verify complete):

```typescript
// vitest.config.ts coverage section
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html", "json-summary"],  // json-summary required
  reportOnFailure: true,  // NEW: report even on test failure
  thresholds: {
    lines: 14,
    functions: 25,
    branches: 65,
    statements: 14,
  },
}
```

**Data Structures**:

```typescript
// coverage-summary.json (produced by Vitest)
interface CoverageSummary {
  total: {
    lines: { pct: number };
    statements: { pct: number };
    functions: { pct: number };
    branches: { pct: number };
  };
}
```

### Module: README Badge

**Responsibility**: Display current coverage percentage with color coding.

**Interface**:

```markdown
## Quality

![Coverage](https://raw.githubusercontent.com/misty-step/chrondle/master/public/badges/coverage.svg)
```

**Badge Generation**:

```
make-coverage-badge reads coverage-summary.json
  → produces SVG with percentage
  → color: red (<50%), yellow (50-79%), green (>=80%)
```

---

## File Changes

### Modified Files

**`.github/workflows/ci.yml`** - Add coverage action and badge generation

```yaml
# After line 143 (Run tests with coverage step)
- name: Coverage Report
  if: matrix.check == 'test' && github.event_name == 'pull_request'
  uses: davelosert/vitest-coverage-report-action@v2
  with:
    vite-config-path: vitest.config.ts
    github-token: ${{ secrets.GITHUB_TOKEN }}
    file-coverage-mode: changes

- name: Generate Coverage Badge
  if: matrix.check == 'test' && github.ref == 'refs/heads/master'
  run: npx make-coverage-badge --output-path public/badges/coverage.svg

- name: Commit Coverage Badge
  if: matrix.check == 'test' && github.ref == 'refs/heads/master'
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git add public/badges/coverage.svg
    git diff --staged --quiet || git commit -m "chore: update coverage badge [skip ci]"
    git push
```

**`vitest.config.ts`** - Add `reportOnFailure: true`

```typescript
coverage: {
  // ... existing config ...
  reportOnFailure: true,  // ADD THIS LINE
}
```

**`package.json`** - Add dev dependency

```json
"devDependencies": {
  "make-coverage-badge": "^1.2.0"
}
```

**`README.md`** - Add badge after title

```markdown
# Chrondle: The Daily History Game

![Coverage](https://raw.githubusercontent.com/misty-step/chrondle/master/public/badges/coverage.svg)
```

### New Files

**`public/badges/.gitkeep`** - Ensure directory exists

```
# Coverage badge stored here (auto-generated)
```

**`public/badges/coverage.svg`** - Auto-generated on first main push

```svg
<!-- Generated by make-coverage-badge -->
```

---

## Implementation Sequence

```pseudocode
Phase 1: Local Setup
  1. Add make-coverage-badge to devDependencies
     → pnpm add -D make-coverage-badge

  2. Create public/badges/ directory
     → mkdir -p public/badges
     → echo "# Coverage badge (auto-generated)" > public/badges/.gitkeep

  3. Add reportOnFailure to vitest.config.ts
     → Edit coverage section

  4. Verify badge generation works locally
     → pnpm test:coverage
     → npx make-coverage-badge --output-path public/badges/coverage.svg
     → Confirm SVG created

Phase 2: CI Integration
  5. Add PR comment step to ci.yml
     → After test step, conditional on PR event

  6. Add badge generation + commit steps to ci.yml
     → After test step, conditional on master push

  7. Add badge to README
     → Raw GitHub URL for SVG display

Phase 3: Verification
  8. Create test PR
     → Verify coverage comment appears
     → Verify thresholds block regression

  9. Merge to master
     → Verify badge committed
     → Verify README displays badge
```

---

## Testing Strategy

**Manual Verification**:

1. Create PR with test changes → confirm comment appears
2. Create PR dropping coverage → confirm CI blocks
3. Merge to master → confirm badge generated
4. View README on GitHub → confirm badge renders

**No automated tests needed**: This is CI infrastructure, not application code. Verification is the PR/merge workflow itself.

---

## Error Handling

| Scenario                | Behavior                                   | Recovery                   |
| ----------------------- | ------------------------------------------ | -------------------------- |
| Tests fail              | Coverage still generated (reportOnFailure) | Review test failures       |
| Badge commit race       | [skip ci] prevents loop                    | Badge updates on next push |
| Missing coverage file   | Action warns, PR still passes              | Ensure test step ran       |
| GitHub token lacks push | Badge step fails                           | Check repo permissions     |

---

## Security Considerations

- **No secrets exposed**: Only `GITHUB_TOKEN` used, scoped to repo
- **No external services**: All tools run in GitHub Actions
- **Badge URL public**: Raw GitHub URL, no auth needed
- **[skip ci] loop prevention**: Badge commits don't trigger new runs

---

## Alternatives Considered

### Alternative A: Coverage Branch

- Store coverage on `gh-pages` or `coverage` branch
- **Rejected**: Hidden global state, requires branch protection bypass, orphan branch management

### Alternative B: External Badge Service (shields.io)

- Dynamic badge from external API
- **Rejected**: External dependency, rate limits, potential downtime, no cost advantage

### Alternative C: Codecov/Coveralls

- Full coverage platform integration
- **Rejected**: External service, requires API keys, overkill for simple percentage display

**Selected**: Committed badge + PR comments

- Zero external dependencies
- Stateless CI
- Visible artifacts in repo
- Cost: $0
