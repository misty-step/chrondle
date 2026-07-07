/**
 * E2E — Daily habit loop (chrondle-ux-habit-loop)
 *
 * Behavioral proof for the loop's three legs:
 * 1. Entry: a logged-out first-timer can state what the game is and start
 *    today's puzzle in one tap; a returning visitor (mode cookie) reaches
 *    their preferred mode with zero extra taps.
 * 2. Exit: completion surfaces an explicit return hook (streak stake +
 *    reminder opt-in) and per-mode today-state in KEEP PLAYING.
 * 3. Streak: a clock-shifted next-day return increments the anonymous streak.
 *
 * The winning range for a deterministic completion comes from the same
 * Convex deployment the app under test uses (test-side knowledge only —
 * nothing here adds an answer surface to the product).
 */
import { test, expect, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// The dev server reads .env.local; the test process needs the same
// NEXT_PUBLIC_CONVEX_URL to look up the day's answer. (.env.test.local is
// already loaded by playwright.config.ts and wins when both define it.)
loadEnv({ path: ".env.local" });

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface PuzzleAnswer {
  targetYear: number;
}

async function fetchPuzzleAnswer(date: string): Promise<PuzzleAnswer> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set (needed to resolve the day's answer)");
  }
  const client = new ConvexHttpClient(convexUrl);

  let puzzle = await client.query(api.puzzles.getPuzzleByDate, { date });
  if (!puzzle) {
    // Same on-demand generation path the app itself uses (useTodaysPuzzle).
    await client.mutation(api.puzzles.ensurePuzzleForDate, { date });
    for (let attempt = 0; attempt < 10 && !puzzle; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      puzzle = await client.query(api.puzzles.getPuzzleByDate, { date });
    }
  }
  if (!puzzle) {
    throw new Error(`No puzzle available for ${date}`);
  }
  return { targetYear: puzzle.targetYear };
}

/**
 * Win the visible Classic puzzle with an exact-year range.
 * A single-year range containing the target always scores > 0 (containment
 * is binary), so this is a deterministic win.
 */
async function winClassicPuzzle(page: Page, targetYear: number) {
  await expect(page.getByText("Primary Clue")).toBeVisible({ timeout: 20000 });

  const startInput = page.getByRole("textbox", { name: "Start year" });
  const endInput = page.getByRole("textbox", { name: "End year" });
  const startEra = page.getByRole("radiogroup", { name: /select era/i }).first();
  const endEra = page.getByRole("radiogroup", { name: /select era/i }).last();

  const era = targetYear < 0 ? /BC/i : /AD/i;
  const absYear = String(Math.abs(targetYear));

  await startInput.clear();
  await startInput.fill(absYear);
  await startEra.getByRole("radio", { name: era }).click();
  await startInput.blur();

  await endInput.clear();
  await endInput.fill(absYear);
  await endEra.getByRole("radio", { name: era }).click();
  await endInput.blur();

  const submitButton = page.getByRole("button", { name: /lock in|submit range/i });
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  // Completion screen (the stamp overlay auto-dismisses)
  await expect(page.getByText("Game Summary")).toBeVisible({ timeout: 20000 });
}

test.describe("Entry @habit-loop", () => {
  test("logged-out first-timer can state what the game is and start in one tap", async ({
    page,
  }) => {
    await page.goto("/");

    // Can state what the game is: pitch + how-to strip in the first viewport
    await expect(page.getByText(/guess the year of real historical events/i)).toBeVisible();
    const howTo = page.getByRole("list", { name: /how to play/i });
    await expect(howTo).toBeVisible();
    await expect(howTo).toContainText(/keep your streak/i);

    // One tap to today's puzzle
    await page.getByRole("button", { name: /classic/i }).click();
    await page.waitForURL(/\/classic/);
    await expect(page.getByText("Primary Clue")).toBeVisible({ timeout: 20000 });
  });

  test("returning visitor reaches their preferred mode with zero extra taps", async ({
    page,
    context,
  }) => {
    await context.addCookies([{ name: "chrondle_mode", value: "order", url: BASE_URL }]);

    await page.goto("/");
    await page.waitForURL(/\/order/);
    expect(new URL(page.url()).pathname).toBe("/order");
  });

  test("the gallery stays reachable via /?all despite a mode preference", async ({
    page,
    context,
  }) => {
    await context.addCookies([{ name: "chrondle_mode", value: "classic", url: BASE_URL }]);

    // Navigate the exact value-bearing form the header wordmark emits (`/?all=1`).
    // Bare `/?all` is dropped by Vercel edge normalization in production; the
    // value-bearing param is what actually keeps the gallery reachable there.
    await page.goto("/?all=1");
    await expect(page.getByRole("heading", { level: 1, name: "Chrondle" })).toBeVisible();
    await expect(page.getByRole("button", { name: /order/i })).toBeVisible();
  });
});

test.describe("Completion return hook @habit-loop", () => {
  test("completing Classic surfaces the return hook, reminder opt-in, and today-state ladder", async ({
    page,
  }) => {
    const { targetYear } = await fetchPuzzleAnswer(localDateString(new Date()));

    await page.goto("/classic");
    await winClassicPuzzle(page, targetYear);

    // Explicit return hook: streak stake + countdown
    const hook = page.getByLabel("Come back tomorrow");
    await expect(hook).toBeVisible();
    await expect(hook).toContainText(/win tomorrow's puzzle to make it 2|1-day streak/i);
    await expect(hook).toContainText(/new puzzle in/i);

    // Taking the hook is a real, observable action (calendar download);
    // the tap also emits the reminder_optin analytics event.
    const downloadPromise = page.waitForEvent("download");
    await hook.getByRole("button", { name: /get a daily reminder/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("chrondle-daily-reminder.ics");

    // KEEP PLAYING reads as today's checklist for the other modes
    const keepPlaying = page.getByRole("region", { name: /play another mode/i });
    await expect(keepPlaying).toContainText(/keep playing — today/i);
    await expect(keepPlaying.getByRole("link", { name: /order/i })).toContainText(
      /not played today/i,
    );
    await expect(keepPlaying.getByRole("link", { name: /duel/i })).toContainText(/endless/i);
  });
});

test.describe("Clock-shifted anonymous streak @habit-loop", () => {
  test("the anonymous streak increments across a simulated next-day return", async ({ page }) => {
    // Day 1 = yesterday (inside the server's allowed window), Day 2 = today.
    // Shifting backwards-then-forward keeps both puzzles resolvable without
    // depending on tomorrow's puzzle existing.
    const now = new Date();
    const yesterdayNoon = new Date(now);
    yesterdayNoon.setDate(yesterdayNoon.getDate() - 1);
    yesterdayNoon.setHours(12, 0, 0, 0);
    const todayNoon = new Date(now);
    todayNoon.setHours(12, 0, 0, 0);

    const day1 = await fetchPuzzleAnswer(localDateString(yesterdayNoon));
    const day2 = await fetchPuzzleAnswer(localDateString(todayNoon));

    // Day 1: play and win with the browser clock set to yesterday noon
    await page.clock.install({ time: yesterdayNoon });
    await page.goto("/classic");
    await winClassicPuzzle(page, day1.targetYear);
    await expect(page.getByLabel(/current streak: 1 day/i)).toBeVisible();

    // Day 2: next-day return — jump the clock to today and revisit
    await page.clock.setSystemTime(todayNoon);
    await page.goto("/classic");
    await winClassicPuzzle(page, day2.targetYear);
    await expect(page.getByLabel(/current streak: 2 day/i)).toBeVisible();

    // The return hook carries the incremented stake forward
    await expect(page.getByLabel("Come back tomorrow")).toContainText(
      /win tomorrow's puzzle to make it 3/i,
    );
  });
});
