import type { Id } from "convex/_generated/dataModel";

import { logger } from "@/lib/logger";
import { MAX_GROUPS_MISTAKES, type GroupsProgress } from "@/lib/groups/engine";

export const GROUPS_SESSION_PREFIX = "chrondle_groups_session_v1_";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export type GroupsSessionState = GroupsProgress;

interface StoredGroupsSession extends GroupsSessionState {
  updatedAt: number;
}

const EMPTY_PROGRESS: GroupsSessionState = {
  solvedGroupIds: [],
  mistakes: 0,
  remainingMistakes: MAX_GROUPS_MISTAKES,
  isComplete: false,
  hasWon: false,
  submissions: [],
  revealedGroups: [],
};

export function getStorageKey(puzzleId: Id<"groupsPuzzles">): string {
  return `${GROUPS_SESSION_PREFIX}${puzzleId}`;
}

function normalizeSessionState(parsed: Partial<StoredGroupsSession> | null): GroupsSessionState {
  const mistakes =
    typeof parsed?.mistakes === "number" && parsed.mistakes >= 0 ? parsed.mistakes : 0;
  const remainingMistakes =
    typeof parsed?.remainingMistakes === "number"
      ? Math.max(0, Math.min(MAX_GROUPS_MISTAKES, parsed.remainingMistakes))
      : Math.max(0, MAX_GROUPS_MISTAKES - mistakes);

  return {
    solvedGroupIds: Array.isArray(parsed?.solvedGroupIds) ? parsed!.solvedGroupIds : [],
    mistakes,
    remainingMistakes,
    isComplete: typeof parsed?.isComplete === "boolean" ? parsed.isComplete : false,
    hasWon: typeof parsed?.hasWon === "boolean" ? parsed.hasWon : false,
    submissions: Array.isArray(parsed?.submissions) ? parsed!.submissions : [],
    revealedGroups: Array.isArray(parsed?.revealedGroups) ? parsed!.revealedGroups : [],
  };
}

export function readSession(puzzleId: Id<"groupsPuzzles">): GroupsSessionState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(getStorageKey(puzzleId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredGroupsSession> | null;
    return normalizeSessionState(parsed);
  } catch (error) {
    logger.warn("[groupsSessionHelpers] Failed to parse stored state", error);
    return null;
  }
}

export function persistSession(puzzleId: Id<"groupsPuzzles">, state: GroupsSessionState): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const payload: StoredGroupsSession = {
      ...state,
      updatedAt: Date.now(),
    };
    localStorage.setItem(getStorageKey(puzzleId), JSON.stringify(payload));
  } catch (error) {
    logger.warn("[groupsSessionHelpers] Failed to persist session", error);
  }
}

export function pruneStaleSessions(): void {
  if (typeof window === "undefined") {
    return;
  }

  const now = Date.now();
  const keysToCheck: string[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(GROUPS_SESSION_PREFIX)) {
      keysToCheck.push(key);
    }
  }

  for (const key of keysToCheck) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw) as StoredGroupsSession | null;
      if (!parsed?.updatedAt || now - parsed.updatedAt > SESSION_TTL_MS) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }
}

export function getEmptyGroupsSessionState(): GroupsSessionState {
  return { ...EMPTY_PROGRESS };
}
