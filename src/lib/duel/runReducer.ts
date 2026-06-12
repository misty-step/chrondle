/**
 * Pure state machine for a Duel run.
 *
 * Mirrors the Classic architecture (pure derivation, thin hooks): every game
 * rule lives here as a plain reducer so the run flow is unit-testable without
 * React or Convex. The `useDuelGame` hook wires this to the round-batch query
 * and localStorage; components only render.
 *
 * Run flow:
 *   choosing → (choose) → revealed → (advance, if correct) → choosing → …
 *                                  ↘ over (wrong pick ends the run)
 *
 * Rounds arrive in server batches. The reducer requests the next batch a few
 * rounds before the current supply runs out so play never stalls.
 */

export interface DuelRoundEventView {
  id: string;
  year: number;
  text: string;
}

export interface DuelRoundView {
  roundIndex: number;
  first: DuelRoundEventView;
  second: DuelRoundEventView;
  gap: number;
  tierLabel: string;
}

export type DuelSlot = "first" | "second";

export interface DuelBatchRequest {
  seed: number;
  startRound: number;
  excludeIds: string[];
}

export interface DuelRunState {
  /** Seed for the whole run; batch seeds derive from it */
  seed: number;
  /** Batches requested so far (drives derived batch seeds) */
  batchNumber: number;
  /** Outstanding server request, or null when supply is sufficient */
  pendingBatch: DuelBatchRequest | null;
  /** All rounds fetched this run, in play order */
  rounds: DuelRoundView[];
  /** Index of the round currently in front of the player */
  currentIndex: number;
  phase: "choosing" | "revealed";
  /** Which slot the player tapped this round */
  pick: DuelSlot | null;
  wasCorrect: boolean | null;
  /** True once the run has ended */
  over: boolean;
  endReason: "miss" | "exhausted" | null;
}

export type DuelRunAction =
  | {
      type: "batch-arrived";
      forSeed: number;
      forStartRound: number;
      rounds: DuelRoundView[];
    }
  | { type: "choose"; slot: DuelSlot }
  | { type: "advance" }
  | { type: "restart"; seed: number };

/** Request the next batch when this few unplayed rounds remain. */
const PREFETCH_THRESHOLD = 4;
/** Rounds per server request. */
export const DUEL_BATCH_SIZE = 12;
/** Keep the exclusion window bounded (server caps anyway). */
const MAX_EXCLUDE_IDS = 240;

export function createInitialRunState(seed: number): DuelRunState {
  return {
    seed,
    batchNumber: 1,
    pendingBatch: { seed, startRound: 0, excludeIds: [] },
    rounds: [],
    currentIndex: 0,
    phase: "choosing",
    pick: null,
    wasCorrect: null,
    over: false,
    endReason: null,
  };
}

export function duelRunReducer(state: DuelRunState, action: DuelRunAction): DuelRunState {
  switch (action.type) {
    case "batch-arrived": {
      const { pendingBatch } = state;
      if (
        !pendingBatch ||
        pendingBatch.seed !== action.forSeed ||
        pendingBatch.startRound !== action.forStartRound
      ) {
        // Stale response from a superseded request (e.g. after restart).
        return state;
      }

      if (action.rounds.length === 0) {
        // Pool cannot produce more rounds. If the player has nothing left to
        // play, the run ends gracefully; an in-progress round still plays out.
        const nothingLeft = state.currentIndex >= state.rounds.length;
        return {
          ...state,
          pendingBatch: null,
          over: state.over || nothingLeft,
          endReason: state.endReason ?? (nothingLeft ? "exhausted" : null),
        };
      }

      return {
        ...state,
        pendingBatch: null,
        rounds: [...state.rounds, ...action.rounds],
      };
    }

    case "choose": {
      if (state.over || state.phase !== "choosing") {
        return state;
      }

      const round = state.rounds[state.currentIndex];
      if (!round) {
        return state;
      }

      const chosen = round[action.slot];
      const other = round[action.slot === "first" ? "second" : "first"];
      const correct = chosen.year < other.year;

      return {
        ...state,
        phase: "revealed",
        pick: action.slot,
        wasCorrect: correct,
        over: !correct,
        endReason: correct ? null : "miss",
      };
    }

    case "advance": {
      if (state.over || state.phase !== "revealed" || !state.wasCorrect) {
        return state;
      }

      const nextIndex = state.currentIndex + 1;
      const advanced: DuelRunState = {
        ...state,
        currentIndex: nextIndex,
        phase: "choosing",
        pick: null,
        wasCorrect: null,
      };

      const remaining = advanced.rounds.length - nextIndex;
      if (!advanced.pendingBatch && remaining <= PREFETCH_THRESHOLD) {
        return {
          ...advanced,
          batchNumber: advanced.batchNumber + 1,
          pendingBatch: {
            seed: deriveBatchSeed(advanced.seed, advanced.batchNumber),
            startRound: advanced.rounds.length,
            excludeIds: collectUsedIds(advanced.rounds),
          },
        };
      }

      return advanced;
    }

    case "restart":
      return createInitialRunState(action.seed);

    default:
      return state;
  }
}

/** Streak is fully derived: count of correct answers so far. */
export function streakOf(state: DuelRunState): number {
  return state.phase === "revealed" && state.wasCorrect
    ? state.currentIndex + 1
    : state.currentIndex;
}

export function currentRoundOf(state: DuelRunState): DuelRoundView | null {
  return state.rounds[state.currentIndex] ?? null;
}

/** True while the player wants a round that has not arrived yet. */
export function isAwaitingRounds(state: DuelRunState): boolean {
  return !state.over && state.currentIndex >= state.rounds.length;
}

function deriveBatchSeed(runSeed: number, batchNumber: number): number {
  // Keep within int32 range for the server PRNG.
  return (runSeed + batchNumber * 7919) % 2147483647;
}

function collectUsedIds(rounds: DuelRoundView[]): string[] {
  const ids = rounds.flatMap((round) => [round.first.id, round.second.id]);
  return ids.slice(-MAX_EXCLUDE_IDS);
}
