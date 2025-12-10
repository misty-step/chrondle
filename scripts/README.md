# Scripts Directory

Automation utilities for Chrondle development, deployment, and maintenance.

## Event Management

| Script                       | Purpose                                | Usage                                         |
| ---------------------------- | -------------------------------------- | --------------------------------------------- |
| `manage-events.ts`           | **Main CLI** for event CRUD operations | `pnpm events [command]`                       |
| `audit-events.ts`            | Audit event database quality           | `pnpm tsx scripts/audit-events.ts`            |
| `backfill-event-metadata.ts` | Backfill missing event metadata        | `pnpm tsx scripts/backfill-event-metadata.ts` |
| `quality-audit-sampler.ts`   | Sample-based quality auditing          | `pnpm tsx scripts/quality-audit-sampler.ts`   |
| `quality-report.mjs`         | Generate quality reports               | `node scripts/quality-report.mjs`             |

## Event Generation & Testing

| Script                          | Purpose                      | Usage                                            |
| ------------------------------- | ---------------------------- | ------------------------------------------------ |
| `test-event-generation.ts`      | Test single event generation | `pnpm tsx scripts/test-event-generation.ts`      |
| `test-event-generation-bulk.ts` | Test bulk event generation   | `pnpm tsx scripts/test-event-generation-bulk.ts` |
| `load-test-batch.ts`            | Load test batch processing   | `pnpm tsx scripts/load-test-batch.ts`            |
| `benchmark-models.ts`           | Benchmark LLM models         | `pnpm tsx scripts/benchmark-models.ts`           |
| `cost-analysis.ts`              | Analyze generation costs     | `pnpm tsx scripts/cost-analysis.ts`              |

## Deployment & Verification

| Script                        | Purpose                      | Usage                                      |
| ----------------------------- | ---------------------------- | ------------------------------------------ |
| `verify-deployment.mjs`       | Post-deployment verification | `pnpm deploy:verify`                       |
| `check-deployment-ready.mjs`  | Pre-deployment checks        | `node scripts/check-deployment-ready.mjs`  |
| `diagnose-vercel-failure.mjs` | Debug Vercel failures        | `node scripts/diagnose-vercel-failure.mjs` |
| `verify-auth-production.mjs`  | Verify production auth       | `pnpm verify:auth:prod`                    |

## Convex Database

| Script                       | Purpose                       | Usage                                     |
| ---------------------------- | ----------------------------- | ----------------------------------------- |
| `check-convex-state.mjs`     | Check Convex deployment state | `node scripts/check-convex-state.mjs`     |
| `verify-convex-files.mjs`    | Verify Convex file integrity  | `node scripts/verify-convex-files.mjs`    |
| `test-convex-connection.mjs` | Test Convex connectivity      | `node scripts/test-convex-connection.mjs` |
| `test-convex.mjs`            | General Convex testing        | `node scripts/test-convex.mjs`            |

## Data Maintenance

| Script                    | Purpose                      | Usage                                  |
| ------------------------- | ---------------------------- | -------------------------------------- |
| `create-daily-puzzle.mjs` | Create daily puzzle          | `node scripts/create-daily-puzzle.mjs` |
| `cleanup-puzzles.mjs`     | Clean up puzzle data         | `node scripts/cleanup-puzzles.mjs`     |
| `migrate-year-events.mjs` | Migrate events between years | `node scripts/migrate-year-events.mjs` |
| `fix-schema.mjs`          | Fix schema issues            | `node scripts/fix-schema.mjs`          |

## Development Utilities

| Script                   | Purpose                       | Usage                                    |
| ------------------------ | ----------------------------- | ---------------------------------------- |
| `check-cache-age.mjs`    | Check build cache age         | `pnpm check-cache`                       |
| `test-module-system.mjs` | Test module resolution        | `pnpm test-module-system`                |
| `test-responses-api.ts`  | Test OpenRouter Responses API | `pnpm tsx scripts/test-responses-api.ts` |

## Documentation

- `CLI_USAGE.md` - Detailed CLI command documentation
- `WORKFLOW.md` - Event curation workflow guide

## File Extensions

- `.ts` - TypeScript (run with `pnpm tsx scripts/[name].ts`)
- `.mjs` - ES Modules (run with `node scripts/[name].mjs`)

## Package.json Scripts

Key npm scripts that wrap these utilities:

```bash
pnpm events              # Event management CLI
pnpm events:audit        # Run event audit
pnpm deploy:verify       # Verify deployment
pnpm verify:auth:prod    # Verify production auth
pnpm check-cache         # Check cache age
```
