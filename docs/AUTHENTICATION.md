# Chrondle Authentication Configuration Guide

## Overview

Chrondle uses **Clerk** for authentication with **Convex** as the backend database. The authentication flow supports:

- Email magic links
- Google OAuth
- User session management
- Account provisioning from the verified Clerk identity on authenticated requests

## Production Authentication Status

Production uses Clerk at `clerk.chrondle.app`. Configuration validation is not
proof of a successful sign-in. Verify first-time and returning-user journeys
against the exact release before claiming live authentication works.

## Environment Configuration

### Required Environment Variables

```env
# Clerk Authentication (Production)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Google OAuth (Optional but recommended)
GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-...

# Convex Backend
NEXT_PUBLIC_CONVEX_URL=https://fleet-goldfish-183.convex.cloud
CONVEX_DEPLOY_KEY=prod:fleet-goldfish-183|...
CONVEX_DEPLOYMENT=prod:fleet-goldfish-183
```

## Verification

### Automated Verification

Run the verification script to check your authentication configuration:

```bash
# Verify current environment (.env.local)
bun run verify:auth

# Verify production environment (.env.production)
bun run verify:auth:prod
```

The script checks:

1. Environment settings (NODE_ENV)
2. Clerk key configuration (production vs test keys)
3. Google OAuth setup
4. Convex backend configuration
5. Domain configuration
6. Production readiness checklist

### Manual Testing Checklist

#### 1. Local Development Testing

- [ ] Email magic link sign-in works
- [ ] Google OAuth sign-in works
- [ ] User session persists across page refreshes
- [ ] Sign out properly clears session

#### 2. Production Deployment Testing

- [ ] Deploy the reviewed standalone release to the production host
- [ ] Test sign-in on production URL
- [ ] Verify first-time authenticated requests provision an account
- [ ] Verify returning sign-in preserves that account, progress and entitlement

#### 3. Mobile Testing

- [ ] Test magic link on mobile browsers
- [ ] Verify redirect flow works correctly
- [ ] Check responsive layout of auth UI

## Authentication Flow

### User Sign Up/Sign In

1. User enters email or clicks Google OAuth
2. Clerk handles authentication
3. The browser obtains a Clerk JWT for the backend; the backend verifies its
   issuer, audience, signature and expiry using Clerk discovery and JWKS.
4. `users:getOrCreateCurrentUser` provisions the account from that verified
   identity, or returns the existing account unchanged.
5. Subsequent account and progress requests use the same authenticated owner.

### Session Management

- Sessions are managed by Clerk middleware
- Protected routes defined in `middleware.ts`
- Public routes accessible without authentication
- User data available via `useUser()` hook

### Account provisioning

There is no Clerk webhook endpoint or Clerk sync-secret requirement. Anonymous
requests cannot provision an account. Existing accounts retain accepted state
when their verified identity returns; see [SPEC.md](../SPEC.md).

## Troubleshooting

### Common Issues

#### 1. "Clerk keys not configured properly"

- Ensure you're using production keys (pk*live*, sk*live*)
- Check that keys match your Clerk application

#### 3. "Users not syncing to Convex"

- Verify the browser sends its Clerk JWT to the configured backend
- Check JWT verification and `users:getOrCreateCurrentUser` failures
- Ensure browser and server use the same serving backend

#### 4. "Google OAuth not working"

- Verify OAuth credentials in Google Cloud Console
- Add production domain to authorized redirect URIs
- Check that client ID and secret are correct

### Debug Commands

```bash
# Check current configuration
node scripts/verify-auth-production.mjs

# Check Convex connection
npx convex run users:count
```

## Security Best Practices

1. **Never commit real keys to version control**
   - Use `.env.local` for development
   - Use environment variables in production

2. **Rotate keys regularly**
   - After any potential exposure
   - On a regular schedule (quarterly)

3. **Use production keys in production**
   - Never use test keys (pk*test*, sk*test*) in production
   - Separate development and production Clerk applications

4. **Enable security features**
   - Rate limiting in Clerk Dashboard
   - Domain allowlist for production
   - Verified JWT issuer, audience, signature and expiry

5. **Monitor authentication events**
   - Set up alerts for unusual activity
   - Review authentication logs regularly
   - Monitor failed authentication attempts

## Production Deployment Guide

Use the existing [Cloudflare deployment path](deployment-guide.md#2-production-web-deployment-cloudflare).
Server-side Clerk credentials are runtime secrets, never compiler inputs.
Backend migration preserves the Clerk application and frontend domains.

### Post-Deployment Verification

1. Run verification script against production:

   ```bash
   bun run verify:auth:prod
   ```

2. Test authentication flow:
   - Sign up with new email
   - Sign in with existing account
   - Test Google OAuth
   - Verify user appears in Convex

3. Verify authorization rejection, refresh/reconnect recovery and persistence.

## Support

For authentication issues:

1. Check verification script output
2. Review Clerk Dashboard logs
3. Inspect Convex function logs
4. Check browser console for client-side errors

## Related Documentation

- [Clerk Documentation](https://clerk.com/docs)
- [Convex Documentation](https://docs.convex.dev)
- [Next.js Authentication](https://nextjs.org/docs/authentication)
