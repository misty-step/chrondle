# Chrondle: The Daily History Game

[![Lines](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/phrazzld/e8c4bf5ebfd4fbacdd6d2261a22d21b3/raw/coverage-lines.json)](https://github.com/misty-step/chrondle/actions)
[![Branches](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/phrazzld/e8c4bf5ebfd4fbacdd6d2261a22d21b3/raw/coverage-branches.json)](https://github.com/misty-step/chrondle/actions)
[![Functions](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/phrazzld/e8c4bf5ebfd4fbacdd6d2261a22d21b3/raw/coverage-functions.json)](https://github.com/misty-step/chrondle/actions)
[![Statements](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/phrazzld/e8c4bf5ebfd4fbacdd6d2261a22d21b3/raw/coverage-statements.json)](https://github.com/misty-step/chrondle/actions)

**Chrondle** is an engaging web-based puzzle game where your knowledge of history is put to the test! Guess the year of a historical event based on a series of revealing clues. Each day brings a new challenge, spanning millennia of human history.

## Features

- **Daily Puzzles:** A fresh historical event to guess every day, dynamically generated from our database of 1,821 historical events.
- **Progressive Hints:** Uncover more clues with each incorrect guess.
- **Intuitive Interface:** Clean and responsive design built with Next.js and Tailwind CSS.
- **Historical Range:** Puzzles cover a vast timeline, from ancient civilizations to recent events.
- **Dynamic Puzzle Generation:** Puzzles are created on-demand each day from our events database using a deterministic algorithm - ensuring the same puzzle globally for all players.
- **Daily Notifications:** Optional reminders to play each day's puzzle, with customizable notification times.
- **Smart Timezone Handling:** Daily puzzle resets at midnight Central Time, automatically adjusting for daylight saving time transitions.

## Daily Notifications

Chrondle offers optional daily reminders to help you maintain your streak:

### Features

- **Customizable Time:** Set your preferred notification time (default: 9:00 AM)
- **Browser Notifications:** Native browser push notifications on desktop and mobile
- **Service Worker Support:** Notifications work even when the app isn't open
- **Smart Permission Flow:** Two-step process that explains benefits before requesting permission
- **Visual Feedback:** Bell icon shows notification status at a glance

### Setting Up Notifications

1. Click the **bell icon** in the top navigation bar
2. Toggle notifications on and select your preferred time
3. Click "Enable Notifications" to see the benefits
4. Grant permission when prompted by your browser
5. You'll receive a daily reminder at your chosen time!

### Notification States

- **🔔 Bell icon (filled):** Notifications enabled and active
- **🔔 Bell icon (outline):** Notifications available but not enabled
- **🔕 Bell with slash:** Notifications blocked by browser settings

### Troubleshooting

- **Not receiving notifications?** Check your browser's notification settings
- **Mobile issues?** Ensure the site is added to your home screen for best results
- **Changed your mind?** You can disable notifications anytime from the bell menu

## How to Play

You can play Chrondle directly at [chrondle.app](https://chrondle.app).

## Development

### Dependency Management

This project uses pnpm with specific dependency overrides to address security vulnerabilities in transitive dependencies. See [docs/dependency-overrides.md](docs/dependency-overrides.md) for details on:

- Current overrides and their rationale
- Maintenance guidelines
- Removal criteria and testing procedures

1.  **Dial in a Range:** Drag or type a historical range (e.g., 1910–1930) that you believe captures the event.
2.  **Check Containment:** Submit the range to learn whether the true year sits inside; containment is required to win.
3.  **Reveal up to Six Hints:** Each miss unlocks another clue (era buckets through precise deltas). Every hint slightly lowers the max score.
4.  **Chase 100 Points:** Narrower ranges earn more of the 100-point cap. Win by containing the year before you run out of attempts—or learn from the revealed answer and hint trail.

## User Accounts & Anonymous Play

Chrondle supports both anonymous and authenticated gameplay:

### Anonymous Play

- **No account required:** Start playing immediately without signing up
- **Local progress saving:** Your game progress is automatically saved to your browser's local storage
- **24-hour persistence:** Anonymous sessions remain active for 24 hours
- **Cross-session continuity:** Close your browser and return later - your puzzle progress is preserved

### Authenticated Play

- **Sign in with email:** Use magic links for passwordless authentication
- **Google sign-in:** Quick authentication with your Google account
- **Cross-device sync:** Your progress syncs across all your devices
- **Permanent history:** All your past games are saved permanently
- **Automatic migration:** When you create an account, your anonymous progress automatically transfers

### Mobile Authentication

- **Optimized for mobile:** Authentication uses redirect flow on mobile devices for better compatibility
- **Email app friendly:** Magic link authentication works seamlessly when switching between browser and email apps

## Technical Architecture

### Daily Puzzle Scheduling

Chrondle implements sophisticated scheduling to ensure puzzles reset at midnight Central Time:

#### DST-Aware Cron System

- **Automatic DST Handling:** The system detects whether Central Time is in CST (UTC-6) or CDT (UTC-5)
- **Daily Recalculation:** UTC offset is computed daily to handle DST transitions seamlessly
- **Spring Forward/Fall Back:** Correctly handles the twice-yearly time changes without manual intervention
- **Global Consistency:** All players worldwide receive the same puzzle at Central Time midnight

#### Implementation Details

```typescript
// Dynamic UTC hour calculation for Central Time midnight
function getUTCHourForCentralMidnight(): number {
  const now = new Date();
  const chicagoTime = new Date(now.toLocaleString("en-US", {
    timeZone: "America/Chicago"
  }));
  const isDST = /* DST detection logic */;
  return isDST ? 5 : 6; // UTC 5 AM (CDT) or 6 AM (CST)
}
```

- **Convex Cron Jobs:** Backend scheduled tasks run at the calculated UTC hour
- **Timezone Library:** Uses standard IANA timezone database (America/Chicago)
- **Edge Case Handling:** Properly manages the ambiguous hour during "fall back"

### Notification System Architecture

- **Service Worker:** Background script handles push notifications
- **Permission Management:** Graceful handling of permission states
- **Persistence:** User preferences saved to both localStorage and Convex
- **Cross-Device Sync:** Authenticated users' settings sync across devices

## Development

This project is built with:

- **Next.js 15:** React framework for production.
- **React 19:** For building interactive user interfaces.
- **Tailwind CSS:** For rapid UI development and styling.
- **TypeScript:** For type safety and improved developer experience.
- **Vitest:** For unit and integration testing.

## Requirements

- **Node.js 20+**: This project requires Node.js version 20 or higher. Use the `.nvmrc` file with nvm:
  ```bash
  nvm use
  ```
- **pnpm**: This project uses pnpm exclusively as the package manager. npm and yarn are not supported.
- **ESM Modules**: The codebase uses ES modules throughout. All configuration files use `.mjs` extensions or TypeScript.

## Getting Started

### Local Development

1.  Clone the repository:

    ```bash
    git clone https://github.com/phaedrus/chrondle.git
    cd chrondle
    ```

2.  Install dependencies:

    ```bash
    pnpm install
    ```

3.  Set up environment variables:

    ```bash
    cp .env.example .env.local
    ```

    Edit `.env.local` with your configuration (see Environment Setup below).

4.  Start Convex development server:

    ```bash
    npx convex dev
    ```

5.  In a new terminal, start the Next.js development server:
    ```bash
    pnpm dev
    ```

Open [http://localhost:3000](http://localhost:3000) in your browser to play.

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
- Stripe keys - For future premium features

### Deploying to Vercel

1. **Fork or push this repository to GitHub**

2. **Set up Convex:**

   ```bash
   npx convex deploy --prod
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

   - Vercel should auto-detect Next.js settings
   - The build command is already configured in `vercel.json`:
     ```json
     {
       "buildCommand": "npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL"
     }
     ```

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
pnpm verify:auth:prod

# Check deployment readiness
pnpm deployment:check

# Validate Convex configuration
pnpm verify:convex
```

### Troubleshooting

**White screen or loading issues:**

- Verify `NEXT_PUBLIC_CONVEX_URL` is set correctly
- Check browser console for errors
- Ensure Convex deployment is active

**Authentication not working:**

- Verify Clerk keys are correct (use `pnpm verify:auth:prod`)
- Check webhook configuration
- Ensure `CLERK_WEBHOOK_SECRET` matches the webhook settings

**Build failures:**

- Check all required environment variables are set
- Verify `vercel.json` is present in the repository
- Review build logs for specific errors

**Notification issues:**

- Verify service worker is registered (check Application tab in DevTools)
- Ensure HTTPS is enabled (required for service workers)
- Check browser notification permissions

**Daily puzzle timing:**

- Confirm cron job is running (check Convex dashboard logs)
- Verify DST calculations are correct for current date
- Check that server timezone handling matches Central Time

For more detailed setup instructions, see the [Convex Next.js Quickstart](https://docs.convex.dev/quickstart/nextjs) and [Clerk Next.js Documentation](https://clerk.com/docs/quickstarts/nextjs).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
