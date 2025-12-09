import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("homepage loads and shows game", async ({ page }) => {
    // Track console errors (excluding known benign errors)
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Ignore favicon errors, hydration warnings, and Vercel Analytics (not available in CI)
        if (
          !text.includes("favicon") &&
          !text.includes("Hydration") &&
          !text.includes("_vercel") &&
          !text.includes("Failed to load resource: the server responded with a status of 404")
        ) {
          consoleErrors.push(text);
        }
      }
    });

    await page.goto("/");

    // Verify page title contains Chrondle
    await expect(page).toHaveTitle(/Chrondle/);

    // Verify main element is visible
    const main = page.getByRole("main");
    await expect(main).toBeVisible();

    // Wait for initial load to complete
    await page.waitForLoadState("networkidle");

    // No console errors should have occurred
    expect(consoleErrors).toHaveLength(0);
  });

  test("navigation elements are present", async ({ page }) => {
    await page.goto("/");

    // Game should be accessible
    const main = page.getByRole("main");
    await expect(main).toBeVisible();
  });
});
