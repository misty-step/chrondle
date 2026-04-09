# Scripts Directory

Automation utilities for Chrondle development, deployment, and maintenance.

## Event Management

| Script                       | Purpose                                | Usage                                         |
| ---------------------------- | -------------------------------------- | --------------------------------------------- |
| `manage-events.ts`           | **Main CLI** for event CRUD operations | `bun run events [command]`                    |
| `audit-events.ts`            | Audit event database quality           | `bunx tsx scripts/audit-events.ts`            |
| `backfill-event-metadata.ts` | Backfill missing event metadata        | `bunx tsx scripts/backfill-event-metadata.ts` |
| `quality-audit-sampler.ts`   | Sample-based quality auditing          | `bunx tsx scripts/quality-audit-sampler.ts`   |
| `quality-report.mjs`         | Generate quality reports               | `bun scripts/quality-report.mjs`              |

## Event Generation & Testing

| Script                          | Purpose                      | Usage                                            |
| ------------------------------- | ---------------------------- | ------------------------------------------------ |
| `test-event-generation.ts`      | Test single event generation | `bunx tsx scripts/test-event-generation.ts`      |
| `test-event-generation-bulk.ts` | Test bulk event generation   | `bunx tsx scripts/test-event-generation-bulk.ts` |
| `load-test-batch.ts`            | Load test batch processing   | `bunx tsx scripts/load-test-batch.ts`            |
| `benchmark-models.ts`           | Benchmark LLM models         | `bunx tsx scripts/benchmark-models.ts`           |
| `cost-analysis.ts`              | Analyze generation costs     | `bunx tsx scripts/cost-analysis.ts`              |

## Deployment & Verification

| Script                        | Purpose                      | Usage                                     |
| ----------------------------- | ---------------------------- | ----------------------------------------- |
| `verify-deployment.mjs`       | Post-deployment verification | `bun run deploy:verify`                   |
| `check-deployment-ready.mjs`  | Pre-deployment checks        | `bun scripts/check-deployment-ready.mjs`  |
| `diagnose-vercel-failure.mjs` | Debug Vercel failures        | `bun scripts/diagnose-vercel-failure.mjs` |
| `verify-auth-production.mjs`  | Verify production auth       | `bun run verify:auth:prod`                |

## Convex Database

| Script                       | Purpose                       | Usage                                    |
| ---------------------------- | ----------------------------- | ---------------------------------------- |
| `check-convex-state.mjs`     | Check Convex deployment state | `bun scripts/check-convex-state.mjs`     |
| `verify-convex-files.mjs`    | Verify Convex file integrity  | `bun scripts/verify-convex-files.mjs`    |
| `test-convex-connection.mjs` | Test Convex connectivity      | `bun scripts/test-convex-connection.mjs` |
| `test-convex.mjs`            | General Convex testing        | `bun scripts/test-convex.mjs`            |

## Data Maintenance

| Script                    | Purpose                      | Usage                                 |
| ------------------------- | ---------------------------- | ------------------------------------- |
| `create-daily-puzzle.mjs` | Create daily puzzle          | `bun scripts/create-daily-puzzle.mjs` |
| `cleanup-puzzles.mjs`     | Clean up puzzle data         | `bun scripts/cleanup-puzzles.mjs`     |
| `migrate-year-events.mjs` | Migrate events between years | `bun scripts/migrate-year-events.mjs` |
| `fix-schema.mjs`          | Fix schema issues            | `bun scripts/fix-schema.mjs`          |

## Development Utilities

| Script                   | Purpose                       | Usage                                               |
| ------------------------ | ----------------------------- | --------------------------------------------------- |
| `check-cache-age.mjs`    | Check build cache age         | `bun run check-cache`                               |
| `dagger-local.sh`        | Run local Dagger via Colima   | `bun run dagger:local -- call quality --check=lint` |
| `test-module-system.mjs` | Test module resolution        | `bun run test-module-system`                        |
| `test-responses-api.ts`  | Test OpenRouter Responses API | `bunx tsx scripts/test-responses-api.ts`            |

## Documentation

- `CLI_USAGE.md` - Detailed CLI command documentation
- `WORKFLOW.md` - Event curation workflow guide

## File Extensions

- `.ts` - TypeScript (run with `bunx tsx scripts/[name].ts`)
- `.mjs` - ES Modules (run with `bun scripts/[name].mjs`)

## Package.json Scripts

Key Bun scripts that wrap these utilities:

```bash
bun run events           # Event management CLI
bun run events:audit     # Run event audit
bun run ci:dagger:lint   # Reproduce the Dagger lint gate locally
bun run ci:dagger:docs   # Reproduce the Dagger docs gate locally
bun run deploy:verify    # Verify deployment
bun run verify:auth:prod # Verify production auth
bun run check-cache      # Check cache age
```

## Local Dagger on macOS

Chrondle's local CI wrapper prefers Colima. Start the default profile once:

```bash
colima start --profile default
```

Then run Dagger through the repo-local wrapper:

```bash
bun run ci:dagger:lint
bun run ci:dagger:type-check
bun run ci:dagger:validation
bun run ci:dagger:docs
```

If you need to force the plain Docker CLI instead, set `CHRONDLE_DAGGER_FORCE_DOCKER=1`.
