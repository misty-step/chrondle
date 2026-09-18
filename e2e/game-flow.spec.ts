import { test, expect } from "@playwright/test";

test.describe("Classic game flow @happy-path", () => {
  test("opens a playable Classic puzzle from the gallery", async ({ page }) => {
    await page.goto("/?all=1");
    await page.getByRole("button", { name: /play classic/i }).click();
    await page.waitForURL(/\/classic/);
    await expect(page.getByRole("textbox", { name: "Start year" })).toBeEditable({
      timeout: 15000,
    });
  });

  test("taking a hint preserves the draft and lowers its potential score", async ({ page }) => {
    await page.goto("/classic");
    const start = page.getByRole("textbox", { name: "Start year" });
    const end = page.getByRole("textbox", { name: "End year" });
    await expect(start).toBeEditable({ timeout: 15000 });
    await start.fill("1950");
    await end.fill("1950");
    const potentialScore = page
      .getByRole("region", { name: "Your range" })
      .getByText(/pts if correct/)
      .locator("strong");
    await expect(potentialScore).toHaveText("100");

    await page.getByRole("button", { name: /take hint/i }).click();

    await expect(potentialScore).toHaveText("85");
    await expect(start).toHaveValue("1950");
    await expect(end).toHaveValue("1950");
    await expect(page.getByRole("button", { name: /lock in range/i })).toBeEnabled();
  });
});
