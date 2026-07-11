# Chrondle Authentication Configuration Guide

## Overview

Chrondle uses **Clerk** for authentication with **Convex** as the backend database. The authentication flow supports:

- Email magic links
- Google OAuth
- User session management
- Automatic user sync to Convex database via webhooks

## Production Authentication Status

✅ **Production authentication is fully configured and verified**

All production keys and settings have been validated:

- Clerk production keys (pk*live*, sk*live*)
- Custom domain: clerk.chrondle.app
- Google OAuth credentials
- Webhook secret for user sync
- Convex production deployment

## Environment Configuration

### Required Environment Variables

```env
# Clerk Authentication (Production)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

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
pnpm verify:auth

# Verify production environment (.env.production)
pnpm verify:auth:prod
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

- [ ] Deploy to the DigitalOcean App Platform production service
- [ ] Test sign-in on production URL
- [ ] Verify webhook events in Clerk Dashboard → Webhooks
- [ ] Check user creation in Convex Dashboard → Data

#### 3. Mobile Testing

- [ ] Test magic link on mobile browsers
- [ ] Verify redirect flow works correctly
- [ ] Check responsive layout of auth UI

## Authentication Flow

### User Sign Up/Sign In

1. User enters email or clicks Google OAuth
2. Clerk handles authentication
3. On successful auth, webhook fires to `/api/webhooks/clerk`
4. Webhook handler creates/updates user in Convex database
5. User session is established

### Session Management

- Sessions are managed by Clerk middleware
- Protected routes defined in `middleware.ts`
- Public routes accessible without authentication
- User data available via `useUser()` hook

### Webhook Integration

The webhook endpoint at `/api/webhooks/clerk` handles:

- `user.created` - Creates new user in Convex
- `user.updated` - Updates existing user data

## Troubleshooting

### Common Issues

#### 1. "Clerk keys not configured properly"

- Ensure you're using production keys (pk*live*, sk*live*)
- Check that keys match your Clerk application

#### 2. "Webhook secret not configured"

- Create webhook in Clerk Dashboard
- Add endpoint: `https://your-domain.com/api/webhooks/clerk`
- Copy the webhook secret to CLERK_WEBHOOK_SECRET

#### 3. "Users not syncing to Convex"

- Verify webhook endpoint is accessible
- Check webhook logs in Clerk Dashboard
- Ensure Convex deployment is correct (fleet-goldfish-183)

#### 4. "Google OAuth not working"

- Verify OAuth credentials in Google Cloud Console
- Add production domain to authorized redirect URIs
- Check that client ID and secret are correct

### Debug Commands

```bash
# Check current configuration
node scripts/verify-auth-production.mjs

# Test webhook endpoint (requires curl)
curl -X POST https://your-domain.com/api/webhooks/clerk \
  -H "Content-Type: application/json" \
  -d '{"type":"user.created"}'

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
   - Webhook signature verification

5. **Monitor authentication events**
   - Set up alerts for unusual activity
   - Review authentication logs regularly
   - Monitor failed authentication attempts

## Production Deployment Guide

### DigitalOcean App Platform Deployment

1. Add environment variables to the App Platform web service:
   - All Clerk keys (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, etc.)
   - Convex configuration
   - Google OAuth credentials

2. Configure `bun install --frozen-lockfile && bun run build` as the build
   command and `bun run start` as the run command. Convex deploys separately.

3. Set up domain:
   - Add the custom domain in App Platform
   - Update Clerk application with production domain
   - Configure webhook URL with production domain

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

3. Monitor webhook events:
   - Check Clerk Dashboard → Webhooks
   - Verify successful webhook deliveries
   - Monitor for any failures

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
