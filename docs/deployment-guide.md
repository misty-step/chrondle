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

### 2. Production Web Deployment (Cloudflare)

The web runtime and authoritative DNS are on Cloudflare. The separately prepared
Cloudflare application backend and its one-writer cutover/recovery are described
in [ADR0001](adr/0001-cloudflare-backend.md); the serving backend remains Convex
until that data move. Clerk, Stripe and PostHog remain external integrations.

#### A. Source and release authority

`wrangler.jsonc` owns the production Worker `chrondle` in account
`b069014f6a46558ea9146fb6c4ff8f6c`, its existing compatibility settings, and
three custom domains:

- `chrondle.app`
- `www.chrondle.app`
- `chrondle.mistystep.io`

Custom domains invoke the Worker directly, not a proxied DigitalOcean origin.
Cloudflare owns their proxied DNS records. Staging remains a separate Worker
with no production custom domains. Do not replace source config with a
generated OpenNext or dashboard-only config.

Reviewed, green `master` merges run `.github/workflows/deploy.yml`. Exact-SHA
CI, secret scanning, production configuration and live Stripe price checks
remain blocking. The existing `Production` environment's `NEXT_PUBLIC_CONVEX_URL`
chooses the compatible backend: Convex while it names Convex, otherwise the
prepared Cloudflare backend with its runtime-only integration bindings. Both
pass `bun run deploy:verify` before web activation. Backend changes must remain compatible with the prior
web release and a web rollback; an ordinary release never restores or
destructively migrates data.

The OpenNext build receives only public application settings and
`CHRONDLE_REVISION=$GITHUB_SHA`. Server keys, the Convex deploy key and the
Cloudflare deployment token are not compiler inputs. The Production environment
provides `CLOUDFLARE_API_TOKEN`; existing Worker secrets retain the live
Clerk/Stripe/sync configuration. `NEXT_PUBLIC_POSTHOG_KEY` must match the
existing production public setting at build time.
The backend URL is passed from that same environment setting to both the public
compiler and `wrangler deploy --var`, not copied into production Wrangler vars.
`bun run doctor:hosting` likewise requires `NEXT_PUBLIC_CONVEX_URL`; it has no
fallback to the retired provider. Changing the setting alone does not import or
resume either data store. Follow ADR0001 before changing it.
The Open Graph image uses the Node runtime supported by the standard OpenNext
bundle; changing the runtime does not change its image content.

Normal CD requires the existing Cloudflare zone to be active before Worker
activation. It saves the previous Worker version, deploys the source-owned
domains, checks the direct alias's revision, then checks both public apex/www
revisions, `bun run doctor:hosting` and the canonical Stripe webhook. Health
reads the real backend `puzzles` table through the unchanged Convex client. A
failed activation or check restores the saved Worker only if its actual runtime
backend URL matches the candidate. At a backend-origin change, CD fails loudly
and leaves both stores untouched: use ADR0001 recovery preserving accepted
writes, never a blind old-frontend restore or backend resume.

#### B. Historical first apex/www cutover

This is the completed web-hosting migration baseline, not a current deployment
runbook. Use the existing CI workflow for releases and ADR0001 for a backend
cutover; do not repeat registrar delegation or bootstrap from a local login.

An existing Worker at `chrondle.mistystep.io` is **not** evidence that the
public apex/www moved. The 2026-10-12 baseline is:

| Boundary         | Before                                                                 | Target                                                      |
| ---------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| Registrar        | Namecheap                                                              | Same registrar                                              |
| Authoritative NS | `ns1.digitalocean.com`, `ns2.digitalocean.com`, `ns3.digitalocean.com` | `elsa.ns.cloudflare.com`, `miles.ns.cloudflare.com`         |
| Cloudflare zone  | `168e4a43b922ad6e8230f8aee76fce33`, pending delegation                 | Same zone, active                                           |
| Apex             | DO A `129.212.153.182`, TTL 30                                         | Existing Worker custom domain, proxied managed AAAA `100::` |
| www              | DO CNAME `chrondle.app`, TTL 30                                        | Existing Worker custom domain, proxied managed AAAA `100::` |
| Clerk            | DNS-only CNAME `frontend-api.clerk.services`, TTL 300                  | Unchanged                                                   |
| SPF              | TXT `v=spf1 include:spf.efwd.registrar-servers.com ~all`, TTL 1800     | Unchanged                                                   |

1. Read the current registrar NS, DNS records, Worker version and native release
   before writing. Compare all portable DNS records; do not copy obsolete DO
   origin records into Cloudflare. Keep the DO zone and native release intact.
2. The original reviewed bootstrap preceded registrar delegation because normal
   CD could not verify www while it still reached DO. Bootstrap evidence is
   historical; current CI explicitly supplies the serving backend URL at both
   compilation and Worker deployment. A bare local `wrangler deploy` is not a
   replacement and no longer has a source-owned production backend default.
3. Preserve Clerk DNS-only routing and SPF. Confirm Cloudflare certificates
   cover apex/www and DNSSEC has no conflicting registrar DS before replacing
   the registrar NS with `elsa.ns.cloudflare.com,miles.ns.cloudflare.com`.
4. Read delegation back from the registrar, parent delegation and independent
   resolvers. Require the Cloudflare zone to be active. Verify apex **and** www
   reach the reviewed Worker, with no DO compute/DNS/storage/database origin.
5. Walk real guess/hint/score and auth-relevant flows, observing Convex DB and
   WebSocket traffic, Clerk origins and canonical webhook routing. Preserve
   all callback URLs; Stripe's endpoint remains
   `https://www.chrondle.app/api/webhooks/stripe` without a POST redirect.
6. Only after both public domains serve the reviewed candidate and all public
   checks pass, merge the reviewed release-chain change. Normal CD installs
   and verifies the merge SHA on the alias and both public domains.
   A source build or alias-only walk does not satisfy public readiness.

The registrar API must accept the actual request egress IP. A valid stored key
does not bypass Namecheap's IP allowlist. A rejected request is an access
blocker, not missing cutover permission; do not claim delegation changed.

#### C. Exact rollback and retained native recovery

The existing CI saves the currently active 100% Worker version and reads its
actual backend origin. It restores that version only when its origin matches
the candidate. Do not run a bare manual Worker rollback across backend origins:
use ADR0001 to pause, preserve and reconcile all accepted writes before restoring
the old backend/frontend configuration. A version ID alone is not data recovery.
The pre-migration Worker version is
`a82172fe-745e-4426-bb34-974b913a07c6`; it is a historical fallback, not proof of
current source or privacy parity. Worker rollback does not restore DNS or data.

The historical web-host rollback restored the registrar NS to
`ns1.digitalocean.com,ns2.digitalocean.com,ns3.digitalocean.com`. Leave the DO
zone intact: apex A `129.212.153.182`, www CNAME `chrondle.app`, both TTL 30,
with the existing Clerk CNAME and SPF. Read delegation and the public game
back again; recursive NS caches can delay recovery. This is not a backend
rollback and is unsafe after a backend transition without ADR0001 recovery.

The retained native rollback runtime is `chrondle.service`, port `3007`,
Caddy ingress on `public-apps`, release
`405b77fd8765a86416e4fd9ad1ac49e7f96314d4` at
`/opt/public-apps/chrondle/releases/405b77fd8765a86416e4fd9ad1ac49e7f96314d4`.
The native release/controller/install scripts are retained only for this
reversible migration. The new workflow has no `Deploy native host` observer;
the installed controller therefore cannot activate these Cloudflare releases.
Do not modify another host controller, stop the native service, delete DNS,
or delete DO resources as part of this web/DNS cutover. Deletion belongs to
the parent controller after the global dependency and off-DO Postgres export
gates pass.

Signed GitHub workflow/deployment failure hooks still reach Kaylee's existing
agent intake. A failed release remains failed even after a successful rollback.

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
- **Nonproduction backend in production**: Run `bun run verify:env:prod` with the current release configuration; development and synthetic preview are refused.
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

Run `bun run verify:env:prod` with the release environment. It uses the shared
`src/lib/env.schema.ts` contract and prints only variable names and errors.
Do not create another validator or print the environment to debug it.

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
