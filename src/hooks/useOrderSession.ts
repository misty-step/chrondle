"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "convex/_generated/dataModel";
import type { GolfScore, OrderAttempt } from "@/types/orderGameState";
import { logger } from "@/lib/logger";

const ORDER_SESSION_PREFIX = "chrondle_order_session_v2_";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const WRITE_DEBOUNCE_MS = 300;

// =============================================================================
// Session State Types
// =============================================================================

/**
 * Client-side session state for Order game (golf mode).
 * Stored in localStorage for anonymous users.
 */
export interface OrderSessionState {
  ordering: string[];
  attempts: OrderAttempt[];
  completedAt: number | null;
  score: GolfScore | null;
}

interface StoredOrderSession extends OrderSessionState {
  updatedAt: number;
}

interface UseOrderSessionReturn {
  state: OrderSessionState;
  setOrdering: (ordering: string[]) => void;
  addAttempt: (attempt: OrderAttempt) => void;
  markCompleted: (score: GolfScore) => void;
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
    (score: GolfScore) => {
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

// =============================================================================
// Storage Helpers
// =============================================================================

function getStorageKey(puzzleId: Id<"orderPuzzles">): string {
  return `${ORDER_SESSION_PREFIX}${puzzleId}`;
}

function readSession(
  puzzleId: Id<"orderPuzzles">,
  baselineOrder: string[],
): OrderSessionState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(getStorageKey(puzzleId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredOrderSession> | null;
    if (!parsed) {
      return null;
    }

    return {
      ordering: normalizeOrdering(parsed.ordering ?? [], baselineOrder),
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      completedAt: typeof parsed.completedAt === "number" ? parsed.completedAt : null,
      score: parsed.score ?? null,
    };
  } catch (error) {
    logger.warn("[useOrderSession] Failed to parse stored state", error);
    return null;
  }
}

function persistSession(puzzleId: Id<"orderPuzzles">, state: OrderSessionState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const payload: StoredOrderSession = {
      ...state,
      updatedAt: Date.now(),
    };
    localStorage.setItem(getStorageKey(puzzleId), JSON.stringify(payload));
  } catch (error) {
    logger.warn("[useOrderSession] Failed to persist session", error);
  }
}

function pruneStaleSessions() {
  if (typeof window === "undefined") {
    return;
  }

  const now = Date.now();
  const keysToCheck: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(ORDER_SESSION_PREFIX)) {
      keysToCheck.push(key);
    }
  }

  for (const key of keysToCheck) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw) as StoredOrderSession | null;
      if (!parsed?.updatedAt || now - parsed.updatedAt > SESSION_TTL_MS) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }
}

function normalizeOrdering(ordering: string[], baseline: string[]): string[] {
  if (!baseline.length) {
    return ordering;
  }
  const baselineSet = new Set(baseline);
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const id of ordering) {
    if (!seen.has(id) && baselineSet.has(id)) {
      normalized.push(id);
      seen.add(id);
    }
  }

  for (const id of baseline) {
    if (!seen.has(id)) {
      normalized.push(id);
      seen.add(id);
    }
  }

  return normalized;
}
