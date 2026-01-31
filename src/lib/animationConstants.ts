/**
 * Animation constants for Chrondle.
 * All durations in ms unless noted. Keep fast + consistent.
 * Use reduced motion checks; prefer ease/tween, no springs.
 */

// Re-export useReducedMotion for convenience
export { useReducedMotion } from "motion/react";

/**
 * Animation durations for different UI components
 *
 * These timings are carefully choreographed to create a satisfying
 * flow from guess submission → feedback → next hint reveal
 *
 * @example
 * // Using in Framer Motion transitions
 * <motion.div
 *   transition={{
 *     duration: ANIMATION_DURATIONS.HINT_TRANSITION / 1000,
 *     delay: ANIMATION_DURATIONS.HINT_DELAY / 1000
 *   }}
 * />
 */
export const ANIMATION_DURATIONS = {
  // Button interactions
  BUTTON_PRESS: 150,
  BUTTON_HOVER: 150,
  INPUT_TRANSITION: 150,

  // Guess flow sequence
  TIMELINE_UPDATE: 150,
  PROXIMITY_FADE: 150,
  HINT_TRANSITION: 150,

  // Stagger delays
  PROXIMITY_DELAY: 150,
  HINT_DELAY: 150,
  HINT_FEEDBACK: 150,
  HINT_EXIT_DELAY: 150,
  DEMOTED_HINT_DELAY: 150,
  NEW_HINT_DELAY: 150,

  // Copy/share feedback
  COPY_FEEDBACK: 150,

  // Modal and notification timings
  ACHIEVEMENT_MODAL_AUTO_CLOSE: 150,
  HEARTBEAT_NOTIFICATION: 150,

  // Game animations (legacy)
  TIMELINE_ANIMATION: 150,
  CELEBRATION_DURATION: 150,
  NUMBER_TICKER_DEFAULT: 150,

  // Text animations
  TEXT_ANIMATE_DEFAULT: 150,

  // Ripple effects
  RIPPLE_DEFAULT: 150,

  // Total expected flow - for tests/debugging
  GUESS_FLOW_TOTAL: 500,
} as const;

/**
 * Tween presets (no spring physics).
 */
export const ANIMATION_SPRINGS = {
  BOUNCY: { type: "tween", duration: 0.15, ease: [0.25, 0.1, 0.25, 1] },
  SMOOTH: { type: "tween", duration: 0.15, ease: [0.25, 0.1, 0.25, 1] },
  GENTLE: { type: "tween", duration: 0.15, ease: [0.25, 0.1, 0.25, 1] },
} as const;

/**
 * Simple easing curves.
 */
export const ANIMATION_EASINGS = {
  ANTICIPATION: [0.25, 0.1, 0.25, 1] as const,
  SMOOTH_OUT: [0.25, 0.1, 0.25, 1] as const,
  SMOOTH_IN_OUT: [0.25, 0.1, 0.25, 1] as const,
} as const;

/**
 * CSS class transition durations for Tailwind utility classes
 *
 * Use these when applying Tailwind's duration utilities for consistency
 * with JavaScript-based animations
 */
export const CSS_DURATIONS = {
  /** Tailwind duration-150 class (150ms) - Fast transitions */
  TRANSITION_200: "duration-150",
  /** Tailwind duration-150 class (150ms) - Fast transitions */
  TRANSITION_300: "duration-150",
  /** Tailwind duration-150 class (150ms) - Fast transitions */
  TRANSITION_600: "duration-150",
} as const;

/**
 * Converts milliseconds to seconds for CSS/animation library compatibility
 *
 * Many animation libraries (including Framer Motion) expect durations in seconds
 * while our constants are defined in milliseconds for clarity
 *
 * @param ms - Duration in milliseconds
 * @returns Duration in seconds
 *
 * @example
 * // Convert HINT_DELAY for Framer Motion
 * <motion.div
 *   transition={{ delay: msToSeconds(ANIMATION_DURATIONS.HINT_DELAY) }}
 * />
 */
export const msToSeconds = (ms: number): number => ms / 1000;

/**
 * Formats milliseconds as a CSS duration string
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted CSS duration string (e.g., "300ms")
 *
 * @example
 * // Use in inline styles or CSS-in-JS
 * const style = {
 *   transitionDuration: formatCssDuration(ANIMATION_DURATIONS.BUTTON_PRESS)
 * };
 */
export const formatCssDuration = (ms: number): string => `${ms}ms`;

/**
 * Type exports for TypeScript safety
 *
 * These types allow for autocomplete and type checking when referencing
 * animation constant keys in other parts of the codebase
 */

/** Union type of all available animation duration keys */
export type AnimationDuration = keyof typeof ANIMATION_DURATIONS;

/** Union type of all available spring preset keys */
export type AnimationSpring = keyof typeof ANIMATION_SPRINGS;

/** Union type of all available easing curve keys */
export type AnimationEasing = keyof typeof ANIMATION_EASINGS;
