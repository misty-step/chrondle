# Chrondle Deployment Guide

## Overview

This guide covers the deployment process for Chrondle, including environment configuration, Convex setup, and common troubleshooting steps.

## Deployment Environments

Chrondle uses two separate Convex deployments:

| Environment     | Deployment ID          | URL                                       | Purpose                     |
| --------------- | ---------------------- | ----------------------------------------- | --------------------------- |
| **Development** | `handsome-raccoon-955` | https://handsome-raccoon-955.convex.cloud | Development and testing     |
| **Production**  | `fleet-goldfish-183`   | https://fleet-goldfish-183.convex.cloud   | Live production environment |

Both deployments contain the same data structure:

- **1,821 historical events** in the `events` table
- **Dynamic puzzle generation** - puzzles are generated daily from events, not stored statically
- **User data** stored in `users` and `plays` tables

## Required Environment Variables

### Core Configuration

| Variable | Required | Description | Example |
| ------------------------ | -------- | ------------------------------------ | ----------------------------------------- | ------------- |
| `NODE_ENV` | ✅ | Environment mode | `production` or `development` |
| `NEXT_PUBLIC_CONVEX_URL` | ✅ | Convex deployment URL (client-side) | `https://fleet-goldfish-183.convex.cloud` |
| `CONVEX_DEPLOY_KEY` | ✅ | Convex deployment key for production | `prod:fleet-goldfish-183                  | base64key...` |
| `CONVEX_DEPLOYMENT` | ✅ | Convex deployment identifier | `prod:fleet-goldfish-183` |

### Authentication (Clerk)

| Variable                            | Required | Description                  | Example                        |
| ----------------------------------- | -------- | ---------------------------- | ------------------------------ |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅       | Clerk public key             | `pk_live_...` or `pk_test_...` |
| `CLERK_SECRET_KEY`                  | ✅       | Clerk secret key             | `sk_live_...` or `sk_test_...` |
| `CLERK_WEBHOOK_SECRET`              | ⚠️       | Webhook secret for user sync | `whsec_...`                    |

### Optional Services

| Variable             | Required | Description                    | Example        |
| -------------------- | -------- | ------------------------------ | -------------- |
| `OPENROUTER_API_KEY` | ❌       | OpenRouter API for AI features | `sk-or-v1-...` |
| `STRIPE_SECRET_KEY`  | ❌       | Stripe for future payments     | `sk_live_...`  |

## Deployment Steps

### 1. Local Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/chrondle.git
cd chrondle

# Install dependencies
bun install

# Copy environment template
cp .env.example .env.local

# Configure .env.local for development
# - Set NEXT_PUBLIC_CONVEX_URL to dev deployment
# - Use test Clerk keys (pk_test_, sk_test_)
# - Set NODE_ENV=development

# Start the full development stack
bun run dev
```

### 2. Production Web Deployment (Native Host)

#### A. Environment Setup

1. Use `.env.example` as the production checklist.
2. Store production values in root-owned mode-`0600`
   `/etc/public-apps/chrondle.env`.
3. Use `pk_live_` and `sk_live_` keys, set `NODE_ENV=production`, and point to
   the production Convex deployment.

#### B. Continuous Release

Every reviewed, green `master` merge runs `.github/workflows/deploy.yml`, without
path filters or a manual promotion. The workflow serializes releases and waits
for the complete CI workflow and TruffleHog on the same SHA before mutation.
Existing production configuration and live Stripe checks remain blocking.
Hosted artifact/e2e gates and the native host use the same supported Webpack
compiler (`next build --webpack`), rather than verifying a different compiler
path. The CSS budget counts every stylesheet under `.next/static`, independent
of the compiler's output directory; the existing byte budgets remain unchanged.

Convex deploys and passes `bun run deploy:verify` **before** native host activation.
Backend changes must remain compatible with the still-running previous web
release and with a web rollback: use expand/contract, never destructive data
migrations in an ordinary release. Credential, billing, privacy, and data-loss
changes retain their own boundaries; CD does not authorize those operations.

The root-owned `chrondle-cd.timer` polls public GitHub metadata every three
minutes (at most 40 API requests/hour/IP while busy, 20 while idle). It accepts
only an exact-SHA `master` production run with a successful backend job and a
live native-host observer. No Actions host key, runner, or new inbound access is
needed. The compiler and install hooks run as the no-login `chrondle-build`
identity with an explicit allowlist of the app's public settings, in bounded
transient systemd units. Server/deploy secrets and unrecognized public-prefixed
credential names are never compiler inputs. A new public app setting must be
added to `PUBLIC_BUILD_VARS` in `scripts/host-cd.py`. Root validates the artifact,
installs an immutable standalone release, atomically repoints `current`, and
restarts the existing `chrondle.service`.

The application still runs as the unprivileged `chrondle` user on port `3007`.
The host's default-deny firewall blocks direct public access; Caddy is the only
allowed public ingress for `chrondle.app` and `www.chrondle.app`.

Canary was explicitly decommissioned. The retired transport, credential
dependencies, browser publication, CSP authority, health dependency, and
release scope probe are removed, rather than bypassed. App errors use sanitized
browser/native structured logs; backend exceptions and alerts use Convex logs
and metrics.
Centralized remote browser error aggregation is not configured. Deployment and
post-deploy health failures still reach Kaylee's signed GitHub agent intake.

#### C. Host Bootstrap and Deployment Machinery Updates

From the exact reviewed checkout on `public-apps`, run once when installing or
changing the deployment machinery:

```bash
bash scripts/install-host-cd.sh
```

Use existing native Tailscale SSH to transfer that reviewed checkout. The
installer verifies the pinned Bun download, root-only environment file, and
existing active release, installs the root-owned controller and timer, and
creates the separate no-login build identity. Routine application merges do
not need this bootstrap command or a machine credential in GitHub.

#### D. Verify, Alert, and Recover

```bash
node scripts/verify-native-release.mjs
bun run deploy:verify
ssh root@public-apps.tail5f5eb4.ts.net \
  'journalctl -u chrondle-cd.service -u chrondle.service -n 100 --no-pager'
```

The controller checks local and public `/api/health` against the artifact SHA,
live Convex puzzles/event integrity, Stripe webhook ingress, the home page,
and the archive. Only then does `/deployment.json` become `healthy` with the
SHA, Actions run ID, attempt, and URL. Actions independently requires that
receipt and exact runtime SHA. A stopped timer, failed build/install/activation,
or rollback makes the observer fail within 20 minutes. GitHub's signed
`workflow_run`/`deployment_status` hooks deliver failures to
`https://kaylee-alert-intake.misty-step.workers.dev/github/misty-step`;
Kaylee's agent triage intake owns the incident. No human notification is added.

An `alert_probe: true` manual dispatch deliberately fails before any production
mutation, for safe route verification. It is an optional drill, not a release
gate. A successful CI hook alone is not host deployment evidence.

Failed post-activation smoke automatically restores the previous web symlink
and restarts the service. The controller never rolls back Convex or restores data.
An interrupted activation is also recovered through systemd `ExecStopPost`,
using the durable pre-activation pointer; stopping or killing the controller
cannot strand an unchecked release merely by bypassing a Python exception.
`/var/lib/chrondle-cd/result.json` and the journal retain the bounded
revision/run outcome. Repair the cause and merge normally; a rerun of the
reviewed release can retry the same immutable artifact.

For exceptional web-only recovery, atomically repoint
`/opt/public-apps/chrondle/current` to an already installed healthy release,
restart `chrondle.service`, and repeat the checks above. Do not roll Convex
back as part of a web-only recovery.

#### E. Provenance

The manual host flow first appeared in `8c946aa3fcd6e3196457107faf6fce1b4d9d134d`
(`chore: prepare native host runtime`, 2026-08-15). The later
`d281c134b9acd93d405b781dac42d4d6097b987a` recorded the firewall boundary.
These commits describe runtime preparation and isolation, not a written
human-only release decision. The 2026-09-30 instruction authorizes routine
continuous deployment; the native isolation and credential boundaries remain.

## Environment Configuration Patterns

### Development Configuration (.env.local)

```env
NODE_ENV=development
NEXT_PUBLIC_CONVEX_URL=https://handsome-raccoon-955.convex.cloud
CONVEX_DEPLOYMENT=dev:handsome-raccoon-955
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### Example Production Configuration

```env
NODE_ENV=production
NEXT_PUBLIC_CONVEX_URL=https://fleet-goldfish-183.convex.cloud
CONVEX_DEPLOY_KEY=prod:fleet-goldfish-183|...
CONVEX_DEPLOYMENT=prod:fleet-goldfish-183
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. "Server Error" from Convex Queries

**Symptoms:**

- Console shows `[CONVEX Q(puzzles:getUserPlay)] Server Error`
- User progress not loading

**Causes & Solutions:**

- **Wrong deployment URL**: Verify `NEXT_PUBLIC_CONVEX_URL` matches your deployment
- **ID format mismatch**: Ensure Clerk IDs are properly translated to Convex IDs
- **Missing deploy key**: Check `CONVEX_DEPLOY_KEY` is set for production
- **Network issues**: Verify Convex deployment is accessible

#### 2. Puzzles Not Loading

**Symptoms:**

- Daily puzzle shows loading indefinitely
- No puzzle data displayed

**Causes & Solutions:**

- **Wrong Convex URL**: Check `NEXT_PUBLIC_CONVEX_URL` is correct
- **Missing events data**: Verify events table has 1,821 records
- **Date/timezone issues**: Check server timezone configuration
- **Cron job not running**: Verify daily puzzle generation cron is active

#### 3. Authentication Issues

**Symptoms:**

- Users can't sign in
- User data not persisting

**Causes & Solutions:**

- **Mismatched Clerk keys**: Ensure using correct environment keys (test vs live)
- **Webhook not configured**: Set up Clerk webhook for user sync
- **CORS issues**: Check allowed origins in Clerk dashboard
- **Missing webhook secret**: Ensure `CLERK_WEBHOOK_SECRET` is set

#### 4. Mixed Environment Keys

**Symptoms:**

- Features work in dev but not production
- Inconsistent behavior

**Causes & Solutions:**

- **Using test keys in production**: Replace all `pk_test_`, `sk_test_` with `pk_live_`, `sk_live_`
- **Development Convex URL in production**: Verify production uses `fleet-goldfish-183`
- **NODE_ENV mismatch**: Ensure `NODE_ENV=production` for production builds

### Debugging Commands

```bash
# Check current Convex deployment
bunx convex dashboard

# Verify environment variables are loaded
bun -e "console.log(process.env.NEXT_PUBLIC_CONVEX_URL)"

# Test Convex connection
bunx convex run puzzles:getTotalPuzzles

# Check build output
bun run build --debug

# Verify production build locally
NODE_ENV=production bun run build && bun run start
```

### Environment Variable Validation Script

Create a `validate-env.js` script:

```javascript
const required = [
  "NODE_ENV",
  "NEXT_PUBLIC_CONVEX_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("❌ Missing required environment variables:");
  missing.forEach((key) => console.error(`  - ${key}`));
  process.exit(1);
}

// Validate format
if (process.env.NODE_ENV === "production") {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes("test")) {
    console.error("❌ Using test Clerk key in production!");
    process.exit(1);
  }
  if (!process.env.NEXT_PUBLIC_CONVEX_URL?.includes("fleet-goldfish-183")) {
    console.warn("⚠️  Not using production Convex deployment");
  }
}

console.log("✅ Environment variables validated successfully");
```

## Security Best Practices

1. **Never commit secrets to version control**
   - Use `.env.local` (gitignored)
   - Store production secrets in deployment platform

2. **Use environment-specific keys**
   - Development: `pk_test_`, `sk_test_`
   - Production: `pk_live_`, `sk_live_`

3. **Rotate keys regularly**
   - Set up key rotation schedule
   - Update after any potential exposure

4. **Configure domain restrictions**
   - Set allowed origins in Clerk dashboard
   - Configure CORS in Convex functions

5. **Monitor and audit**
   - Enable audit logs in Clerk
   - Monitor Convex function execution
   - Set up alerts for unusual activity

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (`bun run test`)
- [ ] TypeScript compilation clean (`bun run type-check`)
- [ ] Linting passes (`bun run lint`)
- [ ] Puzzle validation passes (`bun run validate-puzzles`)
- [ ] Environment variables configured
- [ ] Production keys obtained (not test keys)

### Deployment

- [ ] Convex functions deployed (`bunx convex deploy --prod`)
- [ ] Environment variables set in platform
- [ ] Build successful
- [ ] Domain configured and SSL active

### Post-Deployment

- [ ] Hosting parity doctor passes (`bun run doctor:hosting`)
- [ ] Daily puzzle loads correctly
- [ ] Authentication working
- [ ] User progress saves
- [ ] No console errors in production
- [ ] Performance metrics acceptable
- [ ] Monitoring configured

`bun run doctor:hosting` is the provider-independent production probe. It fails
if the Clerk custom-domain CNAME disappears, Clerk's client edge or sign-in
route stops loading, the production Convex corpus is unavailable, application
health degrades, or signed-out Stripe requests reach provider actions.

## Additional Resources

- [Convex Documentation](https://docs.convex.dev)
- [Clerk Documentation](https://clerk.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

## Support

For deployment issues:

1. Check this troubleshooting guide
2. Review environment variables
3. Check Convex and Clerk dashboards for errors
4. Review deployment logs
