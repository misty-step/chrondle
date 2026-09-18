/**
 * Daily-reminder calendar file for the completion return hook.
 *
 * The habit loop's reminder opt-in ships as a recurring calendar event
 * (.ics): it works logged-out, needs no push infrastructure and no
 * permission prompt, and downgrades gracefully everywhere. If web push
 * lands later it replaces the download inside the same CTA.
 *
 * Integrity: the reminder must never carry puzzle content — no events,
 * no era, no year. Summary + link only.
 */

const APP_URL = "https://www.chrondle.app";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Build the .ics payload for a daily "Play today's Chrondle" reminder.
 *
 * Starts tomorrow (relative to `now`) at 09:00 *floating* local time —
 * deliberately no timezone/UTC suffix, so the reminder follows the player
 * across timezones the same way the daily puzzle does (local calendar day,
 * see src/lib/time/dailyDate.ts).
 */
export function buildDailyReminderIcs(now: Date = new Date()): string {
  const start = new Date(now);
  start.setDate(start.getDate() + 1);

  const dtStart = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}T090000`;
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}T${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Chrondle//Daily Reminder//EN",
    "BEGIN:VEVENT",
    `UID:chrondle-daily-reminder-${dtStart}@chrondle.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtStart}`,
    "DURATION:PT15M",
    "RRULE:FREQ=DAILY",
    "SUMMARY:Play today's Chrondle",
    `DESCRIPTION:A new history puzzle is up. Keep your streak: ${APP_URL}`,
    `URL:${APP_URL}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n") + "\r\n";
}

/**
 * Trigger a browser download of the daily reminder. No-op during SSR.
 */
export function downloadDailyReminder(now: Date = new Date()): void {
  if (typeof document === "undefined") {
    return;
  }

  const blob = new Blob([buildDailyReminderIcs(now)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "chrondle-daily-reminder.ics";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
