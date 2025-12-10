# Google OAuth Configuration Fix

## Problem

Production site shows error: "Missing required parameter: client_id" when users click "Sign in with Google"

## Root Cause

Clerk has Google OAuth enabled but lacks proper Google OAuth credentials for production.

## Quick Fix (Disable Google Sign-in)

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select the Chrondle production app
3. Navigate to: **User & Authentication → Social Connections**
4. Find **Google** and toggle it **OFF**
5. Save changes

## Proper Fix (Enable Google Sign-in)

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth client ID**
5. Select **Web application** as the application type
6. Name it "Chrondle Production"
7. Under **Authorized redirect URIs**, you'll need to add the URI from Clerk (see Step 2)
8. Save and copy the **Client ID** and **Client Secret**

### Step 2: Configure in Clerk Dashboard

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select the Chrondle production app
3. Navigate to **User & Authentication → Social Connections**
4. Click on **Google**
5. Toggle **"Use custom credentials"** ON
6. Copy the **Authorized redirect URI** shown and add it to Google Cloud Console (Step 1.7)
7. Paste your Google **Client ID** and **Client Secret**
8. Click **Add connection**

### Step 3: Test

1. Visit https://www.chrondle.app
2. Click "Sign in"
3. Click "Sign in with Google"
4. Should now redirect to Google without errors

## Notes

- No code changes required - this is purely a dashboard configuration
- Development environment uses Clerk's shared OAuth credentials (works automatically)
- Production requires your own Google OAuth credentials for security
- The error occurs because Clerk shows the Google button but can't complete the OAuth flow without credentials

## References

- [Clerk Google OAuth Documentation](https://clerk.com/docs/authentication/social-connections/google)
- [Google OAuth Setup Guide](https://developers.google.com/identity/protocols/oauth2/web-server)
