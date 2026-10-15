import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseChangelog } from "../src/lib/releases/changelog";

const [latest] = parseChangelog(readFileSync("CHANGELOG.md", "utf8"));

for (const colorScheme of ["light", "dark"] as const) {
  test(`changelog navigation and published detail in ${colorScheme}`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?all=1");
    const notesLink = page.getByRole("link", { name: `Changelog · v${latest.version}` });
    await expect(notesLink).toBeVisible();
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await notesLink.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      await testInfo.attach(`homepage-footer-${colorScheme}-${width}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await notesLink.click();
    await expect(page).toHaveURL(/\/changelog$/);
    await expect(page.getByRole("heading", { name: "Changelog", exact: true })).toBeVisible();
    await expect(page.getByRole("article", { name: `Release ${latest.version}` })).toBeVisible();
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.fonts.ready);
      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach(`changelog-${colorScheme}-${width}`, {
        body: screenshot,
        contentType: "image/png",
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("link", { name: `v${latest.version}`, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: `v${latest.version}`, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "View on GitHub" })).toHaveAttribute(
      "href",
      `https://github.com/misty-step/chrondle/releases/tag/v${latest.version}`,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("legacy release index redirects and unknown notes remain a 404", async ({ page }) => {
  await page.goto("/releases");
  await expect(page).toHaveURL(/\/changelog$/);
  const response = await page.goto("/releases/9999.0.0");
  expect(response?.status()).toBe(404);
});
