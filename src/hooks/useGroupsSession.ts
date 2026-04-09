"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Id } from "convex/_generated/dataModel";

import {
  getEmptyGroupsSessionState,
  persistSession,
  pruneStaleSessions,
  readSession,
  type GroupsSessionState,
} from "@/hooks/lib/groupsSessionHelpers";
import type { GroupsProgress } from "@/lib/groups/engine";

const WRITE_DEBOUNCE_MS = 300;

interface SessionSnapshot {
  key: string | null;
  progress: GroupsSessionState;
}

interface UseGroupsSessionReturn {
  state: GroupsSessionState;
  replaceProgress: (progress: GroupsProgress) => void;
  resetSession: () => void;
}

export function useGroupsSession(
  puzzleId: Id<"groupsPuzzles"> | null,
  isAuthenticated: boolean,
): UseGroupsSessionReturn {
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shouldPersist = !isAuthenticated && Boolean(puzzleId) && typeof window !== "undefined";
  const activeKey = shouldPersist && puzzleId ? String(puzzleId) : null;

  const readActiveState = useCallback((): GroupsSessionState => {
    if (!shouldPersist || !puzzleId) {
      return getEmptyGroupsSessionState();
    }

    return readSession(puzzleId) ?? getEmptyGroupsSessionState();
  }, [puzzleId, shouldPersist]);

  const [snapshot, setSnapshot] = useState<SessionSnapshot>(() => ({
    key: activeKey,
    progress: readActiveState(),
  }));

  const schedulePersist = useCallback(
    (nextState: GroupsSessionState) => {
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
    if (!writeTimer.current) {
      return;
    }

    clearTimeout(writeTimer.current);
    writeTimer.current = null;
  }, [activeKey]);

  useEffect(() => {
    if (!shouldPersist || !puzzleId) {
      return;
    }

    pruneStaleSessions();
  }, [puzzleId, shouldPersist]);

  const state = useMemo(() => {
    if (snapshot.key === activeKey) {
      return snapshot.progress;
    }

    return readActiveState();
  }, [activeKey, readActiveState, snapshot]);

  const updateState = useCallback(
    (nextState: GroupsSessionState) => {
      setSnapshot({
        key: activeKey,
        progress: nextState,
      });
      schedulePersist(nextState);
    },
    [activeKey, schedulePersist],
  );

  const replaceProgress = useCallback(
    (progress: GroupsProgress) => {
      updateState(progress);
    },
    [updateState],
  );

  const resetSession = useCallback(() => {
    const reset = getEmptyGroupsSessionState();
    updateState(reset);
  }, [updateState]);

  return useMemo(
    () => ({
      state,
      replaceProgress,
      resetSession,
    }),
    [replaceProgress, resetSession, state],
  );
}
