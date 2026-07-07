"use client";

/**
 * useTodayModeStatus — per-mode "finished today?" for the habit loop.
 *
 * Powers the KEEP PLAYING today-checklist (design-lab winner C3): each daily
 * mode reads as done/todo for the player's local "today", so the cross-sell
 * strip behaves like a daily checklist instead of ads. Duel has no daily
 * puzzle and is reported as "endless".
 *
 * Data sources are exactly the ones each game page trusts for restore
 * (server plays when signed-in, the anonymous local session otherwise);
 * the derivation itself is pure (src/lib/todayModeStatus.ts).
 */

import { useSyncExternalStore } from "react";

import { useTodaysPuzzle } from "@/hooks/useTodaysPuzzle";
import { useTodaysOrderPuzzle } from "@/hooks/useTodaysOrderPuzzle";
import { useAuthState } from "@/hooks/data/useAuthState";
import { useUserProgress } from "@/hooks/data/useUserProgress";
import { useOrderProgress } from "@/hooks/data/useOrderProgress";
import { readSession } from "@/hooks/lib/orderSessionHelpers";
import { readLocalGameState } from "@/lib/gameDataStore";
import { deriveDailyModeStatus, type ModeTodayStatus } from "@/lib/todayModeStatus";
import type { ModeKey } from "@/lib/modePreference";
import type { Id } from "convex/_generated/dataModel";

export type TodayModeStatuses = Record<ModeKey, ModeTodayStatus>;

const subscribeNoop = () => () => {};

export function useTodayModeStatus(): TodayModeStatuses {
  const { userId, isAuthenticated } = useAuthState();

  const { puzzle: classicPuzzle } = useTodaysPuzzle();
  const { puzzle: orderPuzzle } = useTodaysOrderPuzzle();

  const classicPuzzleId = classicPuzzle?.id ?? null;
  const orderPuzzleId = orderPuzzle?.id ?? null;

  const { progress: classicProgress, isLoading: classicProgressLoading } = useUserProgress(
    isAuthenticated ? userId : null,
    classicPuzzleId,
  );
  const { progress: orderProgress, isLoading: orderProgressLoading } = useOrderProgress(
    isAuthenticated ? userId : null,
    orderPuzzleId,
  );

  // Anonymous local sessions live in localStorage. Hydration safety comes
  // from useSyncExternalStore's server snapshot (false on the server, true
  // once the client subscribes), so the first client render matches SSR and
  // the checklist resolves immediately after hydration.
  const isHydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const canReadLocal = isHydrated && !isAuthenticated;

  const localClassicCompleted =
    canReadLocal &&
    classicPuzzleId !== null &&
    (readLocalGameState(classicPuzzleId)?.isComplete ?? false);
  const localOrderCompleted =
    canReadLocal &&
    orderPuzzleId !== null &&
    readSession(orderPuzzleId as Id<"orderPuzzles">, [])?.completedAt != null;

  const serverClassicCompleted = classicProgressLoading
    ? null
    : classicProgress !== null
      ? classicProgress.completedAt !== null
      : false;
  const serverOrderCompleted = orderProgressLoading
    ? null
    : orderProgress !== null
      ? orderProgress.completedAt !== null
      : false;

  return {
    classic: deriveDailyModeStatus({
      puzzleId: classicPuzzleId,
      isAuthenticated,
      serverCompleted: serverClassicCompleted,
      localCompleted: localClassicCompleted,
    }),
    order: deriveDailyModeStatus({
      puzzleId: orderPuzzleId,
      isAuthenticated,
      serverCompleted: serverOrderCompleted,
      localCompleted: localOrderCompleted,
    }),
    duel: "endless",
  };
}
