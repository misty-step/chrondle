"use client";

import { useMemo } from "react";
import { useAnonymousSession } from "./useAnonymousSession";
import { useAuthenticatedSession } from "./useAuthenticatedSession";
import type { UseLocalSessionReturn } from "./sessionTypes";

export type { UseLocalSessionReturn } from "./sessionTypes";

/**
 * Hook to manage current game session guesses.
 *
 * For anonymous users: delegates to {@link useAnonymousSession}, which uses
 * localStorage as the single source of truth.
 * For authenticated users: delegates to {@link useAuthenticatedSession},
 * which uses React state (the server handles persistence).
 *
 * Both delegate hooks are always called — React's rules of hooks forbid
 * calling a hook conditionally — but each owns exactly one persistence
 * strategy, so neither branches on `isAuthenticated` internally. This hook's
 * only job is to select which result to expose.
 *
 * This solves the navigation bug where anonymous users lose their guesses.
 * By using useSyncExternalStore with localStorage, the anonymous state
 * persists across navigation and even syncs across tabs.
 *
 * @param puzzleId - The puzzle's ID (null if puzzle not loaded)
 * @param isAuthenticated - Whether the user is authenticated
 * @param targetYear - The winning year, used by the anonymous session to
 *   detect a winning guess
 * @returns Object containing session guesses and mutation functions
 *
 * @example
 * const { sessionGuesses, addGuess, clearGuesses } = useLocalSession(puzzleId, isAuthenticated);
 *
 * // Add a guess (won't add duplicates or exceed 6 guesses)
 * addGuess(1969);
 *
 * // Clear all session guesses
 * clearGuesses();
 *
 * // For anonymous users: state persists in localStorage
 * // For authenticated users: state is in React state
 */
export function useLocalSession(
  puzzleId: string | null,
  isAuthenticated: boolean = false,
  targetYear?: number,
): UseLocalSessionReturn {
  const anonymousSession = useAnonymousSession(puzzleId, targetYear);
  const authenticatedSession = useAuthenticatedSession(puzzleId);

  const selected = isAuthenticated ? authenticatedSession : anonymousSession;

  // Memoize so consumers keying off referential identity (e.g. effect deps)
  // don't see a new object every render.
  return useMemo<UseLocalSessionReturn>(
    () => selected,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      selected.sessionGuesses,
      selected.sessionRanges,
      selected.addGuess,
      selected.addRange,
      selected.replaceLastRange,
      selected.removeLastRange,
      selected.clearGuesses,
      selected.clearRanges,
      selected.markComplete,
    ],
  );
}
