# GitHub Actions Workflows

## Workflows Overview

| Workflow                 | Trigger                  | Purpose                                 |
| ------------------------ | ------------------------ | --------------------------------------- |
| `ci.yml`                 | PR & push to main/master | Quality checks, tests, build validation |
| `deploy.yml`             | Push to main/master      | Production deployment                   |
| `size-limit.yml`         | PR                       | Bundle size checks                      |
| `claude-code-review.yml` | PR                       | Automated code review                   |

## Required GitHub Secrets

### Core Secrets (Required - Deploy will fail without these)

| Secret                              | Description           | How to Get                                                                        |
| ----------------------------------- | --------------------- | --------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`            | Convex project URL    | Convex Dashboard                                                                  |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk auth public key | [Clerk Dashboard](https://dashboard.clerk.com) → API Keys                         |
| `CONVEX_DEPLOY_KEY`                 | Convex deployment key | Convex Dashboard → Settings → Deploy Keys                                         |
| `NEXT_PUBLIC_CANARY_API_KEY`        | Browser Canary key    | Raw Canary `ingest-only` key for browser capture; never admin/read                |
| `CANARY_API_KEY`                    | Server Canary key     | Raw Canary `ingest-only` key for Next server and Convex capture; never admin/read |

### Other Secrets (Used by specific workflows)

| Secret                        | Used By        | Description                           |
| ----------------------------- | -------------- | ------------------------------------- |
| `CLERK_SECRET_KEY`            | E2E tests      | Clerk secret key for server-side auth |
| `CLAUDE_CODE_OAUTH_TOKEN`     | Code review    | Claude Code integration               |
| `GIST_TOKEN`                  | Coverage badge | GitHub token for gist updates         |
| `NEXT_PUBLIC_CANARY_ENDPOINT` | Deploy         | Optional Canary base URL override     |

## Setting Up Secrets

1. Go to your GitHub repository
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Add each secret with the exact name

Quick setup with GitHub CLI:

```bash
gh secret set NEXT_PUBLIC_CONVEX_URL --body "https://your-project.convex.cloud"
gh secret set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY --body "pk_live_..."
gh secret set CONVEX_DEPLOY_KEY --body "prod:project-name|..."
gh secret set NEXT_PUBLIC_CANARY_API_KEY --body "sk_live_..."
gh secret set CANARY_API_KEY --body "sk_live_..."
```

Both Canary keys are write-only ingest keys scoped to `chrondle`; neither may
use an admin or read scope. Use the one-time raw `sk_live_...` value returned by
Canary, not the `KEY-*` database id. `NEXT_PUBLIC_CANARY_API_KEY` is embedded in
browser JavaScript, while `CANARY_API_KEY` is used by server and Convex runtime
paths.

## Validation & Safety

### Required PR Gate Map

Branch protection should require the single `merge-gate` check from `ci.yml`.
That check fans in all required PR lanes: Dagger quality checks
(`lint`, `type-check`, test coverage), validation, docs link checking, build,
e2e, and PR environment validation. If a lane is split or renamed, update
`merge-gate.needs` in the same change.

Advisory and automation workflows are intentionally outside the required map:
`size-limit.yml`, Claude review workflows, PR-size labeling, release, and deploy
can inform or ship work, but they do not replace `merge-gate`.

### Pre-Merge Secret Verification

The CI workflow includes a Dagger-driven `verify-environment` job that runs on PRs targeting main/master. It validates CI and production env requirements, including Stripe configuration, before merge.

For Clerk specifically, `ci.yml` builds and runs Playwright against a fixed public test instance so localhost-backed smoke tests do not embed the production custom domain. The `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` secret is still validated in the production-oriented checks and used by deploy flows.

### Deploy Fail-Fast

The deploy workflow validates all required secrets at the start, providing clear error messages:

- **Required secrets**: Fail immediately with instructions

## Workflow Details

### Deploy (`deploy.yml`)

Steps:

1. Checkout code
2. **Validate secrets** (fail-fast on missing required secrets)
3. Setup Bun 1.3.9
4. Install dependencies
5. Build Next.js application
6. Deploy to Convex production
7. Verify deployment

### CI (`ci.yml`)

Primary quality/build/e2e gates are executed through the repo's Dagger module (`dagger/src/index.ts`) and invoked from GitHub Actions via `dagger/dagger-for-github`.

Jobs:

- `quality-checks`: Dagger-driven lint, type-check, and test coverage (parallel matrix)
- `validation`: Dagger-driven puzzle/data validation
- `docs`: Dagger-driven docs link check
- `build`: Dagger-driven production build, env exposure verification, bundle-size enforcement, and `.next` artifact export
- `e2e`: Dagger-driven Playwright run with report artifact export and explicit exit-code gating
- `verify-environment`: Dagger-driven CI/production env and Stripe validation (PRs only)

### Local Reproduction

For local macOS development, this repo uses Colima as the default Dagger backend via [`scripts/dagger-local.sh`](../../scripts/dagger-local.sh). CI itself is not Colima-specific; GitHub Actions runs Dagger directly on Ubuntu.

```bash
colima start --profile default
bun run ci:dagger:lint
bun run ci:dagger:type-check
bun run ci:dagger:validation
bun run ci:dagger:docs
```

If you need to bypass Colima and use the host Docker CLI, set `CHRONDLE_DAGGER_FORCE_DOCKER=1`.

## Troubleshooting

### "Missing publishableKey" Error

This means `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is not set in GitHub Secrets.

```bash
# Fix:
gh secret set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY --body "pk_live_..."
```

### "Convex deploy failed" Error

Check that `CONVEX_DEPLOY_KEY` is set and has the correct format:

```
prod:project-name|base64-encoded-key
```

## Manual Deployment

```bash
bun run deploy        # Full deploy
bun run deploy:verify # Verify deployment health
```
