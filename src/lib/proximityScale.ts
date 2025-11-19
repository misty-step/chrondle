export interface ProximityScaleInput {
  rangeStart: number;
  rangeEnd: number;
  targetYear?: number;
}

export interface ProximityScaleResult {
  axisStart: number;
  axisEnd: number;
  rangeStartPct: number;
  rangeEndPct: number;
  targetPct: number | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeProximityScale({
  rangeStart,
  rangeEnd,
  targetYear,
}: ProximityScaleInput): ProximityScaleResult {
  const normalizedStart = Math.min(
    rangeStart,
    typeof targetYear === "number" ? targetYear : rangeStart,
  );
  const normalizedEnd = Math.max(rangeEnd, typeof targetYear === "number" ? targetYear : rangeEnd);
  const span = Math.max(1, normalizedEnd - normalizedStart);
  const toPercent = (value: number) => ((value - normalizedStart) / span) * 100;

  const rangeStartPct = clamp(toPercent(rangeStart), 0, 100);
  const rangeEndPct = clamp(toPercent(rangeEnd), 0, 100);
  const targetPct = typeof targetYear === "number" ? clamp(toPercent(targetYear), 0, 100) : null;

  return {
    axisStart: normalizedStart,
    axisEnd: normalizedEnd,
    rangeStartPct,
    rangeEndPct,
    targetPct,
  };
}
