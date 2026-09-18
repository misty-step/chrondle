import { test, expect, type Page } from "@playwright/test";

async function goToClassicGame(page: Page) {
  await page.goto("/classic", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("textbox", { name: "Start year" })).toBeEnabled({ timeout: 15000 });
}

test.describe("Classic direct range entry @happy-path", () => {
  test("shows live width and points without changing the other endpoint", async ({ page }) => {
    await goToClassicGame(page);
    const start = page.getByRole("textbox", { name: "Start year" });
    const end = page.getByRole("textbox", { name: "End year" });
    await start.fill("1900");
    await expect(end).toHaveValue("");
    await end.fill("1949");
    await expect(page.getByText("50 years wide")).toBeVisible();
    await expect(page.getByText("96 pts if correct")).toBeVisible();
    await end.fill("1949x");
    await expect(page.getByRole("button", { name: /lock in range/i })).toBeDisabled();
    await expect(start).toHaveValue("1900");
  });

  test("keeps focus and selection together when changing eras with a keyboard", async ({
    page,
  }) => {
    await goToClassicGame(page);
    const group = page.getByRole("radiogroup", { name: "Start year era" });
    await group.getByRole("radio", { name: /^AD/ }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(group.getByRole("radio", { name: /^BC/ })).toBeFocused();
    await expect(group.getByRole("radio", { name: /^BC/ })).toBeChecked();
    await expect(
      page.getByRole("radiogroup", { name: "End year era" }).getByRole("radio", { name: /^AD/ }),
    ).toBeChecked();
  });

  test("moves focus to results after deliberately locking in a guess", async ({ page }) => {
    await goToClassicGame(page);
    await page.getByRole("textbox", { name: "Start year" }).fill("1900");
    await page.getByRole("textbox", { name: "End year" }).fill("1949");
    await page.getByRole("textbox", { name: "End year" }).press("Enter");
    const submit = page.getByRole("button", { name: /lock in range/i });
    await expect(submit).toBeFocused();
    await submit.click();
    await expect(page.getByTestId("results-focus-anchor")).toBeFocused({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /dismiss stamp/i })).toHaveCount(0);
  });
});
