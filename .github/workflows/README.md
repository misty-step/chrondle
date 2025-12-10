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

| Secret                              | Description           | How to Get                                                |
| ----------------------------------- | --------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`            | Convex project URL    | Convex Dashboard                                          |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk auth public key | [Clerk Dashboard](https://dashboard.clerk.com) → API Keys |
| `CONVEX_DEPLOY_KEY`                 | Convex deployment key | Convex Dashboard → Settings → Deploy Keys                 |

### Sentry Secrets (Optional - Sentry release skipped if missing)

| Secret                   | Description              | How to Get                                                   |
| ------------------------ | ------------------------ | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry data source name  | [Sentry](https://sentry.io) → Project Settings → Client Keys |
| `SENTRY_AUTH_TOKEN`      | Sentry auth token        | Sentry → Settings → Auth Tokens                              |
| `SENTRY_ORG`             | Sentry organization slug | Sentry URL: `sentry.io/organizations/{org-slug}/`            |
| `SENTRY_PROJECT`         | Sentry project slug      | Sentry → Project Settings                                    |

### Other Secrets (Used by specific workflows)

| Secret                    | Used By        | Description                           |
| ------------------------- | -------------- | ------------------------------------- |
| `CLERK_SECRET_KEY`        | E2E tests      | Clerk secret key for server-side auth |
| `CLAUDE_CODE_OAUTH_TOKEN` | Code review    | Claude Code integration               |
| `GIST_TOKEN`              | Coverage badge | GitHub token for gist updates         |

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
```

## Validation & Safety

### Pre-Merge Secret Verification

The CI workflow includes a `verify-production-secrets` job that runs on PRs targeting main/master. This catches missing secrets **before** merge, preventing post-merge deploy failures.

### Deploy Fail-Fast

The deploy workflow validates all required secrets at the start, providing clear error messages:

- **Required secrets**: Fail immediately with instructions
- **Optional secrets (Sentry)**: Warn but continue, skip Sentry release

## Workflow Details

### Deploy (`deploy.yml`)

Steps:

1. Checkout code
2. **Validate secrets** (fail-fast on missing required secrets)
3. Setup Node.js 20 and pnpm
4. Install dependencies
5. Build Next.js application
6. Create Sentry release (if configured)
7. Deploy to Convex production
8. Verify deployment

### CI (`ci.yml`)

Jobs:

- `quality-checks`: Lint, type-check, test (parallel matrix)
- `validation`: Puzzle and data validation
- `build`: Production build verification
- `e2e`: Playwright end-to-end tests
- `verify-production-secrets`: Pre-merge secrets check (PRs only)

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

### Sentry Release Skipped

This is expected if Sentry secrets aren't configured. The deploy will still succeed; only Sentry release/sourcemap upload is skipped.

## Manual Deployment

```bash
pnpm deploy        # Full deploy
pnpm deploy:verify # Verify deployment health
```
