/**
 * LocalStorage Migration Utility
 * Handles backward compatibility for users with old localStorage data
 * from before the Convex migration and BC/AD input changes
 */

import { logger } from "./logger";

/**
 * Result of the migration process
 */
export interface MigrationResult {
  success: boolean;
  migratedKeys: string[];
  errors: string[];
  hasLegacyData: boolean;
}

/**
 * Detects if there's legacy localStorage data that needs migration/cleanup
 * @returns true if legacy data exists
 */
export function detectLegacyLocalStorage(): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }

    // Check for old game progress keys (date-based format)
    const hasProgressKeys = keys.some(
      (key) =>
        key.startsWith("chrondle-progress-") ||
        key.startsWith("chrondle-game-") ||
        key.startsWith("chrondle-state-"),
    );

    // Check for old settings or session keys
    const hasOldKeys = keys.some(
      (key) =>
        key === "chrondle-settings" ||
        key === "chrondle-theme" ||
        key === "chrondle-stats" ||
        key === "chrondle-achievements" ||
        key === "chrondle-session" ||
        key === "chrondle-debug",
    );

    return hasProgressKeys || hasOldKeys;
  } catch (error) {
    logger.warn("Error detecting legacy localStorage:", error);
    return false;
  }
}

/**
 * Migrates/cleans up legacy localStorage data
 * This function safely removes old game data that's no longer used
 * since the app now uses Convex for persistence
 *
 * @returns MigrationResult with details of what was migrated/cleaned
 */
export function migrateLegacyLocalStorage(): MigrationResult {
  const result: MigrationResult = {
    success: true,
    migratedKeys: [],
    errors: [],
    hasLegacyData: false,
  };

  if (typeof window === "undefined" || !window.localStorage) {
    return result;
  }

  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    result.hasLegacyData = detectLegacyLocalStorage();

    if (!result.hasLegacyData) {
      logger.debug("No legacy localStorage data found");
      return result;
    }

    logger.info("Starting localStorage migration/cleanup");

    // Keys to preserve (still in use)
    const preserveKeys = new Set([
      "chrondle-anonymous-id", // Still used for anonymous user tracking
      "chrondle-game-state", // Used for anonymous game state persistence
    ]);

    // Patterns for keys to remove (no longer used)
    const removePatterns = [
      /^chrondle-progress-/, // Old date-based progress keys
      /^chrondle-game-\d/, // Old game state keys with dates (not chrondle-game-state)
      /^chrondle-state-/, // Old state keys
      /^chrondle-puzzle-/, // Old puzzle keys
    ];

    // Specific keys to remove
    const removeKeys = [
      "chrondle-settings",
      "chrondle-theme",
      "chrondle-stats",
      "chrondle-achievements",
      "chrondle-session",
      "chrondle-debug",
      "chrondle-lastPlayedDate",
      "chrondle-streak",
    ];

    // Process each key
    for (const key of keys) {
      try {
        // Skip preserved keys
        if (preserveKeys.has(key)) {
          continue;
        }

        // Check if key matches any removal pattern
        const shouldRemove =
          removePatterns.some((pattern) => pattern.test(key)) || removeKeys.includes(key);

        if (shouldRemove) {
          // Log the data before removal for debugging (in dev only)
          if (process.env.NODE_ENV === "development") {
            try {
              const value = localStorage.getItem(key);
              logger.debug(`Removing legacy key "${key}":`, value);

              // Check if it contains negative year values (BC years)
              if (value && value.includes("guesses")) {
                const data = JSON.parse(value);
                if (data.guesses && Array.isArray(data.guesses)) {
                  const hasNegativeYears = data.guesses.some((g: number) => g < 0);
                  if (hasNegativeYears) {
                    logger.debug(`Found negative years (BC) in ${key}:`, data.guesses);
                  }
                }
              }
            } catch {
              // Ignore parse errors - just log key removal
            }
          }

          // Remove the key
          localStorage.removeItem(key);
          result.migratedKeys.push(key);
          logger.debug(`Removed legacy key: ${key}`);
        }
      } catch (error) {
        const errorMsg = `Failed to process key "${key}": ${error}`;
        result.errors.push(errorMsg);
        logger.warn(errorMsg);
      }
    }

    if (result.migratedKeys.length > 0) {
      logger.info(
        `LocalStorage migration complete. Removed ${result.migratedKeys.length} legacy keys.`,
      );
    }

    // Mark migration as complete (even if there were some errors)
    result.success = result.errors.length === 0;
  } catch (error) {
    result.success = false;
    result.errors.push(`Migration failed: ${error}`);
    logger.error("LocalStorage migration failed:", error);
  }

  return result;
}

/**
 * Runs migration on app initialization
 * This should be called once when the app starts
 */
export function runMigrationOnInit(): void {
  if (typeof window === "undefined") {
    return;
  }

  // Check if migration has already been run in this session
  const migrationKey = "chrondle-migration-v2-complete";
  const migrationComplete = sessionStorage.getItem(migrationKey);

  if (migrationComplete) {
    logger.debug("Migration already run in this session");
    return;
  }

  // Run migration
  const result = migrateLegacyLocalStorage();

  if (result.hasLegacyData) {
    logger.info("Legacy data migration result:", {
      success: result.success,
      migratedKeysCount: result.migratedKeys.length,
      errorsCount: result.errors.length,
    });

    // Mark migration as complete for this session
    try {
      sessionStorage.setItem(migrationKey, "true");
    } catch (error) {
      logger.warn("Could not mark migration as complete in sessionStorage:", error);
    }
  }
}

/**
 * Helper to manually clear all Chrondle localStorage data
 * (except anonymous ID which is still in use)
 * Useful for debugging and testing
 */
export function clearAllChronldeLocalStorage(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) keys.push(key);
  }
  let removedCount = 0;

  for (const key of keys) {
    if (key.startsWith("chrondle-") && key !== "chrondle-anonymous-id") {
      localStorage.removeItem(key);
      removedCount++;
    }
  }

  logger.info(`Cleared ${removedCount} Chrondle localStorage keys`);
}
