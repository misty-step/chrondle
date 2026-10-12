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

The web runtime and authoritative DNS move to Cloudflare; hosted Convex,
Clerk, Stripe and PostHog remain external vendors. No backend rewrite or data
migration is part of this cutover. In particular, Convex is **not** hosted on
Cloudflare.

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
remain blocking. Compatible Convex deploys and passes `bun run deploy:verify`
before web activation. Backend changes must remain compatible with the prior
web release and a web rollback; an ordinary release never restores or
destructively migrates data.

The OpenNext build receives only public application settings and
`CHRONDLE_REVISION=$GITHUB_SHA`. Server keys, the Convex deploy key and the
Cloudflare deployment token are not compiler inputs. The Production environment
provides `CLOUDFLARE_API_TOKEN`; existing Worker secrets retain the live
Clerk/Stripe/sync configuration. `NEXT_PUBLIC_POSTHOG_KEY` must match the
existing production public setting at build time.
The Open Graph image uses the Node runtime supported by the standard OpenNext
bundle; changing the runtime does not change its image content.

The release captures the previously active Worker version, deploys the
source-owned domains, then requires exact-revision `/api/health` on all three
domains, plus home/archive/sign-in and canonical Stripe webhook ingress.
Health executes the real Convex `health.systemCheck`, which reads the
`puzzles` table. A failed activation or smoke rolls the Worker back to the
captured version; it does not roll back Convex or connected data.

#### B. First apex/www cutover

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

1. Retain exact before-state NS, DNS records, Worker version and native release
   in the initiative's private cutover receipt. Compare all portable DNS
   records; do not copy obsolete DO origin records into Cloudflare.
2. Build the exact independently reviewed candidate with production public
   settings, deploy it through project-local Wrangler to production, and
   verify the alias's revision and real game/auth paths. Retain its Worker
   version and asset/source parity receipt. Do not promote the stale installed
   Worker merely because its alias responds.
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
6. Merge the reviewed release-chain change only after apex/www readiness.
   Record the merge SHA, deployed Worker version and all domain health SHAs.
   A successful source build or alias-only walk does not satisfy this gate.

The registrar API must accept the actual request egress IP. A valid stored key
does not bypass Namecheap's IP allowlist. A rejected request is an access
blocker, not missing cutover permission; do not claim delegation changed.

#### C. Exact rollback and retained native recovery

Before every Worker deployment, capture the currently active 100% version.
Restore it with project-local
`bunx wrangler rollback <recorded-version> --env production --yes`.
The pre-migration Worker version is
`a82172fe-745e-4426-bb34-974b913a07c6`; it is a historical fallback, not proof of
current source or privacy parity. Worker rollback does not restore DNS or data.

For a DNS rollback, restore the registrar NS to
`ns1.digitalocean.com,ns2.digitalocean.com,ns3.digitalocean.com`. Leave the DO
zone intact: apex A `129.212.153.182`, www CNAME `chrondle.app`, both TTL 30,
with the existing Clerk CNAME and SPF. Read delegation and the public game
back again; recursive NS caches can delay recovery.

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
