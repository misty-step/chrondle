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

| Variable                 | Required | Description                          | Example                                   |
| ------------------------ | -------- | ------------------------------------ | ----------------------------------------- | ------------- |
| `NODE_ENV`               | ✅       | Environment mode                     | `production` or `development`             |
| `NEXT_PUBLIC_CONVEX_URL` | ✅       | Convex deployment URL (client-side)  | `https://fleet-goldfish-183.convex.cloud` |
| `CONVEX_DEPLOY_KEY`      | ✅       | Convex deployment key for production | `prod:fleet-goldfish-183                  | base64key...` |
| `CONVEX_DEPLOYMENT`      | ✅       | Convex deployment identifier         | `prod:fleet-goldfish-183`                 |

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

### 2. Production Deployment (Vercel)

#### A. Environment Setup

1. **Use `.env.example` as the production checklist**

2. **Update with production values:**
   - Replace placeholder keys with actual production keys
   - Use `pk_live_` and `sk_live_` for Clerk (not test keys)
   - Set `NODE_ENV=production`
   - Point to production Convex deployment

#### B. Vercel Configuration

1. **Add environment variables in Vercel Dashboard:**
   - Go to Project Settings → Environment Variables
   - Add all required variables from `.env.example`
   - Ensure production branch uses production values

2. **Configure build settings:**
   - Vercel should auto-detect the Next.js settings for this repository
   - `vercel.json` only declares the framework, so no custom build or install command is required

3. **Deploy:**
   ```bash
   vercel --prod
   ```

### 3. Production Deployment (Self-Hosted)

```bash
# Build for production
bun run build

# Deploy Convex functions
bunx convex deploy --prod

# Start production server
NODE_ENV=production bun run start
```

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

- [ ] Daily puzzle loads correctly
- [ ] Authentication working
- [ ] User progress saves
- [ ] No console errors in production
- [ ] Performance metrics acceptable
- [ ] Monitoring configured

## Additional Resources

- [Convex Documentation](https://docs.convex.dev)
- [Clerk Documentation](https://clerk.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)

## Support

For deployment issues:

1. Check this troubleshooting guide
2. Review environment variables
3. Check Convex and Clerk dashboards for errors
4. Review deployment logs
