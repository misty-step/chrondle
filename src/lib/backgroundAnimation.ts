// Background animation logic for Chrondle
// Calculates animation intensity based on guess proximity to target year

export enum AnimationPhase {
  Idle = "idle",
  Subtle = "subtle",
  Moderate = "moderate",
  Intense = "intense",
  Climax = "climax",
}

/**
 * Calculates animation intensity based on guess proximity to target year
 * Uses mathematical decay function for smooth intensity transitions
 *
 * @param guesses - Array of year guesses made by player
 * @param targetYear - The correct year for current puzzle
 * @returns Intensity value between 0.0 (no animation) and 1.0 (maximum animation)
 */
export function calculateAnimationIntensity(guesses: number[], targetYear: number): number {
  if (guesses.length === 0) {
    return 0;
  }

  // Find the closest guess to target year
  const bestDistance = Math.min(...guesses.map((guess) => Math.abs(guess - targetYear)));

  // Perfect guess = maximum intensity
  if (bestDistance === 0) {
    return 1.0;
  }

  // Use exponential decay function based on proximity thresholds
  // Inspired by PROXIMITY_THRESHOLDS but with smooth mathematical transitions

  // Map distance to intensity using inverse exponential function
  // Within 5 years: 0.9-1.0 intensity
  // Within 10 years: 0.7-0.9 intensity
  // Within 25 years: 0.5-0.7 intensity
  // Within 50 years: 0.3-0.5 intensity
  // Within 100 years: 0.1-0.3 intensity
  // Beyond 500 years: 0.0-0.1 intensity

  if (bestDistance <= 5) {
    // Very close: 0.8-1.0 intensity with fine graduation
    return Math.max(0.8, 1.0 - bestDistance / 25);
  } else if (bestDistance <= 10) {
    // Close: 0.6-0.8 intensity
    return Math.max(0.6, 0.8 - (bestDistance - 5) / 25);
  } else if (bestDistance <= 25) {
    // Moderate: 0.4-0.6 intensity
    return Math.max(0.4, 0.6 - (bestDistance - 10) / 37.5);
  } else if (bestDistance <= 50) {
    // Distant: 0.2-0.4 intensity
    return Math.max(0.2, 0.4 - (bestDistance - 25) / 62.5);
  } else if (bestDistance <= 100) {
    // Far: 0.1-0.2 intensity
    return Math.max(0.1, 0.2 - (bestDistance - 50) / 125);
  } else if (bestDistance <= 500) {
    // Very far: 0.0-0.1 intensity
    return Math.max(0.0, 0.1 - (bestDistance - 100) / 800);
  } else {
    // Extremely far: minimal animation
    return 0.0;
  }
}

/**
 * Maps animation intensity to discrete animation phases
 * Allows CSS to use specific animation keyframes for each phase
 *
 * @param intensity - Calculated intensity value (0.0-1.0)
 * @returns AnimationPhase enum value
 */
export function getAnimationPhase(intensity: number): AnimationPhase {
  if (intensity === 0) {
    return AnimationPhase.Idle;
  } else if (intensity <= 0.2) {
    return AnimationPhase.Subtle;
  } else if (intensity <= 0.4) {
    return AnimationPhase.Moderate;
  } else if (intensity <= 0.6) {
    return AnimationPhase.Intense;
  } else {
    return AnimationPhase.Climax;
  }
}

/**
 * Animation configuration constants
 */
export const ANIMATION_CONFIG = {
  // Animation durations for each phase (in seconds)
  DURATIONS: {
    [AnimationPhase.Idle]: 0,
    [AnimationPhase.Subtle]: 8,
    [AnimationPhase.Moderate]: 6,
    [AnimationPhase.Intense]: 4,
    [AnimationPhase.Climax]: 2,
  },

  // Opacity levels for background elements
  OPACITY: {
    [AnimationPhase.Idle]: 0,
    [AnimationPhase.Subtle]: 0.05,
    [AnimationPhase.Moderate]: 0.1,
    [AnimationPhase.Intense]: 0.15,
    [AnimationPhase.Climax]: 0.2,
  },

  // Number of animated elements for each phase
  ELEMENT_COUNT: {
    [AnimationPhase.Idle]: 0,
    [AnimationPhase.Subtle]: 12,
    [AnimationPhase.Moderate]: 18,
    [AnimationPhase.Intense]: 24,
    [AnimationPhase.Climax]: 36,
  },
} as const;

/**
 * CSS custom property names for animation control
 */
export const ANIMATION_CSS_VARS = {
  INTENSITY: "--animation-intensity",
  PHASE: "--animation-phase",
  DURATION: "--animation-duration",
  OPACITY: "--animation-opacity",
  ELEMENT_COUNT: "--animation-element-count",
} as const;
