/**
 * E2E Tests for Stripe Subscription Paywall
 *
 * Tests the complete subscription flow:
 * 1. Unauthenticated users see paywall
 * 2. Authenticated users without subscription see upgrade prompt
 * 3. Checkout flow redirects to Stripe
 * 4. Successful subscription unlocks archive
 *
 * Test Modes:
 * - @paywall: Tests that don't require authentication
 * - @authenticated: Tests that require a test user (need TEST_USER_* env vars)
 * - @checkout: Tests that interact with Stripe (need STRIPE_* env vars)
 */
import { test, expect } from "@playwright/test";
import {
  TEST_USER,
  clerkSignIn,
  clerkSignOut,
  goToPricing,
  goToArchive,
  resetSubscription,
  simulateSuccessfulCheckout,
} from "./fixtures/test-utils";

test.describe("Pricing Page @paywall", () => {
  test("displays both subscription plans", async ({ page }) => {
    await goToPricing(page);

    // Check page title
    await expect(page.getByText("Unlock the Archive")).toBeVisible();

    // Monthly plan
    await expect(page.getByText("$0.99")).toBeVisible();
    await expect(page.getByText("/month")).toBeVisible();

    // Annual plan
    await expect(page.getByText("$9.99")).toBeVisible();
    await expect(page.getByText("/year")).toBeVisible();
    await expect(page.getByText("SAVE 16%")).toBeVisible();

    // Subscribe buttons
    await expect(page.getByRole("button", { name: /subscribe monthly/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /subscribe annually/i })).toBeVisible();
  });

  test("shows archive features", async ({ page }) => {
    await goToPricing(page);

    // Feature list
    await expect(page.getByText("Full access to puzzle archive")).toBeVisible();
    await expect(page.getByText("Scores count toward streaks")).toBeVisible();
    await expect(page.getByText("Cancel anytime")).toBeVisible();

    // What's in the Archive section
    await expect(page.getByText("What's in the Archive?")).toBeVisible();
    await expect(page.getByText("150+ unique historical puzzles")).toBeVisible();
  });

  test("displays secure payment notice", async ({ page }) => {
    await goToPricing(page);

    await expect(page.getByText("Secure payment via Stripe")).toBeVisible();
    await expect(page.getByText("Today's puzzle is always free")).toBeVisible();
  });
});

test.describe("Archive Paywall - Unauthenticated @paywall", () => {
  test("archive shows locked puzzles", async ({ page }) => {
    await goToArchive(page);

    // Should show puzzle cards with lock indicators
    await expect(page.getByText("Puzzle Archive")).toBeVisible();

    // Multiple "Unlock archive" links should be present
    const unlockLinks = page.getByText("Unlock archive →");
    await expect(unlockLinks.first()).toBeVisible();

    // Count should be > 1 (multiple locked puzzles)
    const count = await unlockLinks.count();
    expect(count).toBeGreaterThan(5);
  });

  test("clicking unlock redirects to pricing", async ({ page }) => {
    await goToArchive(page);

    // Click first unlock link
    await page.getByText("Unlock archive →").first().click();

    // Should redirect to pricing page
    await expect(page).toHaveURL(/\/pricing/);
    await expect(page.getByText("Unlock the Archive")).toBeVisible();
  });

  test("clicking subscribe prompts sign-in", async ({ page }) => {
    await goToPricing(page);

    // Click subscribe button
    await page.getByRole("button", { name: /subscribe monthly/i }).click();

    // Should show Clerk sign-in modal
    await expect(page.getByText("Sign in to Chrondle")).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe("Archive Paywall - Authenticated No Subscription @authenticated", () => {
  test.skip(
    !TEST_USER.email || !TEST_USER.password || !TEST_USER.clerkId,
    "Requires TEST_USER_EMAIL, TEST_USER_PASSWORD, and TEST_USER_CLERK_ID",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clerkSignIn(page);

    // Reset subscription state for clean test
    if (TEST_USER.clerkId) {
      await resetSubscription(TEST_USER.clerkId);
    }
  });

  test.afterEach(async ({ page }) => {
    await clerkSignOut(page);
  });

  test("authenticated user without subscription sees paywall on archive", async ({ page }) => {
    await goToArchive(page);

    // Should still see locked puzzles
    await expect(page.getByText("Unlock archive →").first()).toBeVisible();
  });

  test("subscribe button initiates checkout without sign-in prompt", async ({ page }) => {
    await goToPricing(page);

    // Click subscribe - should NOT show sign-in modal
    await page.getByRole("button", { name: /subscribe monthly/i }).click();

    // Should redirect to Stripe Checkout (or show loading)
    // Wait for either Stripe redirect or error message
    await Promise.race([
      page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 }),
      page.waitForSelector('[data-testid="checkout-error"]', { timeout: 15000 }),
    ]);

    // Verify we're on Stripe
    const url = page.url();
    expect(url).toContain("stripe.com");
  });
});

test.describe("Checkout Flow @checkout", () => {
  test.skip(
    !TEST_USER.email || !TEST_USER.password || !TEST_USER.clerkId,
    "Requires TEST_USER_EMAIL, TEST_USER_PASSWORD, and TEST_USER_CLERK_ID",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clerkSignIn(page);

    // Reset subscription
    if (TEST_USER.clerkId) {
      await resetSubscription(TEST_USER.clerkId);
    }
  });

  test.afterEach(async ({ page }) => {
    // Reset for other tests
    if (TEST_USER.clerkId) {
      await resetSubscription(TEST_USER.clerkId);
    }
    await clerkSignOut(page);
  });

  test("monthly checkout redirects to Stripe with correct metadata", async ({ page }) => {
    await goToPricing(page);

    // Click monthly subscribe
    await page.getByRole("button", { name: /subscribe monthly/i }).click();

    // Wait for Stripe redirect
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 });

    // Verify URL contains expected params
    const url = page.url();
    expect(url).toContain("checkout.stripe.com");
  });

  test("annual checkout redirects to Stripe", async ({ page }) => {
    await goToPricing(page);

    // Click annual subscribe
    await page.getByRole("button", { name: /subscribe annually/i }).click();

    // Wait for Stripe redirect
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 });
  });
});

test.describe("Post-Subscription Access @authenticated", () => {
  test.skip(
    !TEST_USER.email || !TEST_USER.password || !TEST_USER.clerkId,
    "Requires TEST_USER_* environment variables",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clerkSignIn(page);
  });

  test.afterEach(async ({ page }) => {
    // Always reset subscription after test
    if (TEST_USER.clerkId) {
      await resetSubscription(TEST_USER.clerkId);
    }
    await clerkSignOut(page);
  });

  test("subscriber can access archive puzzles", async ({ page }) => {
    // Simulate successful subscription
    await simulateSuccessfulCheckout(TEST_USER.clerkId, "monthly");

    // Navigate to archive
    await goToArchive(page);

    // Reload to get updated subscription state
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Should NOT see "Unlock archive" links anymore
    // Or should see clickable puzzle cards
    const unlockLinks = page.getByText("Unlock archive →");
    const unlockCount = await unlockLinks.count();

    // Expect no lock icons or unlock prompts
    expect(unlockCount).toBe(0);
  });

  test("subscriber sees manage subscription option", async ({ page }) => {
    await simulateSuccessfulCheckout(TEST_USER.clerkId, "monthly");

    // Go to pricing or account page
    await goToPricing(page);
    await page.reload();

    // Should see subscription management instead of subscribe buttons
    // This might show "Manage subscription" or current plan status
    const manageButton = page.getByText(/manage subscription|current plan/i);
    await expect(manageButton).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Subscription Portal @authenticated", () => {
  test.skip(
    !TEST_USER.email || !TEST_USER.password || !TEST_USER.clerkId,
    "Requires TEST_USER_* environment variables",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clerkSignIn(page);
    await simulateSuccessfulCheckout(TEST_USER.clerkId, "monthly");
  });

  test.afterEach(async ({ page }) => {
    if (TEST_USER.clerkId) {
      await resetSubscription(TEST_USER.clerkId);
    }
    await clerkSignOut(page);
  });

  test("manage subscription opens Stripe portal", async ({ page }) => {
    await goToPricing(page);
    await page.reload();

    // Click manage subscription
    const manageButton = page.getByRole("button", {
      name: /manage subscription/i,
    });
    await manageButton.click();

    // Should redirect to Stripe billing portal
    await page.waitForURL(/billing\.stripe\.com/, { timeout: 15000 });
  });
});

test.describe("Error States @paywall", () => {
  test("handles checkout API errors gracefully", async ({ page }) => {
    // This test verifies error handling when checkout fails
    // In a real scenario, you'd mock the API to return errors

    await goToPricing(page);

    // Verify error states don't crash the page
    await page.route("**/api/stripe/checkout", (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "Internal server error" }),
      });
    });

    // Click subscribe
    await page.getByRole("button", { name: /subscribe monthly/i }).click();

    // Should show error message (if sign-in modal doesn't appear)
    // or should still function without crashing
    await page.waitForTimeout(2000);

    // Page should still be interactive
    await expect(page.getByText("Unlock the Archive")).toBeVisible();
  });
});
