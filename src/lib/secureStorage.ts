/**
 * Secure localStorage utility with validation and injection prevention
 * Provides type-safe wrappers for localStorage operations with comprehensive security checks
 */

import { z } from "zod";
import { logger } from "@/lib/logger";

/**
 * Security configuration for localStorage operations
 */
const SECURITY_CONFIG = {
  MAX_KEY_LENGTH: 100,
  MAX_VALUE_SIZE: 100_000, // 100KB max per value
  MAX_ARRAY_LENGTH: 1000,
  MAX_STRING_LENGTH: 10_000,
  MAX_NESTED_DEPTH: 5,
  ALLOWED_KEY_PATTERN: /^[a-zA-Z0-9-_]+$/,
} as const;

/**
 * Type for storage validation schema
 */
export interface StorageSchema<T> {
  parse: (data: unknown) => T;
  safeParse: (data: unknown) => { success: boolean; data?: T; error?: unknown };
}

/**
 * Result type for storage operations
 */
export type StorageResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Validates a storage key to prevent injection attacks
 */
function validateKey(key: string): boolean {
  if (!key || typeof key !== "string") {
    return false;
  }

  if (key.length > SECURITY_CONFIG.MAX_KEY_LENGTH) {
    return false;
  }

  // Only allow alphanumeric characters, hyphens, and underscores
  if (!SECURITY_CONFIG.ALLOWED_KEY_PATTERN.test(key)) {
    return false;
  }

  // Prevent prototype pollution attempts
  const dangerousKeys = ["__proto__", "constructor", "prototype"];
  if (dangerousKeys.includes(key.toLowerCase())) {
    return false;
  }

  return true;
}

/**
 * Checks if a value is safe to store (prevents deeply nested objects that could cause DoS)
 */
function isSafeValue(value: unknown, depth = 0): boolean {
  if (depth > SECURITY_CONFIG.MAX_NESTED_DEPTH) {
    return false;
  }

  if (value === null || value === undefined) {
    return true;
  }

  const type = typeof value;

  if (type === "boolean" || type === "number") {
    return true;
  }

  if (type === "string") {
    return (value as string).length <= SECURITY_CONFIG.MAX_STRING_LENGTH;
  }

  if (Array.isArray(value)) {
    if (value.length > SECURITY_CONFIG.MAX_ARRAY_LENGTH) {
      return false;
    }
    return value.every((item) => isSafeValue(item, depth + 1));
  }

  if (type === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);

    if (keys.length > SECURITY_CONFIG.MAX_ARRAY_LENGTH) {
      return false;
    }

    // Check for dangerous keys
    if (keys.some((key) => !validateKey(key))) {
      return false;
    }

    return keys.every((key) => isSafeValue(obj[key], depth + 1));
  }

  // Reject functions, symbols, and other types
  return false;
}

/**
 * Safely parse JSON with validation
 */
function safeJsonParse<T>(json: string, schema?: StorageSchema<T>): T | null {
  try {
    // Check string size before parsing
    if (json.length > SECURITY_CONFIG.MAX_VALUE_SIZE) {
      logger.warn("[SecureStorage] Value exceeds maximum size limit");
      return null;
    }

    // Parse with reviver to detect suspicious patterns
    const parsed = JSON.parse(json, (key, value) => {
      // Reject functions and other dangerous types
      if (typeof value === "function" || typeof value === "symbol") {
        throw new Error("Dangerous value type detected");
      }
      return value;
    });

    // Validate the parsed value structure
    if (!isSafeValue(parsed)) {
      logger.warn("[SecureStorage] Parsed value failed safety check");
      return null;
    }

    // Apply schema validation if provided
    if (schema) {
      const result = schema.safeParse(parsed);
      if (!result.success) {
        logger.warn("[SecureStorage] Schema validation failed:", result.error);
        return null;
      }
      return result.data ?? null;
    }

    return parsed as T;
  } catch (error) {
    logger.warn("[SecureStorage] JSON parse error:", error);
    return null;
  }
}

/**
 * Safely stringify JSON with validation
 */
function safeJsonStringify(value: unknown): string | null {
  try {
    // Validate before stringifying
    if (!isSafeValue(value)) {
      logger.warn("[SecureStorage] Value failed safety check before stringify");
      return null;
    }

    const json = JSON.stringify(value);

    // Check final size
    if (json.length > SECURITY_CONFIG.MAX_VALUE_SIZE) {
      logger.warn("[SecureStorage] Stringified value exceeds maximum size");
      return null;
    }

    return json;
  } catch (error) {
    logger.warn("[SecureStorage] JSON stringify error:", error);
    return null;
  }
}

/**
 * Check if localStorage is available
 */
function isStorageAvailable(): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    const testKey = "__chrondle_storage_test__";
    localStorage.setItem(testKey, "test");
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Securely get an item from localStorage with validation
 */
export function secureGetItem<T>(key: string, schema?: StorageSchema<T>): T | null {
  if (!isStorageAvailable()) {
    return null;
  }

  if (!validateKey(key)) {
    logger.warn("[SecureStorage] Invalid key:", key);
    return null;
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return null;
    }

    return safeJsonParse<T>(raw, schema);
  } catch (error) {
    logger.warn("[SecureStorage] Get item error:", error);
    return null;
  }
}

/**
 * Securely set an item in localStorage with validation
 */
export function secureSetItem<T>(key: string, value: T, schema?: StorageSchema<T>): boolean {
  if (!isStorageAvailable()) {
    return false;
  }

  if (!validateKey(key)) {
    logger.warn("[SecureStorage] Invalid key:", key);
    return false;
  }

  // Validate against schema if provided
  if (schema) {
    const result = schema.safeParse(value);
    if (!result.success) {
      logger.warn("[SecureStorage] Value failed schema validation:", result.error);
      return false;
    }
  }

  const json = safeJsonStringify(value);
  if (json === null) {
    return false;
  }

  try {
    localStorage.setItem(key, json);
    return true;
  } catch (error) {
    logger.warn("[SecureStorage] Set item error:", error);
    return false;
  }
}

/**
 * Securely remove an item from localStorage
 */
export function secureRemoveItem(key: string): boolean {
  if (!isStorageAvailable()) {
    return false;
  }

  if (!validateKey(key)) {
    logger.warn("[SecureStorage] Invalid key:", key);
    return false;
  }

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    logger.warn("[SecureStorage] Remove item error:", error);
    return false;
  }
}

/**
 * Clear all items with a specific prefix from localStorage
 */
export function secureClearPrefix(prefix: string): boolean {
  if (!isStorageAvailable()) {
    return false;
  }

  if (!validateKey(prefix)) {
    logger.warn("[SecureStorage] Invalid prefix:", prefix);
    return false;
  }

  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keys.push(key);
      }
    }

    keys.forEach((key) => {
      localStorage.removeItem(key);
    });

    return true;
  } catch (error) {
    logger.warn("[SecureStorage] Clear prefix error:", error);
    return false;
  }
}

/**
 * Create a typed storage interface with schema validation
 */
export function createTypedStorage<T>(key: string, schema: StorageSchema<T>) {
  return {
    get: (): T | null => secureGetItem(key, schema),
    set: (value: T): boolean => secureSetItem(key, value, schema),
    remove: (): boolean => secureRemoveItem(key),
    exists: (): boolean => {
      if (!isStorageAvailable()) return false;
      try {
        return localStorage.getItem(key) !== null;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Zod schema for range guesses (matches RangeGuess interface)
 */
export const rangeGuessSchema = z.object({
  start: z.number().int().min(-10000).max(3000),
  end: z.number().int().min(-10000).max(3000),
  hintsUsed: z.number().int().min(0).max(6),
  score: z.number().int().min(0),
  timestamp: z.number().int().positive(),
});

/**
 * Zod schema for anonymous game state
 * Now includes ranges for the range-based game mode
 */
export const anonymousGameStateSchema = z.object({
  puzzleId: z.string().min(1).max(100),
  guesses: z.array(z.number().int().min(-10000).max(3000)).max(6),
  ranges: z.array(rangeGuessSchema).max(6).optional(), // Range guesses for new game mode
  isComplete: z.boolean(),
  hasWon: z.boolean(),
  timestamp: z.number().int().positive(),
});

/**
 * Zod schema for theme preferences
 */
export const themePreferencesSchema = z.object({
  mode: z.enum(["light", "dark", "system"]),
  timestamp: z.number().int().positive().optional(),
});

/**
 * Schema for anonymous user streak data
 */
const anonymousStreakSchema = z.object({
  currentStreak: z.number().int().min(0).max(10000),
  lastCompletedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO date format YYYY-MM-DD
});

/**
 * Export pre-configured typed storage instances
 */
export const gameStateStorage = createTypedStorage("chrondle-game-state", anonymousGameStateSchema);

export const themeStorage = createTypedStorage("chrondle-theme", themePreferencesSchema);

export const anonymousStreakStorage = createTypedStorage(
  "chrondle-anonymous-streak",
  anonymousStreakSchema,
);
