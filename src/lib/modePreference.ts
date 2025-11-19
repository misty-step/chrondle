"use client";

export type ModeKey = "classic" | "order";

export const MODE_COOKIE = "chrondle_mode";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function setModePreferenceCookie(mode: ModeKey) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${MODE_COOKIE}=${mode}; max-age=${ONE_YEAR_SECONDS}; path=/; SameSite=Lax`;
}
