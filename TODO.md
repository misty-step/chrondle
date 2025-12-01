# TODO: Test Coverage Visibility

## Context

- Architecture: Stateless CI - PR comments + committed badge (DESIGN.md)
- Key Files: `.github/workflows/ci.yml`, `vitest.config.ts`, `README.md`, `public/badges/`
- Patterns: Existing CI workflow structure (matrix jobs, conditional steps)

## Implementation Tasks

- [x] Add make-coverage-badge dependency
- [x] Create badges directory with placeholder
- [x] Add reportOnFailure to vitest coverage config
- [x] Add PR coverage comment step to CI
- [x] Add badge generation and commit steps to CI
- [x] Add coverage badge to README

## Verification (manual, post-merge)

- Create test PR → coverage comment appears
- Merge to master → badge committed
- View README → badge displays

## Total Estimate: ~50 minutes
