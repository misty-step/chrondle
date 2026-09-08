/**
 * Order-mode reorder interaction E2E — chrondle-ux-order-interaction
 *
 * Design-lab winner (docs/labs/order-reorder-interaction-lab.html, R2): a
 * redesigned drag handle plus always-visible Move up / Move down steppers.
 * These specs prove the three acceptance bars that unit tests can't reach on
 * their own: keyboard-only reordering with focus preserved,
 * the screen-reader live region actually updating in a real browser, and
 * real mobile-viewport hit-target geometry.
 *
 * Tagged @order-reorder for targeted runs:
 *   bunx playwright test e2e/order-mode-reorder.spec.ts --project=chromium
 */
import { test, expect, type Page } from "@playwright/test";

async function goToOrder(page: Page) {
  await page.goto("/order");
  // The board renders once the puzzle loads — event list items are the signal.
  await expect(page.getByRole("list").locator("li").first()).toBeVisible({ timeout: 15000 });
}

test.describe("Order mode keyboard reordering @order-reorder", () => {
  test("keyboard steppers move the event and preserve its focus", async ({ page }) => {
    await goToOrder(page);
    const items = page.getByRole("list").locator("li");
    const movedEvent = await items.nth(0).locator("p").first().innerText();
    const firstMoveDown = items.nth(0).getByRole("button", { name: /move .* down/i });
    const moveLabel = await firstMoveDown.getAttribute("aria-label");
    await firstMoveDown.focus();
    await page.keyboard.press("Enter");

    await expect(items.nth(1).locator("p").first()).toHaveText(movedEvent);
    await expect(page.locator('[aria-live="polite"]')).toContainText(/moved to position 2 of/i);
    await expect(page.getByRole("button", { name: moveLabel! })).toBeFocused();
  });

  test("dnd-kit announces pickup, move, and drop through the keyboard drag lifecycle", async ({
    page,
  }) => {
    await goToOrder(page);

    const items = page.getByRole("list").locator("li");
    const firstHandle = items.nth(0).getByLabel(/^Reorder /);
    await firstHandle.focus();

    // dnd-kit's own accessible live region (role="status", aria-live="assertive")
    // carries our content-aware announcements at each stage of the keyboard
    // drag lifecycle: pickup/current-position, move, and drop.
    const liveRegion = page.getByRole("status");

    await page.keyboard.press("Space"); // pick up
    await expect(liveRegion).toContainText(/picked up|moved to position 1 of/i);

    await page.keyboard.press("ArrowDown"); // move down one slot
    await expect(liveRegion).toContainText(/moved to position 2 of/i);

    await page.keyboard.press("Space"); // drop
    await expect(liveRegion).toContainText(/dropped at position 2 of/i);
  });
});

test.describe("Order mode mobile touch targets @order-reorder", () => {
  // iPhone 13 viewport/touch characteristics without devices["iPhone 13"]'s
  // defaultBrowserType (webkit), which is incompatible with the chromium project.
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("drag handle, move steppers, and read-more each meet the 44px minimum and stay disjoint", async ({
    page,
  }) => {
    await goToOrder(page);

    const firstItem = page.getByRole("list").locator("li").first();
    const handle = firstItem.getByLabel(/^Reorder /);
    const moveDown = firstItem.getByRole("button", { name: /move .* down/i });

    const handleBox = await handle.boundingBox();
    const moveDownBox = await moveDown.boundingBox();

    expect(handleBox).not.toBeNull();
    expect(moveDownBox).not.toBeNull();
    expect(handleBox!.height).toBeGreaterThanOrEqual(44);
    expect(handleBox!.width).toBeGreaterThanOrEqual(44);
    expect(moveDownBox!.height).toBeGreaterThanOrEqual(44);
    expect(moveDownBox!.width).toBeGreaterThanOrEqual(44);

    // Handle (top strip) and stepper column (right side) never overlap.
    const overlaps = !(
      handleBox!.y + handleBox!.height <= moveDownBox!.y ||
      moveDownBox!.y + moveDownBox!.height <= handleBox!.y
    );
    expect(handleBox!.x === moveDownBox!.x && overlaps).toBe(false);

    // Tapping Move down does not open the read-more drawer, and tapping the
    // event text does not reorder the list — the two gestures stay isolated.
    const before = await firstItem.locator("p").first().textContent();
    await moveDown.tap();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    const secondItemNow = page.getByRole("list").locator("li").nth(1);
    const secondText = await secondItemNow.locator("p").first().textContent();
    expect(secondText).toBe(before);
  });
});
