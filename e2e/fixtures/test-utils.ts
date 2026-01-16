/* eslint-disable no-console */
/**
 * E2E Test Utilities for Subscription Testing
 *
 * Provides helpers for:
 * - Clerk authentication
 * - Subscription state management
 * - Stripe checkout mocking
 */
import { type Page } from "@playwright/test";

// Test user credentials from environment
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || "test@chrondle.app",
  password: process.env.TEST_USER_PASSWORD || "",
  clerkId: process.env.TEST_USER_CLERK_ID || "",
};

// Stripe test card numbers
export const STRIPE_TEST_CARDS = {
  success: "4242424242424242",
  decline: "4000000000000002",
  requires3ds: "4000002500003155",
  insufficientFunds: "4000000000009995",
};

/**
 * Sign in with Clerk using email/password
 *
 * Requires TEST_USER_EMAIL and TEST_USER_PASSWORD env vars
 */
export async function clerkSignIn(page: Page): Promise<void> {
  if (!TEST_USER.email || !TEST_USER.password) {
    throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in environment");
  }

  // Click sign-in button to open Clerk modal
  const signInButton = page.getByRole("button", { name: /sign in/i });
  if (await signInButton.isVisible()) {
    await signInButton.click();
  }

  // Wait for Clerk modal
  await page.waitForSelector('text="Sign in to Chrondle"', { timeout: 10000 });

  // Enter email
  const emailInput = page.getByRole("textbox", { name: /email/i });
  await emailInput.fill(TEST_USER.email);

  // Click continue
  await page.getByRole("button", { name: /continue/i }).click();

  // Wait for password field
  await page.waitForSelector('input[type="password"]', { timeout: 5000 });

  // Enter password
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.fill(TEST_USER.password);

  // Submit
  await page.getByRole("button", { name: /continue/i }).click();

  // Wait for sign-in to complete (modal closes, user button appears)
  await page.waitForSelector("[data-clerk-user-button]", { timeout: 15000 });
}

/**
 * Sign out from Clerk
 */
export async function clerkSignOut(page: Page): Promise<void> {
  const userButton = page.locator("[data-clerk-user-button]");
  if (await userButton.isVisible()) {
    await userButton.click();
    await page.getByRole("button", { name: /sign out/i }).click();
    // Wait for sign out to complete
    await page.waitForSelector('button:has-text("Sign in")', { timeout: 5000 });
  }
}

/**
 * Check if user is signed in
 */
export async function isSignedIn(page: Page): Promise<boolean> {
  const userButton = page.locator("[data-clerk-user-button]");
  return userButton.isVisible();
}

/**
 * Reset subscription state via Convex (test environment only)
 *
 * This calls a test-only endpoint that clears subscription data.
 * Only available when CONVEX_TEST_SECRET is set.
 */
export async function resetSubscription(clerkId: string): Promise<void> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const testSecret = process.env.CONVEX_TEST_SECRET;

  if (!convexUrl || !testSecret) {
    console.warn("Skipping subscription reset: CONVEX_TEST_SECRET not configured");
    return;
  }

  // Call test-only mutation via HTTP action
  const response = await fetch(`${convexUrl}/api/test/resetSubscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${testSecret}`,
    },
    body: JSON.stringify({ clerkId }),
  });

  if (!response.ok) {
    console.warn(`Failed to reset subscription: ${response.status}`);
  }
}

/**
 * Simulate successful Stripe checkout completion
 *
 * In test mode, this triggers the webhook handler directly
 * with a mocked checkout.session.completed event.
 */
export async function simulateSuccessfulCheckout(
  clerkId: string,
  plan: "monthly" | "annual" = "monthly",
): Promise<void> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const testSecret = process.env.CONVEX_TEST_SECRET;

  if (!convexUrl || !testSecret) {
    console.warn("Skipping checkout simulation: CONVEX_TEST_SECRET not configured");
    return;
  }

  const response = await fetch(`${convexUrl}/api/test/simulateCheckout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${testSecret}`,
    },
    body: JSON.stringify({ clerkId, plan }),
  });

  if (!response.ok) {
    console.warn(`Failed to simulate checkout: ${response.status}`);
  }
}

/**
 * Wait for subscription status to update in UI
 */
export async function waitForSubscriptionUpdate(page: Page, timeout = 10000): Promise<void> {
  // Wait for either "Unlock archive" to disappear or "Manage subscription" to appear
  await Promise.race([
    page.waitForSelector('text="Manage subscription"', { timeout }),
    page.waitForFunction(() => !document.body.textContent?.includes("Unlock archive"), { timeout }),
  ]);
}

/**
 * Navigate to pricing page and verify it loaded
 */
export async function goToPricing(page: Page): Promise<void> {
  await page.goto("/pricing");
  await page.waitForSelector('text="Unlock the Archive"', { timeout: 10000 });
}

/**
 * Navigate to archive page
 */
export async function goToArchive(page: Page): Promise<void> {
  await page.goto("/archive");
  await page.waitForSelector('text="Puzzle Archive"', { timeout: 10000 });
}
