export type RangeValue = [number, number];

export type HintCount = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface RangeGuess {
  start: number;
  end: number;
  hintsUsed: HintCount;
  score: number;
  timestamp: number;
}

export interface ScoreResult {
  score: number;
  contained: boolean;
  baseScore: number;
  width: number;
}

export interface RangeHint {
  level: 1 | 2 | 3;
  content: string;
  multiplier: number;
}
