import { Doc } from "../_generated/dataModel";

export interface RangeRecord {
  start: number;
  end: number;
  hintsUsed: number;
  score: number;
  timestamp: number;
}

export type NormalizedPlay = Doc<"plays"> & {
  ranges: RangeRecord[];
  totalScore: number;
  guesses: number[];
};

const TIMESTAMP_STEP_MS = 100;

export function legacyGuessesToRanges(
  guesses: number[] | undefined,
  options: { startingTimestamp?: number } = {},
): RangeRecord[] {
  if (!guesses || guesses.length === 0) {
    return [];
  }

  const baseTimestamp = options.startingTimestamp ?? Date.now();

  return guesses.map((guess, index) => ({
    start: guess,
    end: guess,
    hintsUsed: 0,
    score: 0,
    timestamp: baseTimestamp + index * TIMESTAMP_STEP_MS,
  }));
}

export function normalizePlayData(play: Doc<"plays"> | null): NormalizedPlay | null {
  if (!play) {
    return null;
  }

  const rangesSource =
    play.ranges && play.ranges.length > 0
      ? play.ranges
      : legacyGuessesToRanges(play.guesses, { startingTimestamp: play.updatedAt ?? Date.now() });

  const ranges = [...rangesSource];

  const totalScore =
    typeof play.totalScore === "number"
      ? play.totalScore
      : ranges.reduce((sum, range) => sum + (range.score ?? 0), 0);

  return {
    ...play,
    guesses: play.guesses ?? [],
    ranges,
    totalScore,
  };
}
