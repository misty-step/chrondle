/**
 * Targeted E2E coverage for the Classic range-entry redesign
 * (chrondle-ux-range-entry): the drag-to-draw timeline bar as the primary
 * one-gesture control, live width/points feedback during manipulation, zero
 * layout shift while entering a guess, the one-shot mechanic taught before
 * the first lock-in, the exact-year fields retained as a fallback, and
 * focus landing on the results summary after submit.
 *
 * Tagged with @happy-path for CI filtering, matching game-flow.spec.ts.
 */
import { test, expect, type Page } from "@playwright/test";

async function goToClassicGame(page: Page) {
  await page.goto("/classic", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Primary Clue")).toBeVisible({ timeout: 10000 });
}

/** Drag the timeline track from one fractional position to another. */
async function dragTimeline(page: Page, fromFraction: number, toFraction: number) {
  const track = page.getByTestId("timeline-range-track");
  await track.scrollIntoViewIfNeeded();
  await expect(track).toBeVisible();
  const box = await track.boundingBox();
  if (!box) throw new Error("timeline-range-track has no bounding box");

  const y = box.y + box.height / 2;
  const fromX = box.x + box.width * fromFraction;
  const toX = box.x + box.width * toFraction;

  await page.mouse.move(fromX, y);
  await page.mouse.down();
  await page.mouse.move(toX, y, { steps: 8 });
  return { toX, y, up: () => page.mouse.up() };
}

test.describe("Classic range entry - one-gesture timeline @happy-path", () => {
  test.describe.configure({ mode: "serial" });

  test("teaches the one-shot mechanic before the first interaction", async ({ page }) => {
    await goToClassicGame(page);

    // Copy exists before the player has touched anything - the acceptance
    // bar is "taught before the first lock-in", not just implied by the CTA.
    await expect(page.getByText(/one guess.*drag/i)).toBeVisible();
    await expect(page.getByTestId("timeline-handle-start")).not.toBeVisible();
    await expect(page.getByTestId("timeline-handle-end")).not.toBeVisible();
  });

  test("drawing a range on the timeline shows live width/points feedback before release", async ({
    page,
  }) => {
    await goToClassicGame(page);

    const drag = await dragTimeline(page, 0.55, 0.59);

    // Still mid-drag - the pointer button hasn't been released yet - so
    // this proves the readout updates on every move, not on blur/release.
    await expect(page.getByText(/\d+\s+of\s+250\s+years/i)).toBeVisible();
    const exceedsOrWorth = page.getByText(/exceeds limit|worth\s+\d+\s+pts if right/i);
    await expect(exceedsOrWorth).toBeVisible();

    await drag.up();
  });

  test("keeps the exact-year fields visible as a fallback beside the timeline", async ({
    page,
  }) => {
    await goToClassicGame(page);

    await expect(page.getByTestId("timeline-range-track")).toBeVisible();
    await expect(page.getByText(/prefer exact years/i)).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Start year" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "End year" })).toBeVisible();
  });

  test("causes no measurable layout shift while dragging and typing", async ({ page }) => {
    await goToClassicGame(page);
    await expect(page.getByTestId("timeline-range-track")).toBeVisible();

    // Measure only the interaction window, not initial page load (fonts/
    // images loading in can shift layout independent of this component).
    await page.evaluate(() => {
      const win = window as typeof window & { __clsValue: number };
      win.__clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as unknown as { hadRecentInput: boolean; value: number };
          if (!shift.hadRecentInput) win.__clsValue += shift.value;
        }
      });
      observer.observe({ type: "layout-shift", buffered: false });
    });

    const drag = await dragTimeline(page, 0.55, 0.59);
    await drag.up();

    const startYearInput = page.getByRole("textbox", { name: "Start year" });
    await startYearInput.click();
    await startYearInput.fill("1500");
    await startYearInput.blur();

    const cls = await page.evaluate(
      () => (window as typeof window & { __clsValue: number }).__clsValue,
    );
    expect(cls).toBeLessThan(0.05);
  });

  test("moves focus to the results summary after locking in a guess", async ({ page }) => {
    await goToClassicGame(page);

    const drag = await dragTimeline(page, 0.55, 0.59);
    await drag.up();

    const submitButton = page.getByRole("button", { name: /lock in|submit range/i });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect(page.getByTestId("results-focus-anchor")).toBeFocused({ timeout: 10000 });
  });
});
