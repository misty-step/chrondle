"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "convex/_generated/dataModel";
import type { OrderHint, OrderScore } from "@/types/orderGameState";
import type { OrderSessionState } from "@/lib/deriveOrderGameState";
import { logger } from "@/lib/logger";
import { serializeHint } from "@/lib/order/hintMerging";

const ORDER_SESSION_PREFIX = "chrondle_order_session_";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const WRITE_DEBOUNCE_MS = 300;

interface StoredOrderSession extends OrderSessionState {
  updatedAt: number;
}

interface UseOrderSessionReturn {
  state: OrderSessionState;
  setOrdering: (ordering: string[]) => void;
  addHint: (hint: OrderHint) => void;
  resetSession: (ordering: string[]) => void;
  markCommitted: (score: OrderScore) => void;
}

const DEFAULT_STATE: OrderSessionState = {
  ordering: [],
  hints: [],
  committedAt: null,
  score: null,
};

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

  const addHint = useCallback(
    (hint: OrderHint) => {
      updateState((prev) => {
        const exists = prev.hints.some(
          (existing) => serializeHint(existing) === serializeHint(hint),
        );
        if (exists) {
          return prev;
        }
        return {
          ...prev,
          hints: prev.hints.concat(hint),
        };
      });
    },
    [updateState],
  );

  const resetSession = useCallback(
    (ordering: string[]) => {
      const resetState: OrderSessionState = {
        ordering,
        hints: [],
        committedAt: null,
        score: null,
      };
      setState(resetState);
      schedulePersist(resetState);
    },
    [schedulePersist],
  );

  const markCommitted = useCallback(
    (score: OrderScore) => {
      updateState((prev) => ({
        ...prev,
        committedAt: Date.now(),
        score,
      }));
    },
    [updateState],
  );

  return useMemo(
    () => ({
      state,
      setOrdering,
      addHint,
      resetSession,
      markCommitted,
    }),
    [state, setOrdering, addHint, resetSession, markCommitted],
  );
}

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
      hints: Array.isArray(parsed.hints) ? (parsed.hints as OrderHint[]) : [],
      committedAt: typeof parsed.committedAt === "number" ? parsed.committedAt : null,
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
