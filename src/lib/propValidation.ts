/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Simple runtime prop validation for critical components
 * Provides development-time checks without complex type gymnastics
 */

import { logger } from "@/lib/logger";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Log validation warning in development
 */
function warn(componentName: string, message: string): void {
  if (isDevelopment) {
    logger.warn(`[${componentName}] ${message}`);
  }
}

/**
 * Validate GameLayout critical props
 */
export function validateGameLayoutProps(props: unknown, componentName = "GameLayout"): void {
  if (!isDevelopment) return;

  const p = props as Record<string, any>;

  // Check gameState structure
  if (!p.gameState) {
    warn(componentName, "Missing required prop: gameState");
    return;
  }

  if (typeof p.gameState !== "object") {
    warn(componentName, "gameState must be an object");
    return;
  }

  // Check gameState.guesses is array
  if (!Array.isArray(p.gameState.guesses)) {
    warn(componentName, "gameState.guesses must be an array");
  }

  if (typeof p.gameState.totalScore !== "number") {
    warn(componentName, "gameState.totalScore must be a number");
  }

  if (!Array.isArray(p.gameState.ranges)) {
    warn(componentName, "gameState.ranges must be an array");
  }

  // Check gameState.isGameOver is boolean
  if (typeof p.gameState.isGameOver !== "boolean") {
    warn(componentName, "gameState.isGameOver must be a boolean");
  }

  // Check onRangeCommit is function
  if (typeof p.onRangeCommit !== "function") {
    warn(componentName, "onRangeCommit must be a function");
  }

  if (typeof p.remainingAttempts !== "number") {
    warn(componentName, "remainingAttempts must be a number");
  } else if (p.remainingAttempts < 0 || p.remainingAttempts > 6) {
    warn(componentName, "remainingAttempts must be between 0 and 6");
  }

  // Check numeric props (removed currentHintIndex - now calculated internally)

  // Check boolean props
  const booleanProps = ["isGameComplete", "hasWon", "isLoading"];
  for (const propName of booleanProps) {
    if (typeof p[propName] !== "boolean") {
      warn(componentName, `${propName} must be a boolean`);
    }
  }
}

/**
 * Validate HintsDisplay critical props
 */
export function validateHintsDisplayProps(props: unknown, componentName = "HintsDisplay"): void {
  if (!isDevelopment) return;

  const p = props as Record<string, any>;

  // Check events array
  if (!Array.isArray(p.events)) {
    warn(componentName, "events must be an array");
  } else if (p.events.length > 0 && p.events.length !== 6) {
    warn(componentName, "events array must have exactly 6 items");
  }

  // Check guesses array
  if (!Array.isArray(p.guesses)) {
    warn(componentName, "guesses must be an array");
  }

  // Check targetYear is number
  if (typeof p.targetYear !== "number") {
    warn(componentName, "targetYear must be a number");
  }

  // Check optional isGameComplete boolean
  if (p.isGameComplete !== undefined && typeof p.isGameComplete !== "boolean") {
    warn(componentName, "isGameComplete must be a boolean if provided");
  }

  // Note: currentHintIndex and isLoading props removed from interface
  // These are now calculated internally by the component
}
