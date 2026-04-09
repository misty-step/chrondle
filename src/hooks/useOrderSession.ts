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

interface StoredOrderSessionState {
  sessionKey: string;
  state: OrderSessionState;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useOrderSession(
  puzzleId: Id<"orderPuzzles"> | null,
  baselineOrder: string[],
  isAuthenticated: boolean,
): UseOrderSessionReturn {
  const baselineSignature = useMemo(() => baselineOrder.join("|"), [baselineOrder]);
  const sessionKey = puzzleId ? `${puzzleId}:${baselineSignature}:${isAuthenticated}` : "empty";
  const createBaseState = useCallback(
    (): OrderSessionState =>
      baselineOrder.length ? { ...DEFAULT_STATE, ordering: baselineOrder } : DEFAULT_STATE,
    [baselineOrder],
  );
  const [storedState, setStoredState] = useState<StoredOrderSessionState>(() => ({
    sessionKey,
    state: !puzzleId
      ? DEFAULT_STATE
      : isAuthenticated
        ? createBaseState()
        : (readSession(puzzleId, baselineOrder) ?? createBaseState()),
  }));

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

  const state =
    storedState.sessionKey === sessionKey
      ? storedState.state
      : !puzzleId
        ? DEFAULT_STATE
        : isAuthenticated
          ? createBaseState()
          : (readSession(puzzleId, baselineOrder) ?? createBaseState());

  const updateState = useCallback(
    (updater: (prev: OrderSessionState) => OrderSessionState) => {
      setStoredState((prevStoredState) => {
        const currentState =
          prevStoredState.sessionKey === sessionKey ? prevStoredState.state : state;
        const next = updater(currentState);
        schedulePersist(next);
        return {
          sessionKey,
          state: next,
        };
      });
    },
    [schedulePersist, sessionKey, state],
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
      setStoredState({
        sessionKey,
        state: resetState,
      });
      schedulePersist(resetState);
    },
    [schedulePersist, sessionKey],
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
