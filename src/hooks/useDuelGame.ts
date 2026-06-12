"use client";

import { useCallback, useEffect, useReducer, useState, useSyncExternalStore } from "react";
import { useQuery } from "convex/react";
import { anyPublicApi } from "@/lib/convexAnyApi";
import {
  DUEL_BATCH_SIZE,
  createInitialRunState,
  currentRoundOf,
  duelRunReducer,
  isAwaitingRounds,
  streakOf,
  type DuelRoundView,
  type DuelSlot,
} from "@/lib/duel/runReducer";
import { readBestStreak, subscribeBestStreak, writeBestStreak } from "@/lib/duel/bestStreak";

export type DuelStatus = "loading" | "choosing" | "revealed" | "over";

export interface UseDuelGameReturn {
  status: DuelStatus;
  /** Round in front of the player; when over, the pair that ended the run */
  round: DuelRoundView | null;
  streak: number;
  bestStreak: number;
  isNewBest: boolean;
  pick: DuelSlot | null;
  wasCorrect: boolean | null;
  endReason: "miss" | "exhausted" | null;
  choose: (slot: DuelSlot) => void;
  advance: () => void;
  restart: () => void;
}

function newRunSeed(): number {
  return Math.floor(Math.random() * 2147483646) + 1;
}

/**
 * Composition hook for a Duel run.
 *
 * All game rules live in the pure reducer (src/lib/duel/runReducer.ts); this
 * hook only wires it to the Convex round-batch query and the locally stored
 * best streak. Round batches prefetch before the supply runs out, so play
 * normally never shows a loading state after the first round.
 */
export function useDuelGame(): UseDuelGameReturn {
  const [state, dispatch] = useReducer(
    duelRunReducer,
    undefined,
    // Seed is irrelevant to the first paint (loading UI), so Math.random here
    // is hydration-safe: server and client render identical markup.
    () => createInitialRunState(newRunSeed()),
  );

  // Best streak lives in localStorage behind a tiny external store: SSR sees
  // 0, the client subscribes to same-tab writes and cross-tab storage events.
  const bestStreak = useSyncExternalStore(subscribeBestStreak, readBestStreak, () => 0);

  // Best streak as of the start of the current run; lets isNewBest stay
  // derived even after the record is written mid-"over" screen. Lazy init is
  // hydration-safe: the value never renders before a run ends on the client.
  const [bestAtRunStart, setBestAtRunStart] = useState(() => readBestStreak());

  const pendingBatch = state.pendingBatch;
  const batchResult = useQuery(
    anyPublicApi.duel.getDuelRounds,
    pendingBatch
      ? {
          seed: pendingBatch.seed,
          count: DUEL_BATCH_SIZE,
          startRound: pendingBatch.startRound,
          excludeIds: pendingBatch.excludeIds,
        }
      : "skip",
  );

  useEffect(() => {
    if (!pendingBatch || batchResult === undefined) {
      return;
    }
    dispatch({
      type: "batch-arrived",
      forSeed: pendingBatch.seed,
      forStartRound: pendingBatch.startRound,
      rounds: batchResult.rounds,
    });
  }, [batchResult, pendingBatch]);

  // Persist the record the moment a run ends; the store subscription updates
  // `bestStreak` in turn, so no state lives here.
  const finalStreak = state.over ? streakOf(state) : null;
  useEffect(() => {
    if (finalStreak !== null && finalStreak > 0 && finalStreak > readBestStreak()) {
      writeBestStreak(finalStreak);
    }
  }, [finalStreak]);

  const isNewBest = finalStreak !== null && finalStreak > 0 && finalStreak > bestAtRunStart;

  const choose = useCallback((slot: DuelSlot) => {
    dispatch({ type: "choose", slot });
  }, []);

  const advance = useCallback(() => {
    dispatch({ type: "advance" });
  }, []);

  const restart = useCallback(() => {
    setBestAtRunStart(readBestStreak());
    dispatch({ type: "restart", seed: newRunSeed() });
  }, []);

  const status: DuelStatus = state.over
    ? "over"
    : isAwaitingRounds(state)
      ? "loading"
      : state.phase === "revealed"
        ? "revealed"
        : "choosing";

  return {
    status,
    round: currentRoundOf(state),
    streak: streakOf(state),
    bestStreak,
    isNewBest,
    pick: state.pick,
    wasCorrect: state.wasCorrect,
    endReason: state.endReason,
    choose,
    advance,
    restart,
  };
}
