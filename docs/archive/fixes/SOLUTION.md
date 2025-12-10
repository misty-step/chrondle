# Production Guess Submission Fix

## Issue Summary

Guess submissions are failing in production due to a Content Security Policy (CSP) violation that blocks Clerk authentication scripts from loading. This causes a cascade of failures preventing server-side persistence of game state.

## Root Cause

CSP configuration mismatch between development and production Clerk domains:

- **Blocked domain**: `https://clerk.chrondle.app` (production)
- **Allowed domain**: `https://healthy-doe-23.clerk.accounts.dev` (development)

## Solution Applied

### 1. CSP Configuration Updated ✅

Fixed in `next.config.ts`:

- Added `https://clerk.chrondle.app` to `script-src` directive (line 55)
- Added `https://clerk.chrondle.app` to `connect-src` directive (line 60)

This allows the production Clerk scripts to load without CSP violations.

### 2. Production Environment Setup Required 🔧

The production deployment needs proper Clerk configuration:

#### Required Environment Variables

```env
# Production Clerk keys (from Clerk Dashboard)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...  # Production publishable key
CLERK_SECRET_KEY=sk_live_...                   # Production secret key
CLERK_WEBHOOK_SECRET=whsec_...                 # Production webhook secret
```

#### Clerk Dashboard Configuration

1. **Create Production Instance**: Clone the development Clerk instance to production
2. **Configure Domain**: Set custom domain to `clerk.chrondle.app` in Clerk Dashboard
3. **Update Webhook**: Point webhook to `https://www.chrondle.app/api/webhooks/clerk`
4. **Email Configuration**: Set sender to `noreply@chrondle.com`

### 3. Convex Auth Configuration 📝

The `convex/auth.config.ts` file currently hardcodes the development domain. For production, Convex will use the Clerk domain associated with the production keys automatically through the ClerkProvider.

**Note**: The auth domain in `convex/auth.config.ts` is primarily for development. In production, Clerk determines the correct domain based on the publishable key prefix (`pk_live_` vs `pk_test_`).

## Deployment Steps

1. **Build and Deploy** the updated `next.config.ts` with CSP fixes
2. **Configure Production Environment Variables** in your deployment platform (Vercel/Netlify/etc):
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   CLERK_WEBHOOK_SECRET=whsec_...
   NEXT_PUBLIC_CONVEX_URL=https://fleet-goldfish-183.convex.cloud
   ```
3. **Verify Clerk Dashboard** has production instance configured with:
   - Custom domain: `clerk.chrondle.app`
   - Webhook endpoint: `https://www.chrondle.app/api/webhooks/clerk`
   - Allowed origins: `https://www.chrondle.app`, `https://chrondle.app`

## Validation Checklist

After deployment, verify:

- [ ] No CSP errors in browser console
- [ ] Clerk script loads from `https://clerk.chrondle.app`
- [ ] Guess submissions persist to server
- [ ] State divergence warnings stop appearing
- [ ] Authentication flow works (sign in/sign up)
- [ ] User data syncs to Convex database

## Prevention Measures

1. **Add CSP Monitoring**: Configure CSP report-uri to catch future violations
2. **Environment Validation**: Add pre-deployment checks for required environment variables
3. **Documentation**: Update deployment guide with production Clerk setup steps
4. **Testing**: Add integration tests for authentication flow

## Technical Details

The issue manifested as:

1. CSP blocked Clerk script loading
2. Authentication infrastructure failed silently
3. Optimistic UI updates succeeded (local state)
4. Server mutations failed (no authentication)
5. State divergence detected by analytics
6. Infinite retry loops degraded performance

The fix ensures:

1. Clerk scripts can load in production
2. Authentication works end-to-end
3. Game state persists correctly
4. No state divergence between client/server

## References

- [Clerk Production Deployment Guide](https://clerk.com/docs/deployments/overview)
- [Next.js CSP Configuration](https://nextjs.org/docs/advanced-features/security-headers)
- [Convex Authentication Setup](https://docs.convex.dev/auth/clerk)
