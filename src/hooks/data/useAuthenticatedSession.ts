"use client";

import { useState, useCallback } from "react";
import { GAME_CONFIG } from "@/lib/constants";
import type { RangeGuess } from "@/types/range";
import type { UseLocalSessionReturn } from "./sessionTypes";

interface AuthenticatedSessionState {
  puzzleId: string | null;
  guesses: number[];
  ranges: RangeGuess[];
}

/**
 * Session persistence for authenticated users.
 *
 * The server is the system of record; this hook only holds the in-flight
 * guesses/ranges for the current puzzle in React state for the duration of
 * the session.
 *
 * @param puzzleId - The puzzle's ID (null if puzzle not loaded)
 */
export function useAuthenticatedSession(puzzleId: string | null): UseLocalSessionReturn {
  const [session, setSession] = useState<AuthenticatedSessionState>(() => ({
    puzzleId,
    guesses: [],
    ranges: [],
  }));

  // Reset (without an effect) when the puzzle changes mid-render.
  const currentSession =
    session.puzzleId === puzzleId ? session : { puzzleId, guesses: [], ranges: [] };

  const addGuess = useCallback(
    (guess: number) => {
      setSession((prevSession) => {
        const current =
          prevSession.puzzleId === puzzleId ? prevSession : { puzzleId, guesses: [], ranges: [] };

        if (current.guesses.length >= GAME_CONFIG.MAX_GUESSES) return current;
        if (current.guesses.includes(guess)) return current;

        return { ...current, guesses: [...current.guesses, guess] };
      });
    },
    [puzzleId],
  );

  const clearGuesses = useCallback(() => {
    setSession((prevSession) => ({
      puzzleId,
      guesses: [],
      ranges: prevSession.puzzleId === puzzleId ? prevSession.ranges : [],
    }));
  }, [puzzleId]);

  const addRange = useCallback(
    (range: RangeGuess) => {
      setSession((prevSession) => {
        const current =
          prevSession.puzzleId === puzzleId ? prevSession : { puzzleId, guesses: [], ranges: [] };

        if (current.ranges.length >= GAME_CONFIG.MAX_GUESSES) return current;

        return { ...current, ranges: [...current.ranges, range] };
      });
    },
    [puzzleId],
  );

  const replaceLastRange = useCallback(
    (range: RangeGuess) => {
      setSession((prevSession) => {
        const current =
          prevSession.puzzleId === puzzleId ? prevSession : { puzzleId, guesses: [], ranges: [] };

        if (current.ranges.length === 0) return current;

        const next = [...current.ranges];
        next[next.length - 1] = range;
        return { ...current, ranges: next };
      });
    },
    [puzzleId],
  );

  const removeLastRange = useCallback(() => {
    setSession((prevSession) => {
      const current =
        prevSession.puzzleId === puzzleId ? prevSession : { puzzleId, guesses: [], ranges: [] };

      return {
        ...current,
        ranges: current.ranges.length ? current.ranges.slice(0, -1) : current.ranges,
      };
    });
  }, [puzzleId]);

  const clearRanges = useCallback(() => {
    setSession((prevSession) => ({
      puzzleId,
      guesses: prevSession.puzzleId === puzzleId ? prevSession.guesses : [],
      ranges: [],
    }));
  }, [puzzleId]);

  // Authenticated sessions are completed server-side; nothing to persist
  // locally here.
  const markComplete = useCallback((_hasWon: boolean) => {}, []);

  return {
    sessionGuesses: currentSession.guesses,
    sessionRanges: currentSession.ranges,
    addGuess,
    addRange,
    replaceLastRange,
    removeLastRange,
    clearGuesses,
    clearRanges,
    markComplete,
  };
}
