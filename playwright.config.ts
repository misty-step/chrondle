import { defineConfig, devices } from "@playwright/test";

// Load test environment variables
import { config } from "dotenv";
config({ path: ".env.test.local" });

const PORT = process.env.TEST_PORT ? parseInt(process.env.TEST_PORT) : 3000;
const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  webServer: process.env.TEST_SKIP_SERVER
    ? undefined
    : {
        command: process.env.CI ? "pnpm start" : "pnpm dev:next",
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },

  projects: [
    // Fast paywall tests (no auth required)
    {
      name: "paywall",
      testMatch: /subscription\.spec\.ts/,
      grep: /@paywall/,
      use: { ...devices["Desktop Chrome"] },
    },
    // Authenticated tests (requires test user)
    {
      name: "authenticated",
      testMatch: /subscription\.spec\.ts/,
      grep: /@authenticated/,
      use: { ...devices["Desktop Chrome"] },
    },
    // Checkout tests (interacts with Stripe)
    {
      name: "checkout",
      testMatch: /subscription\.spec\.ts/,
      grep: /@checkout/,
      use: { ...devices["Desktop Chrome"] },
    },
    // Default: run all tests
    {
      name: "chromium",
      testIgnore: /subscription\.spec\.ts/, // Subscription tests use specific projects
      use: { ...devices["Desktop Chrome"] },
    },
    // All subscription tests together
    {
      name: "subscription",
      testMatch: /subscription\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
