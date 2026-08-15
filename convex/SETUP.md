# Convex Setup Guide

## Prerequisites

- Convex account (create at https://dashboard.convex.dev)
- Tailscale SSH access to the public application host
- Access to root-owned `/etc/public-apps/chrondle.env`

## Setup Steps

### 1. Create Convex Project

1. Go to https://dashboard.convex.dev
2. Sign up/login with GitHub
3. Click "New Project"
4. Name it "chrondle" or "chrondle-prod"
5. Choose "Next.js" as the framework

### 2. Get Deployment Keys

From the Convex dashboard:

1. Go to Settings → Deploy Key
2. Copy the `CONVEX_DEPLOY_KEY`
3. Note the Convex URL (format: https://your-project.convex.cloud)

### 3. Add to the Web Host Environment

Set these in root-owned mode-`0600` `/etc/public-apps/chrondle.env`:

1. `CONVEX_DEPLOY_KEY`
2. `NEXT_PUBLIC_CONVEX_URL`
3. Build a new standalone web release so the public URL is embedded, install
   it, and restart `chrondle.service`

### 4. Local Development Setup

Create `.env.local`:

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOY_KEY=your-deploy-key
```

### 5. Initialize Convex

Once environment variables are set:

```bash
npx convex dev
```

This will:

- Connect to your Convex project
- Generate TypeScript types
- Start the development server

## Verification

Run these commands to verify setup:

```bash
# Check local environment variable names without printing their values
env | awk -F= '/^CONVEX_DEPLOY_KEY=|^NEXT_PUBLIC_CONVEX_URL=/{print $1}'

# Test Convex connection
npx convex dev --once
```

## Next Steps

After setup is complete:

1. Run data migration script to import puzzles
2. Configure Clerk authentication
3. Set up Stripe webhooks
