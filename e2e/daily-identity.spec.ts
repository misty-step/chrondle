/**
 * Daily Identity E2E — one "today" everywhere
 *
 * Chrondle's canonical "today" is the player's LOCAL calendar day
 * (src/lib/time/dailyDate.ts). These tests freeze the browser clock inside
 * the historical bug window — AFTER 00:00 UTC but BEFORE local midnight in a
 * negative-offset timezone (America/Los_Angeles) — where the homepage used to
 * advertise tomorrow's (UTC) puzzle number while the game page played
 * today's (local) puzzle.
 *
 * Invariant under test: the homepage mode-card puzzle number equals the
 * game-page header number for the same mode, at any wall-clock time.
 *
 * Tagged @daily-identity for targeted runs:
 *   bunx playwright test e2e/daily-identity.spec.ts --project=chromium
 */
import { test, expect, type Page } from "@playwright/test";

// Compute a frozen instant that is "YESTERDAY evening" in Los Angeles (the
// most recent LA date guaranteed to have a generated puzzle), at 20:00 LA
// time. Freezing to a date that differs from the machine's real date makes
// BOTH historical failure modes visible at any real run time:
// - a client-side UTC-day derivation would compute frozen-UTC = D+1 ≠ D;
// - a server-clock query (like the quarantined getDailyPuzzle) would resolve
//   the server's REAL date ≠ D (page.clock cannot freeze the server, so
//   freezing to "real today" would let that regression pass undetected).
function frozenEveningInLA(): { instant: Date; laDate: string } {
  const laYesterday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() - 24 * 60 * 60 * 1000)); // YYYY-MM-DD

  // 20:00 PDT (-07:00). During PST this instant is 19:00 LA time — either
  // way the frozen browser-local date is laYesterday while the frozen
  // browser-UTC date is laYesterday+1 (the divergence window).
  const instant = new Date(`${laYesterday}T20:00:00-07:00`);
  return { instant, laDate: laYesterday };
}

async function readGalleryPuzzleNumber(page: Page, mode: "Classic" | "Order"): Promise<number> {
  const card = page.getByRole("button", { name: new RegExp(mode, "i") });
  await expect(card).toBeVisible();
  // Mode-card label renders "Puzzle #N" once the daily puzzle resolves.
  await expect(card.getByText(/Puzzle #\d+/)).toBeVisible({ timeout: 20000 });
  const label = await card.getByText(/Puzzle #\d+/).textContent();
  const match = label?.match(/#(\d+)/);
  expect(match, `gallery ${mode} card should show a puzzle number`).toBeTruthy();
  return Number(match![1]);
}

async function readHeaderPuzzleNumber(page: Page): Promise<number> {
  // AppHeader renders the daily puzzle number as "#N" (optionally followed by
  // the puzzle date) inside the <header> landmark.
  const header = page.locator("header").first();
  await expect(header.getByText(/#\d+/)).toBeVisible({ timeout: 30000 });
  const text = await header.textContent();
  const match = text?.match(/#(\d+)/);
  expect(match, "game header should show a puzzle number").toBeTruthy();
  return Number(match![1]);
}

test.describe("Daily identity @daily-identity", () => {
  test.use({ timezoneId: "America/Los_Angeles" });

  test("homepage Classic number matches the classic game header after 00:00 UTC", async ({
    page,
  }) => {
    const { instant } = frozenEveningInLA();
    await page.clock.setFixedTime(instant);

    await page.goto("/");
    const galleryNumber = await readGalleryPuzzleNumber(page, "Classic");

    await page.getByRole("button", { name: /classic/i }).click();
    await page.waitForURL(/\/classic/);
    const headerNumber = await readHeaderPuzzleNumber(page);

    expect(headerNumber).toBe(galleryNumber);
  });

  test("homepage Order number matches the order game header after 00:00 UTC", async ({ page }) => {
    const { instant } = frozenEveningInLA();
    await page.clock.setFixedTime(instant);

    await page.goto("/");
    const galleryNumber = await readGalleryPuzzleNumber(page, "Order");

    await page.getByRole("button", { name: /order/i }).click();
    await page.waitForURL(/\/order/);
    const headerNumber = await readHeaderPuzzleNumber(page);

    expect(headerNumber).toBe(galleryNumber);
  });
});
