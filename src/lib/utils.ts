import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Deterministic pseudo-random number generator using Math.sin.
 * Returns a value in [0, 1) for a given seed.
 * Useful for generating stable "random" values that don't change on re-render.
 */
export function seededRandom(seed: number): number {
  const normalized = Math.sin(seed) * 10000;
  return normalized - Math.floor(normalized);
}
