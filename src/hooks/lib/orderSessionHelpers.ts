/**
 * Pure helper functions for useOrderSession
 * Extracted for testability - no side effects, no dependencies
 */

import type { Id } from "convex/_generated/dataModel";
import type { AttemptScore, OrderAttempt } from "@/types/orderGameState";
import { logger } from "@/lib/logger";

export const ORDER_SESSION_PREFIX = "chrondle_order_session_v2_";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/**
 * Client-side session state for Order game.
 * Stored in localStorage for anonymous users.
 */
export interface OrderSessionState {
  ordering: string[];
  attempts: OrderAttempt[];
  completedAt: number | null;
  score: AttemptScore | null;
}

export interface StoredOrderSession extends OrderSessionState {
  updatedAt: number;
}

/**
 * Generate localStorage key for a puzzle
 */
export function getStorageKey(puzzleId: Id<"orderPuzzles">): string {
  return `${ORDER_SESSION_PREFIX}${puzzleId}`;
}

/**
 * Normalize ordering to ensure:
 * 1. No duplicates
 * 2. Only items from baseline are included
 * 3. Missing baseline items are appended at the end
 */
export function normalizeOrdering(ordering: string[], baseline: string[]): string[] {
  if (!baseline.length) {
    return ordering;
  }
  const baselineSet = new Set(baseline);
  const seen = new Set<string>();
  const normalized: string[] = [];

  // First pass: include valid items from ordering (preserving order, no dupes)
  for (const id of ordering) {
    if (!seen.has(id) && baselineSet.has(id)) {
      normalized.push(id);
      seen.add(id);
    }
  }

  // Second pass: append any missing baseline items
  for (const id of baseline) {
    if (!seen.has(id)) {
      normalized.push(id);
      seen.add(id);
    }
  }

  return normalized;
}

/**
 * Read session from localStorage
 * Returns null if:
 * - Window is undefined (SSR)
 * - No stored session
 * - Parse error
 */
export function readSession(
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
    logger.warn("[orderSessionHelpers] Failed to parse stored state", error);
    return null;
  }
}

/**
 * Persist session to localStorage
 * No-op if window is undefined (SSR)
 */
export function persistSession(puzzleId: Id<"orderPuzzles">, state: OrderSessionState): void {
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
    logger.warn("[orderSessionHelpers] Failed to persist session", error);
  }
}

/**
 * Remove stale sessions older than SESSION_TTL_MS
 * No-op if window is undefined (SSR)
 */
export function pruneStaleSessions(): void {
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
      // Remove corrupt entries
      localStorage.removeItem(key);
    }
  }
}
