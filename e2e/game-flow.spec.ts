/**
 * E2E Happy Path Tests for Chrondle Classic Mode
 *
 * These tests verify the critical user journeys:
 * 1. Homepage → Game selection → Play
 * 2. Game flow: Read hints → Submit range → See feedback
 * 3. Basic accessibility and error-free operation
 *
 * Tagged with @happy-path for CI filtering
 */
import { test, expect, type Page } from "@playwright/test";

// Helper to navigate to the classic game
async function navigateToClassicGame(page: Page) {
  await page.goto("/");

  // Wait for the gallery to load
  await expect(page.getByRole("main")).toBeVisible();

  // Click on Classic mode - the card should be visible
  const classicCard = page.getByRole("button", { name: /classic/i });
  await expect(classicCard).toBeVisible();

  // Click navigates directly to the classic game
  await classicCard.click();

  // Wait for navigation to /classic
  await page.waitForURL(/\/classic/);
}

test.describe("Homepage Navigation @happy-path", () => {
  test("homepage loads games gallery", async ({ page }) => {
    await page.goto("/");

    // Gallery should display mode cards
    await expect(page.getByRole("main")).toBeVisible();

    // Should show Classic and Order modes (headings)
    await expect(page.getByRole("heading", { name: "Classic" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Order" })).toBeVisible();

    // Should have branding (use exact match to avoid title element)
    await expect(page.getByText("Chrondle", { exact: true })).toBeVisible();
  });

  test("can navigate from homepage to classic game", async ({ page }) => {
    await navigateToClassicGame(page);

    // Should be on classic page
    expect(page.url()).toContain("/classic");

    // Should see the primary clue area (this proves the game loaded)
    await expect(page.getByText("Primary Clue")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Classic Game Flow @happy-path", () => {
  test("puzzle loads with first clue visible", async ({ page }) => {
    await page.goto("/classic");

    // Wait for puzzle to load - look for "Primary Clue" label
    const primaryClue = page.getByText("Primary Clue");
    await expect(primaryClue).toBeVisible({ timeout: 10000 });

    // Should show game instructions
    await expect(page.getByRole("heading", { name: /date this event/i })).toBeVisible();

    // Should show hint indicator (e.g., "0 of 5 hints revealed")
    await expect(page.getByRole("img", { name: /hints revealed/i })).toBeVisible();
  });

  test("range input controls are interactive", async ({ page }) => {
    await page.goto("/classic");

    // Wait for game to load
    await expect(page.getByText("Primary Clue")).toBeVisible({ timeout: 10000 });

    // Find start and end year inputs by their aria-labels
    const startYearInput = page.getByRole("textbox", { name: "Start year" });
    const endYearInput = page.getByRole("textbox", { name: "End year" });

    await expect(startYearInput).toBeVisible();
    await expect(endYearInput).toBeVisible();

    // Clear and type new values - use AD era for both to keep range valid
    await startYearInput.clear();
    await startYearInput.fill("1100");
    await startYearInput.blur();

    // Click AD radio for start year (first radiogroup)
    const startEraGroup = page.getByRole("radiogroup", { name: /select era/i }).first();
    await startEraGroup.getByRole("radio", { name: /AD/i }).click();

    await endYearInput.clear();
    await endYearInput.fill("1300");
    await endYearInput.blur();

    // Submit button should become enabled after modification
    // The button text is "Lock In Final Guess" when one-guess mode, or "Submit Range"
    const submitButton = page.getByRole("button", { name: /lock in|submit range/i });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });

  test("can submit a range and see feedback", async ({ page }) => {
    await page.goto("/classic");

    // Wait for game to load
    await expect(page.getByText("Primary Clue")).toBeVisible({ timeout: 10000 });

    // Modify the range to enable submit - use AD era for both
    const startYearInput = page.getByRole("textbox", { name: "Start year" });
    const endYearInput = page.getByRole("textbox", { name: "End year" });

    await startYearInput.clear();
    await startYearInput.fill("1100");
    await startYearInput.blur();

    // Click AD radio for start year
    const startEraGroup = page.getByRole("radiogroup", { name: /select era/i }).first();
    await startEraGroup.getByRole("radio", { name: /AD/i }).click();

    await endYearInput.clear();
    await endYearInput.fill("1300");
    await endYearInput.blur();

    // Submit the range
    const submitButton = page.getByRole("button", { name: /lock in|submit range/i });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // After submission, we should see some state change:
    // - If correct: game complete / score shown ("Game Summary", "The year was...")
    // - If incorrect: still on game screen with "Date This Event" heading
    await page.waitForTimeout(1000); // Wait for animation and state update

    // Verify the page shows either the game screen or completion screen
    const gameHeading = page.getByRole("heading", { name: /date this event/i });
    const yearReveal = page.getByText("The year was");
    const gameSummary = page.getByText("Game Summary");

    // One of these should be visible (game complete shows "The year was" or "Game Summary")
    const gameVisible = await gameHeading.isVisible().catch(() => false);
    const yearVisible = await yearReveal.isVisible().catch(() => false);
    const summaryVisible = await gameSummary.isVisible().catch(() => false);

    expect(gameVisible || yearVisible || summaryVisible).toBe(true);
  });

  test("can use Take Hint button", async ({ page }) => {
    await page.goto("/classic");

    // Wait for game to load
    await expect(page.getByText("Primary Clue")).toBeVisible({ timeout: 10000 });

    // Find the "Take Hint" button
    const takeHintButton = page.getByRole("button", { name: /take hint/i });
    await expect(takeHintButton).toBeVisible();

    // Click to reveal a hint
    await takeHintButton.click();

    // After clicking, the hints revealed count should change
    // Wait for animation
    await page.waitForTimeout(500);

    // Page should still be functional - check hint indicator updated
    await expect(page.getByRole("img", { name: /1 of 5 hints revealed/i })).toBeVisible();
  });
});

test.describe("Range Validation @happy-path", () => {
  test("shows validation when range exceeds limit", async ({ page }) => {
    await page.goto("/classic");

    // Wait for game to load
    await expect(page.getByText("Primary Clue")).toBeVisible({ timeout: 10000 });

    // Default range is 0-0 (year 0 AD), so "Exceeds Limit" should NOT appear initially
    // Submit button disabled because range hasn't been modified yet
    const submitButton = page.getByRole("button", { name: /lock in|submit range/i });
    await expect(submitButton).toBeDisabled();

    // Set a range that exceeds the 250-year limit (W_MAX)
    const startYearInput = page.getByRole("textbox", { name: "Start year" });
    const endYearInput = page.getByRole("textbox", { name: "End year" });

    // Set start year to 1000 BC
    await startYearInput.clear();
    await startYearInput.fill("1000");
    const startEraGroup = page.getByRole("radiogroup", { name: /select era/i }).first();
    await startEraGroup.getByRole("radio", { name: /BC/i }).click();
    await startYearInput.blur();

    // Set end year to 2000 AD (3000 year span - exceeds 250 limit)
    await endYearInput.clear();
    await endYearInput.fill("2000");
    const endEraGroup = page.getByRole("radiogroup", { name: /select era/i }).last();
    await endEraGroup.getByRole("radio", { name: /AD/i }).click();
    await endYearInput.blur();

    // Now "Exceeds Limit" should be visible
    await expect(page.getByText("Exceeds Limit")).toBeVisible();

    // Submit button should still be disabled
    await expect(submitButton).toBeDisabled();
  });

  test("valid range enables submission", async ({ page }) => {
    await page.goto("/classic");

    // Wait for game to load
    await expect(page.getByText("Primary Clue")).toBeVisible({ timeout: 10000 });

    // Set a valid range (both in AD era, within 250 years)
    const startYearInput = page.getByRole("textbox", { name: "Start year" });
    const endYearInput = page.getByRole("textbox", { name: "End year" });

    await startYearInput.clear();
    await startYearInput.fill("1900");
    await startYearInput.blur();

    // Click AD radio for start year
    const startEraGroup = page.getByRole("radiogroup", { name: /select era/i }).first();
    await startEraGroup.getByRole("radio", { name: /AD/i }).click();

    await endYearInput.clear();
    await endYearInput.fill("2000");
    await endYearInput.blur();

    // "Exceeds Limit" should not be visible (100-year range is valid)
    await expect(page.getByText("Exceeds Limit")).not.toBeVisible();

    // "Valid" indicator should appear
    await expect(page.getByText("✓ Valid")).toBeVisible();

    // Submit button should be enabled
    const submitButton = page.getByRole("button", { name: /lock in|submit range/i });
    await expect(submitButton).toBeEnabled();
  });
});

test.describe("Accessibility @happy-path", () => {
  test("game has proper ARIA labels", async ({ page }) => {
    await page.goto("/classic");

    // Wait for game to load
    await expect(page.getByText("Primary Clue")).toBeVisible({ timeout: 10000 });

    // Year inputs should have aria-labels
    const startYearInput = page.getByRole("textbox", { name: "Start year" });
    const endYearInput = page.getByRole("textbox", { name: "End year" });

    await expect(startYearInput).toBeVisible();
    await expect(endYearInput).toBeVisible();

    // Era selection should be accessible
    const startEraGroup = page.getByRole("radiogroup", { name: /select era/i }).first();
    await expect(startEraGroup).toBeVisible();

    // Game heading should be visible
    await expect(page.getByRole("heading", { name: /date this event/i })).toBeVisible();
  });

  test("keyboard navigation works", async ({ page }) => {
    await page.goto("/classic");

    // Wait for game to load
    await expect(page.getByText("Primary Clue")).toBeVisible({ timeout: 10000 });

    // Tab through inputs
    const startYearInput = page.getByRole("textbox", { name: "Start year" });
    await startYearInput.focus();

    // Clear and type a year
    await startYearInput.clear();
    await page.keyboard.type("1950");

    // Tab to next element
    await page.keyboard.press("Tab");

    // Should have moved focus (to era toggle or end year)
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();

    // Continue tabbing should work
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
  });
});

test.describe("Error Handling @happy-path", () => {
  test("page handles navigation without errors", async ({ page }) => {
    // Track console errors
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/classic");

    // Wait for game to load
    await expect(page.getByText("Primary Clue")).toBeVisible({ timeout: 10000 });

    // Wait for any async operations
    await page.waitForLoadState("networkidle");

    // Should have no page errors
    expect(errors).toHaveLength(0);
  });
});
