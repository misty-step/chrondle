/**
 * Best-streak persistence for Duel mode.
 *
 * Duel runs are ephemeral by design — the only thing worth keeping is the
 * player's best streak, stored locally so anonymous players get a personal
 * record without an account. Reads are hydration-safe: callers should read
 * inside an effect (after mount), never during SSR render.
 */

const BEST_STREAK_KEY = "chrondle_duel_best_streak";
const BEST_STREAK_EVENT = "chrondle:duel-best-streak";

/**
 * Subscribe to best-streak changes (same-tab writes and cross-tab storage
 * events). Shaped for useSyncExternalStore.
 */
export function subscribeBestStreak(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(BEST_STREAK_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(BEST_STREAK_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function readBestStreak(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const raw = window.localStorage.getItem(BEST_STREAK_KEY);
    const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function writeBestStreak(value: number): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (Number.isFinite(value) && value > 0) {
      window.localStorage.setItem(BEST_STREAK_KEY, String(Math.floor(value)));
      window.dispatchEvent(new Event(BEST_STREAK_EVENT));
    }
  } catch {
    // Storage unavailable (private mode, quota) — best streak is a nicety,
    // never worth breaking the run over.
  }
}
