# Chrondle: The Daily History Game

[![Lines](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/phrazzld/e8c4bf5ebfd4fbacdd6d2261a22d21b3/raw/coverage-lines.json)](https://github.com/misty-step/chrondle/actions)
[![Branches](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/phrazzld/e8c4bf5ebfd4fbacdd6d2261a22d21b3/raw/coverage-branches.json)](https://github.com/misty-step/chrondle/actions)
[![Functions](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/phrazzld/e8c4bf5ebfd4fbacdd6d2261a22d21b3/raw/coverage-functions.json)](https://github.com/misty-step/chrondle/actions)
[![Statements](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/phrazzld/e8c4bf5ebfd4fbacdd6d2261a22d21b3/raw/coverage-statements.json)](https://github.com/misty-step/chrondle/actions)

Chrondle is a free daily history puzzle: read the clues, drag a range onto the
timeline, and see if it contains the real year a historical event happened.
Play today's puzzle at **[chrondle.app](https://chrondle.app)**.

![Chrondle gameplay: dragging a year range to contain a historical event](docs/launch/product-hunt/assets/gameplay-preview.gif)

## How to Play

1. **Dial in a Range:** Drag or type a historical range (e.g., 1910–1930) that you believe contains the event.
2. **Check Containment:** Submit the range to learn whether the true year sits inside; containment is required to win.
3. **Reveal up to Six Hints:** Each miss unlocks another clue (era buckets through precise deltas). Every hint slightly lowers the max score.
4. **Chase 100 Points:** Narrower ranges earn more of the 100-point cap. Win by containing the year before you run out of attempts — or learn from the revealed answer and hint trail.

## Features

- **Classic Mode:** the core daily range-guess puzzle described above, free for everyone.
- **Duel Mode:** two historical events, tap the one that happened first, and see how long your streak lasts. Free for everyone.
- **Order Mode:** arrange a set of events from earliest to latest, with limited misses. Free for everyone.
- **Archive:** browse and replay past puzzles. Recent puzzles are free; deeper archive access is part of the paid subscription (see below).
- **Progressive Hints:** each incorrect guess reveals another clue.
- **Local-Day Puzzles:** "today" is your local calendar day — the daily puzzle rolls over at YOUR midnight, and every surface (homepage, game pages, archive, countdown, streaks) agrees on which puzzle is today's.
- **Daily Notifications:** optional reminders to play each day's puzzle, with a customizable time. See [Notifications](docs/guides/notifications.md) for setup and troubleshooting.
- **Accounts:** play anonymously with local-storage progress, or sign in (email magic link or Google) for cross-device sync and permanent history.

### Free / Paid Boundary

Classic, Duel, and Order are free to play, full stop. A $0.99/mo (or $9.99/yr)
subscription via Stripe unlocks the full puzzle archive and funds daily event
generation and maintenance — see [chrondle.app/pricing](https://chrondle.app/pricing).

## Development

This project is built with:

- **Next.js 16:** React framework for production.
- **React 19:** for building interactive user interfaces.
- **Convex:** real-time backend and database.
- **Tailwind CSS:** for rapid UI development and styling.
- **TypeScript:** for type safety and improved developer experience.
- **Vitest:** for unit and integration testing.

### Dependency Management

This project uses Bun with `package.json` overrides to address security vulnerabilities in transitive dependencies. See [docs/dependency-overrides.md](docs/dependency-overrides.md) for details on:

- Current overrides and their rationale
- Maintenance guidelines
- Removal criteria and testing procedures

### Regenerating Favicons

If `public/logo.svg` changes, regenerate all favicon assets with:

```bash
bun run assets:favicons
```

### Daily Day Semantics

Chrondle's canonical "today" is the **player's local calendar day**, not a
server-clock day — see [DST Handling](docs/development/DST_HANDLING_RESEARCH.md)
for the full rationale and the timezone edge cases it resolves. The
single day-resolution module is [`src/lib/time/dailyDate.ts`](src/lib/time/dailyDate.ts).

## User Accounts & Anonymous Play

Chrondle supports both anonymous and authenticated gameplay:

### Anonymous Play

- **No account required:** start playing immediately without signing up
- **Local progress saving:** your game progress is automatically saved to your browser's local storage
- **24-hour persistence:** anonymous sessions remain active for 24 hours
- **Cross-session continuity:** close your browser and return later — your puzzle progress is preserved

### Authenticated Play

- **Sign in with email:** use magic links for passwordless authentication
- **Google sign-in:** quick authentication with your Google account
- **Cross-device sync:** your progress syncs across all your devices
- **Permanent history:** all your past games are saved permanently
- **Automatic migration:** when you create an account, your anonymous progress automatically transfers

### Mobile Authentication

- **Optimized for mobile:** authentication uses a redirect flow on mobile devices for better compatibility
- **Email app friendly:** magic link authentication works seamlessly when switching between browser and email apps

## Requirements

- **Node.js 20+**: this project requires Node.js version 20 or higher. Use the `.nvmrc` file with nvm:
  ```bash
  nvm use
  ```
- **Bun**: this project uses Bun exclusively as the package manager. pnpm, npm, and yarn are not supported.
- **Colima**: local Dagger-backed CI uses Colima on macOS. Start it with `colima start --profile default`.
- **ESM Modules**: the codebase uses ES modules throughout. All configuration files use `.mjs` extensions or TypeScript.

## Getting Started

### Local Development

1.  Clone the repository:

    ```bash
    git clone https://github.com/misty-step/chrondle.git
    cd chrondle
    ```

2.  Install dependencies:

    ```bash
    bun install
    ```

3.  Set up environment variables:

    ```bash
    cp .env.example .env.local
    ```

    Edit `.env.local` with your configuration (see Environment Setup below).

4.  Start the full development stack:

    ```bash
    bun run dev
    ```

Open [http://localhost:3000](http://localhost:3000) in your browser to play.

### Local CI

Local Dagger runs are wrapped through Colima:

```bash
colima start --profile default
bun run ci:dagger:lint
bun run ci:dagger:type-check
bun run ci:dagger:validation
bun run ci:dagger:docs
```

The repo-local wrapper lives at [`scripts/dagger-local.sh`](./scripts/dagger-local.sh). Set `CHRONDLE_DAGGER_FORCE_DOCKER=1` only if you need to bypass Colima and use a healthy Docker CLI directly.

## Deployment

### Prerequisites

Before deploying Chrondle, you'll need accounts for:

- **[Vercel](https://vercel.com)** - For hosting the Next.js application
- **[Convex](https://convex.dev)** - For the backend database and real-time sync
- **[Clerk](https://clerk.com)** - For authentication (optional but recommended)

### Environment Setup

Chrondle requires several environment variables for production deployment. Copy `.env.example` to `.env.local` and configure:

#### Required Variables

**Convex Configuration:**

- `NEXT_PUBLIC_CONVEX_URL` - Your Convex deployment URL (e.g., `https://your-project.convex.cloud`)
- `CONVEX_DEPLOY_KEY` - Generate from Convex Dashboard → Settings → Deploy Keys

**Clerk Authentication:**

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - From Clerk Dashboard → API Keys
- `CLERK_SECRET_KEY` - From Clerk Dashboard → API Keys (keep secure!)
- `CLERK_WEBHOOK_SECRET` - Create webhook at Clerk Dashboard → Webhooks
  - Endpoint URL: `https://your-domain.com/api/webhooks/clerk`
  - Subscribe to events: `user.created`, `user.updated`

#### Optional Variables

- `OPENROUTER_API_KEY` - For AI-powered historical context features
- Stripe keys - For subscription/archive-access features

### Deploying to Vercel

1. **Fork or push this repository to GitHub**

2. **Set up Convex:**

   ```bash
   bunx convex deploy --prod
   ```

   This will create a production deployment and provide your `NEXT_PUBLIC_CONVEX_URL`.

3. **Import to Vercel:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

4. **Configure Environment Variables in Vercel:**
   - Go to Project Settings → Environment Variables
   - Add all required variables from `.env.example`:
     - `NEXT_PUBLIC_CONVEX_URL`
     - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
     - `CLERK_SECRET_KEY`
     - `CONVEX_DEPLOY_KEY`
     - `CLERK_WEBHOOK_SECRET` (if using Clerk webhooks)

5. **Configure Build Settings:**
   - Vercel should auto-detect the Next.js settings for this repository
   - `vercel.json` only declares the framework, so no custom build or install command is required

6. **Deploy:**
   - Click "Deploy"
   - Vercel will build and deploy your application

### Post-Deployment

1. **Configure Clerk Webhook (if using authentication):**
   - In Clerk Dashboard, update the webhook endpoint to your production URL:
     `https://your-app.vercel.app/api/webhooks/clerk`

2. **Verify Deployment:**
   - Visit your deployed URL
   - Check that daily puzzles load correctly
   - Test user authentication (if configured)
   - Verify puzzle archive functionality

### Deployment Checklist

- [ ] Convex project created and deployed
- [ ] All environment variables added to Vercel
- [ ] Clerk authentication configured (optional)
- [ ] Webhook endpoints updated with production URLs
- [ ] Build succeeds without errors
- [ ] Daily puzzle loads correctly
- [ ] Archive page displays puzzles
- [ ] User authentication works (if enabled)

### Production Features Verification

Run the verification scripts to ensure production readiness:

```bash
# Verify authentication configuration
bun run verify:auth:prod

# Check deployment readiness
bun run deployment:check

# Validate Convex configuration
bun run verify:convex
```

### Troubleshooting

**White screen or loading issues:**

- Verify `NEXT_PUBLIC_CONVEX_URL` is set correctly
- Check browser console for errors
- Ensure Convex deployment is active

**Authentication not working:**

- Verify Clerk keys are correct (use `bun run verify:auth:prod`)
- Check webhook configuration
- Ensure `CLERK_WEBHOOK_SECRET` matches the webhook settings

**Build failures:**

- Check all required environment variables are set
- Verify `bun run build` succeeds locally
- Review build logs for specific errors

**Notification issues:** see [docs/guides/notifications.md](docs/guides/notifications.md).

**Daily puzzle timing:**

- Confirm cron job is running (check Convex dashboard logs)
- Remember "today" is the PLAYER'S local calendar day (see [Daily Day Semantics](#daily-day-semantics)
  above) — a puzzle number that differs between two machines usually means the
  machines are on different local dates, not a bug

For more detailed setup instructions, see the [Convex Next.js Quickstart](https://docs.convex.dev/quickstart/nextjs) and [Clerk Next.js Documentation](https://clerk.com/docs/quickstarts/nextjs).
