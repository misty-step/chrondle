"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "convex/_generated/dataModel";
import type { AttemptScore, OrderAttempt } from "@/types/orderGameState";
import {
  type OrderSessionState,
  persistSession,
  pruneStaleSessions,
  readSession,
} from "./lib/orderSessionHelpers";

const WRITE_DEBOUNCE_MS = 300;

// Re-export for backwards compatibility
export type { OrderSessionState };

interface UseOrderSessionReturn {
  state: OrderSessionState;
  setOrdering: (ordering: string[]) => void;
  addAttempt: (attempt: OrderAttempt) => void;
  markCompleted: (score: AttemptScore) => void;
  resetSession: (ordering: string[]) => void;
}

// =============================================================================
// Default State
// =============================================================================

const DEFAULT_STATE: OrderSessionState = {
  ordering: [],
  attempts: [],
  completedAt: null,
  score: null,
};

// =============================================================================
// Hook Implementation
// =============================================================================

export function useOrderSession(
  puzzleId: Id<"orderPuzzles"> | null,
  baselineOrder: string[],
  isAuthenticated: boolean,
): UseOrderSessionReturn {
  const baselineSignature = useMemo(() => baselineOrder.join("|"), [baselineOrder]);
  const [state, setState] = useState<OrderSessionState>(() =>
    baselineOrder.length ? { ...DEFAULT_STATE, ordering: baselineOrder } : DEFAULT_STATE,
  );

  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shouldPersist = !isAuthenticated && Boolean(puzzleId) && typeof window !== "undefined";

  const schedulePersist = useCallback(
    (nextState: OrderSessionState) => {
      if (!shouldPersist || !puzzleId) {
        return;
      }
      if (writeTimer.current) {
        clearTimeout(writeTimer.current);
      }
      writeTimer.current = setTimeout(() => {
        persistSession(puzzleId, nextState);
      }, WRITE_DEBOUNCE_MS);
    },
    [puzzleId, shouldPersist],
  );

  useEffect(() => {
    if (writeTimer.current) {
      return () => clearTimeout(writeTimer.current!);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (!shouldPersist || !puzzleId) {
      return;
    }
    pruneStaleSessions();
  }, [shouldPersist, puzzleId]);

  useEffect(() => {
    if (!puzzleId) {
      setState(DEFAULT_STATE);
      return;
    }

    if (isAuthenticated) {
      setState({ ...DEFAULT_STATE, ordering: baselineOrder });
      return;
    }

    const stored = readSession(puzzleId, baselineOrder);
    setState(stored ?? { ...DEFAULT_STATE, ordering: baselineOrder });
  }, [puzzleId, baselineSignature, baselineOrder, isAuthenticated]);

  const updateState = useCallback(
    (updater: (prev: OrderSessionState) => OrderSessionState) => {
      setState((prev) => {
        const next = updater(prev);
        schedulePersist(next);
        return next;
      });
    },
    [schedulePersist],
  );

  const setOrdering = useCallback(
    (ordering: string[]) => {
      updateState((prev) => ({
        ...prev,
        ordering,
      }));
    },
    [updateState],
  );

  const addAttempt = useCallback(
    (attempt: OrderAttempt) => {
      updateState((prev) => ({
        ...prev,
        attempts: [...prev.attempts, attempt],
      }));
    },
    [updateState],
  );

  const markCompleted = useCallback(
    (score: AttemptScore) => {
      updateState((prev) => ({
        ...prev,
        completedAt: Date.now(),
        score,
      }));
    },
    [updateState],
  );

  const resetSession = useCallback(
    (ordering: string[]) => {
      const resetState: OrderSessionState = {
        ordering,
        attempts: [],
        completedAt: null,
        score: null,
      };
      setState(resetState);
      schedulePersist(resetState);
    },
    [schedulePersist],
  );

  return useMemo(
    () => ({
      state,
      setOrdering,
      addAttempt,
      markCompleted,
      resetSession,
    }),
    [state, setOrdering, addAttempt, markCompleted, resetSession],
  );
}
