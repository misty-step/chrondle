/**
 * Shared share-text format family.
 *
 * Every Chrondle mode shares one artifact shape:
 *
 *   Chrondle[ Mode][ #N]      ← header
 *                             ← blank line
 *   <mode-specific body>      ← the mode's visual grammar
 *                             ← blank line
 *   https://chrondle.app[...] ← footer url
 */

export const SHARE_URL = "https://chrondle.app";

export interface ShareParts {
  /** Mode label appended to "Chrondle" (e.g. "Order", "Duel"); omit for Classic */
  mode?: string;
  /** Puzzle number rendered as "#N" in the header */
  puzzleNumber?: number;
  /** Body lines between header and footer */
  body: string[];
  /** Footer url; defaults to the canonical site url */
  url?: string;
}

export function composeShareText({ mode, puzzleNumber, body, url }: ShareParts): string {
  const header = ["Chrondle", mode, puzzleNumber !== undefined ? `#${puzzleNumber}` : undefined]
    .filter(Boolean)
    .join(" ");
  return `${header}\n\n${body.join("\n")}\n\n${url ?? SHARE_URL}`;
}

/** Singular/plural helper for stat lines ("1 year", "3 hints"). */
export function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
