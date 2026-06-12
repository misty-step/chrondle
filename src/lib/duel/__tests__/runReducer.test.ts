import { describe, it, expect } from "vitest";
import {
  createInitialRunState,
  duelRunReducer,
  streakOf,
  currentRoundOf,
  isAwaitingRounds,
  type DuelRoundView,
  type DuelRunState,
} from "../runReducer";

function makeRound(roundIndex: number, firstYear: number, secondYear: number): DuelRoundView {
  return {
    roundIndex,
    first: { id: `r${roundIndex}a`, year: firstYear, text: `Event ${firstYear}` },
    second: { id: `r${roundIndex}b`, year: secondYear, text: `Event ${secondYear}` },
    gap: Math.abs(firstYear - secondYear),
    tierLabel: "Novice",
  };
}

function makeRounds(count: number, startIndex = 0): DuelRoundView[] {
  return Array.from({ length: count }, (_, i) =>
    makeRound(startIndex + i, 1000 + i * 10, 1500 + i * 10),
  );
}

function withFirstBatch(state: DuelRunState, rounds: DuelRoundView[]): DuelRunState {
  return duelRunReducer(state, {
    type: "batch-arrived",
    forSeed: state.pendingBatch!.seed,
    forStartRound: state.pendingBatch!.startRound,
    rounds,
  });
}

describe("createInitialRunState", () => {
  it("starts in choosing phase with an outstanding first batch request", () => {
    const state = createInitialRunState(42);
    expect(state.phase).toBe("choosing");
    expect(state.over).toBe(false);
    expect(state.pendingBatch).toEqual({ seed: 42, startRound: 0, excludeIds: [] });
    expect(isAwaitingRounds(state)).toBe(true);
    expect(streakOf(state)).toBe(0);
  });
});

describe("batch-arrived", () => {
  it("appends rounds and clears the pending request", () => {
    const state = withFirstBatch(createInitialRunState(1), makeRounds(12));
    expect(state.rounds).toHaveLength(12);
    expect(state.pendingBatch).toBeNull();
    expect(isAwaitingRounds(state)).toBe(false);
    expect(currentRoundOf(state)?.roundIndex).toBe(0);
  });

  it("ignores stale responses from superseded requests", () => {
    const initial = createInitialRunState(1);
    const stale = duelRunReducer(initial, {
      type: "batch-arrived",
      forSeed: 999,
      forStartRound: 0,
      rounds: makeRounds(12),
    });
    expect(stale.rounds).toHaveLength(0);
    expect(stale.pendingBatch).not.toBeNull();
  });

  it("ends the run as exhausted when an empty batch arrives with nothing left to play", () => {
    const state = withFirstBatch(createInitialRunState(1), []);
    expect(state.over).toBe(true);
    expect(state.endReason).toBe("exhausted");
  });
});

describe("choose", () => {
  it("marks a correct pick and keeps the run alive", () => {
    let state = withFirstBatch(createInitialRunState(1), [makeRound(0, 1066, 1492)]);
    state = duelRunReducer(state, { type: "choose", slot: "first" });

    expect(state.phase).toBe("revealed");
    expect(state.pick).toBe("first");
    expect(state.wasCorrect).toBe(true);
    expect(state.over).toBe(false);
    expect(streakOf(state)).toBe(1);
  });

  it("ends the run on a wrong pick", () => {
    let state = withFirstBatch(createInitialRunState(1), [makeRound(0, 1066, 1492)]);
    state = duelRunReducer(state, { type: "choose", slot: "second" });

    expect(state.phase).toBe("revealed");
    expect(state.wasCorrect).toBe(false);
    expect(state.over).toBe(true);
    expect(state.endReason).toBe("miss");
    expect(streakOf(state)).toBe(0);
  });

  it("ignores taps outside the choosing phase and after the run ends", () => {
    let state = withFirstBatch(createInitialRunState(1), makeRounds(2));
    state = duelRunReducer(state, { type: "choose", slot: "first" });
    const afterSecondTap = duelRunReducer(state, { type: "choose", slot: "second" });
    expect(afterSecondTap).toBe(state);

    const lost = duelRunReducer(withFirstBatch(createInitialRunState(2), makeRounds(1)), {
      type: "choose",
      slot: "second",
    });
    expect(duelRunReducer(lost, { type: "choose", slot: "first" })).toBe(lost);
  });

  it("ignores taps while awaiting rounds", () => {
    const state = createInitialRunState(1);
    expect(duelRunReducer(state, { type: "choose", slot: "first" })).toBe(state);
  });
});

describe("advance", () => {
  it("moves to the next round after a correct reveal", () => {
    let state = withFirstBatch(createInitialRunState(1), makeRounds(12));
    state = duelRunReducer(state, { type: "choose", slot: "first" });
    state = duelRunReducer(state, { type: "advance" });

    expect(state.currentIndex).toBe(1);
    expect(state.phase).toBe("choosing");
    expect(state.pick).toBeNull();
    expect(streakOf(state)).toBe(1);
  });

  it("does nothing after a wrong reveal or mid-choice", () => {
    let state = withFirstBatch(createInitialRunState(1), makeRounds(3));
    expect(duelRunReducer(state, { type: "advance" })).toBe(state);

    state = duelRunReducer(state, { type: "choose", slot: "second" });
    expect(duelRunReducer(state, { type: "advance" })).toBe(state);
  });

  it("requests the next batch when supply runs low, excluding seen events", () => {
    let state = withFirstBatch(createInitialRunState(100), makeRounds(12));

    // Play until 4 rounds remain unplayed: indexes 0..7 (advance to 8).
    for (let i = 0; i < 8; i++) {
      state = duelRunReducer(state, { type: "choose", slot: "first" });
      state = duelRunReducer(state, { type: "advance" });
    }

    expect(state.currentIndex).toBe(8);
    expect(state.pendingBatch).not.toBeNull();
    expect(state.pendingBatch!.startRound).toBe(12);
    expect(state.pendingBatch!.seed).not.toBe(100);
    expect(state.pendingBatch!.excludeIds).toContain("r0a");
    expect(state.pendingBatch!.excludeIds).toContain("r11b");

    // Continuation batch picks up at the right round index.
    const continued = duelRunReducer(state, {
      type: "batch-arrived",
      forSeed: state.pendingBatch!.seed,
      forStartRound: 12,
      rounds: makeRounds(12, 12),
    });
    expect(continued.rounds).toHaveLength(24);
    expect(continued.pendingBatch).toBeNull();
  });

  it("does not duplicate batch requests while one is outstanding", () => {
    let state = withFirstBatch(createInitialRunState(100), makeRounds(12));
    for (let i = 0; i < 8; i++) {
      state = duelRunReducer(state, { type: "choose", slot: "first" });
      state = duelRunReducer(state, { type: "advance" });
    }
    const pending = state.pendingBatch;

    state = duelRunReducer(state, { type: "choose", slot: "first" });
    state = duelRunReducer(state, { type: "advance" });
    expect(state.pendingBatch).toBe(pending);
  });
});

describe("restart", () => {
  it("resets everything under a fresh seed", () => {
    let state = withFirstBatch(createInitialRunState(1), makeRounds(2));
    state = duelRunReducer(state, { type: "choose", slot: "second" });
    expect(state.over).toBe(true);

    const restarted = duelRunReducer(state, { type: "restart", seed: 777 });
    expect(restarted).toEqual(createInitialRunState(777));
  });

  it("ignores late batches addressed to the previous run", () => {
    let state = withFirstBatch(createInitialRunState(1), makeRounds(12));
    state = duelRunReducer(state, { type: "restart", seed: 777 });

    const lateOldBatch = duelRunReducer(state, {
      type: "batch-arrived",
      forSeed: 1,
      forStartRound: 0,
      rounds: makeRounds(12),
    });
    expect(lateOldBatch.rounds).toHaveLength(0);
  });
});

describe("full run integration", () => {
  it("plays a 20-round run to a miss with correct streak accounting", () => {
    let state = withFirstBatch(createInitialRunState(5), makeRounds(12));

    for (let i = 0; i < 8; i++) {
      state = duelRunReducer(state, { type: "choose", slot: "first" });
      expect(state.wasCorrect).toBe(true);
      state = duelRunReducer(state, { type: "advance" });
    }

    state = duelRunReducer(state, {
      type: "batch-arrived",
      forSeed: state.pendingBatch!.seed,
      forStartRound: 12,
      rounds: makeRounds(8, 12),
    });

    for (let i = 8; i < 19; i++) {
      state = duelRunReducer(state, { type: "choose", slot: "first" });
      state = duelRunReducer(state, { type: "advance" });
    }

    expect(streakOf(state)).toBe(19);
    state = duelRunReducer(state, { type: "choose", slot: "second" });

    expect(state.over).toBe(true);
    expect(state.endReason).toBe("miss");
    expect(streakOf(state)).toBe(19);
  });
});
