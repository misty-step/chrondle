import { describe, it, expect } from "vitest";
import { buildDailyReminderIcs } from "../reminder";

describe("buildDailyReminderIcs", () => {
  const now = new Date("2026-07-06T15:30:00");
  const ics = buildDailyReminderIcs(now);

  it("is a valid single-event VCALENDAR", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("UID:");
  });

  it("recurs daily, forever", () => {
    expect(ics).toContain("RRULE:FREQ=DAILY");
    expect(ics).not.toContain("UNTIL=");
    expect(ics).not.toContain("COUNT=");
  });

  it("starts tomorrow morning in floating local time (9am wherever the player is)", () => {
    // Tomorrow relative to the passed date, 09:00, no Z suffix (floating time)
    expect(ics).toContain("DTSTART:20260707T090000");
    expect(ics).not.toContain("DTSTART:20260707T090000Z");
  });

  it("names the game and links to it without leaking puzzle content", () => {
    expect(ics).toContain("SUMMARY:Play today's Chrondle");
    expect(ics).toContain("URL:https://www.chrondle.app");
    // Integrity: a reminder must never carry era/year information
    expect(ics).not.toMatch(/\b\d{1,4}\s?(BC|AD)\b/);
  });

  it("uses CRLF line endings as required by RFC 5545", () => {
    expect(ics).toContain("\r\n");
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("rolls the start date across month boundaries", () => {
    const eom = buildDailyReminderIcs(new Date("2026-07-31T22:00:00"));
    expect(eom).toContain("DTSTART:20260801T090000");
  });
});
