# Convex Setup Guide

## Prerequisites

- Convex account (create at https://dashboard.convex.dev)
- Cloudflare account access for the existing web Worker
- Access to the repository's existing production secret broker

## Setup Steps

Production continues to use `fleet-goldfish-183`; the DigitalOcean web/DNS exit
does not create a replacement Convex project or migrate its data. Project
creation below applies only to a new development setup.

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

### 3. Configure the Existing Release Chain

Keep `CONVEX_DEPLOY_KEY` in the existing backend deployment secret and
`NEXT_PUBLIC_CONVEX_URL` set to the existing production deployment for web
builds and Worker runtime. Never pass the deployment key to the web compiler.

Merge a reviewed, green change to `master`. CD deploys compatible Convex first,
embeds the public URL in the OpenNext build, then installs/verifies the
Cloudflare Worker. See [the deployment guide](../docs/deployment-guide.md) for
apex/www delegation and rollback; hosted Convex is unchanged.

### 4. Local Development Setup

Create `.env.local`:

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOY_KEY=your-deploy-key
```

### 5. Initialize Convex

Once environment variables are set:

```bash
bunx convex dev
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
bunx convex dev --once
```

## Next Steps

After setup is complete:

1. Run data migration script to import puzzles
2. Configure Clerk authentication
3. Set up Stripe webhooks
