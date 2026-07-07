export type ModeKey = "classic" | "order" | "duel";

export const MODE_COOKIE = "chrondle_mode";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const MODE_KEYS: readonly ModeKey[] = ["classic", "order", "duel"];

/**
 * Parse a raw cookie value into a ModeKey, rejecting anything else.
 */
export function parseModeKey(value: string | undefined | null): ModeKey | null {
  return MODE_KEYS.includes(value as ModeKey) ? (value as ModeKey) : null;
}

/**
 * Where should `/` send this visitor?
 *
 * Returning visitors (valid mode-preference cookie) go straight to their
 * preferred mode — zero extra taps. First-timers (no/invalid cookie) and
 * anyone who explicitly asked for the gallery (`/?all`) stay on the gallery.
 *
 * Mode routes are definitionally `/<modeKey>` (see MODES in src/lib/modes.ts;
 * a consistency test guards the invariant). Kept dependency-free so it is
 * usable from the server component without pulling icon modules.
 *
 * @returns Route to redirect to, or null to render the gallery.
 */
export function resolveHomeRedirect(
  cookieValue: string | undefined,
  showGallery: boolean,
): string | null {
  if (showGallery) {
    return null;
  }

  const mode = parseModeKey(cookieValue);
  return mode ? `/${mode}` : null;
}

export function setModePreferenceCookie(mode: ModeKey) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${MODE_COOKIE}=${mode}; max-age=${ONE_YEAR_SECONDS}; path=/; SameSite=Lax`;
}
