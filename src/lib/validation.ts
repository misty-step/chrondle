/**
 * Validation utilities for Convex database IDs and other data types
 */

import type { Id } from "../../convex/_generated/dataModel";
import { logger } from "@/lib/logger";

/**
 * Regular expression for validating Convex ID format
 * Convex IDs are 32 character lowercase alphanumeric strings
 */
const CONVEX_ID_REGEX = /^[a-z0-9]{32}$/;

/**
 * Type representing any valid Convex table name
 */
type TableNames = "users" | "puzzles" | "plays" | "events" | "orderPuzzles" | "orderPlays";

/**
 * Custom error class for Convex ID validation failures
 */
export class ConvexIdValidationError extends Error {
  constructor(
    message: string,
    public readonly id: string,
    public readonly type: string,
  ) {
    super(message);
    this.name = "ConvexIdValidationError";
  }
}

/**
 * Validates if a string matches the Convex ID format
 *
 * @param id - The string to validate
 * @returns true if the string matches Convex ID format (32 lowercase alphanumeric chars)
 *
 * @example
 * ```typescript
 * const clerkId = "user_2gFqK5X7B8hM9nL0P3rT6vY1dZ4w";
 * const convexId = "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0a";
 *
 * isValidConvexId(clerkId); // false - wrong format
 * isValidConvexId(convexId); // true - correct format
 * isValidConvexId(""); // false - empty string
 * isValidConvexId(null); // false - null
 * ```
 */
export function isValidConvexId(id: unknown): boolean {
  if (typeof id !== "string") {
    return false;
  }
  return CONVEX_ID_REGEX.test(id);
}

/**
 * Asserts that a string is a valid Convex ID and returns it with proper typing
 * Throws ConvexIdValidationError if the ID is invalid
 *
 * @param id - The string to validate and cast
 * @param type - The table type for error messages (e.g., "users", "puzzles")
 * @returns The ID cast to the appropriate Convex Id type
 * @throws {ConvexIdValidationError} If the ID format is invalid
 *
 * @example
 * ```typescript
 * try {
 *   const userId = assertConvexId(someId, "users");
 *   // userId is now typed as Id<"users">
 *   await ctx.db.get(userId);
 * } catch (error) {
 *   if (error instanceof ConvexIdValidationError) {
 *     logger.error(`Invalid ${error.type} ID: ${error.id}`);
 *   }
 * }
 * ```
 */
export function assertConvexId<T extends TableNames>(id: string, type: T): Id<T> {
  if (!isValidConvexId(id)) {
    throw new ConvexIdValidationError(
      `Invalid ${type} ID format: expected 32 lowercase alphanumeric characters, got "${id}"`,
      id,
      type,
    );
  }
  return id as Id<T>;
}

/**
 * Safely casts a string to a Convex ID, returning null if invalid
 * This is useful for optional IDs or when you want to handle invalid IDs gracefully
 *
 * @param id - The string to validate and cast (can be null)
 * @param type - The table type for logging (e.g., "users", "puzzles")
 * @returns The ID cast to the appropriate Convex Id type, or null if invalid
 *
 * @example
 * ```typescript
 * const userId = safeConvexId(maybeUserId, "users");
 * if (userId) {
 *   // userId is typed as Id<"users">
 *   const user = await ctx.db.get(userId);
 * } else {
 *   // Handle missing or invalid user ID
 *   logger.debug("No valid user ID available");
 * }
 * ```
 */
export function safeConvexId<T extends TableNames>(
  id: string | null | undefined,
  type: T,
): Id<T> | null {
  if (id === null || id === undefined) {
    return null;
  }

  if (!isValidConvexId(id)) {
    if (process.env.NODE_ENV === "development") {
      logger.warn(
        `[safeConvexId] Invalid ${type} ID format detected:`,
        id,
        "Expected 32-character lowercase alphanumeric Convex ID",
      );
    }
    return null;
  }

  return id as Id<T>;
}

/**
 * Validates multiple Convex IDs at once
 * Useful for batch operations or when multiple IDs need to be validated together
 *
 * @param ids - Object mapping field names to IDs to validate
 * @returns Object with validation results for each field
 *
 * @example
 * ```typescript
 * const validation = validateConvexIds({
 *   userId: someUserId,
 *   puzzleId: somePuzzleId,
 *   playId: somePlayId
 * });
 *
 * if (validation.allValid) {
 *   // All IDs are valid
 * } else {
 *   logger.error("Invalid IDs:", validation.invalid);
 * }
 * ```
 */
export function validateConvexIds(ids: Record<string, string | null | undefined>): {
  allValid: boolean;
  valid: string[];
  invalid: string[];
  results: Record<string, boolean>;
} {
  const results: Record<string, boolean> = {};
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const [key, id] of Object.entries(ids)) {
    const isValid = id !== null && id !== undefined && isValidConvexId(id);
    results[key] = isValid;

    if (isValid) {
      valid.push(key);
    } else {
      invalid.push(key);
    }
  }

  return {
    allValid: invalid.length === 0,
    valid,
    invalid,
    results,
  };
}

/**
 * Type guard to check if an error is a ConvexIdValidationError
 *
 * @param error - The error to check
 * @returns true if the error is a ConvexIdValidationError
 *
 * @example
 * ```typescript
 * try {
 *   const id = assertConvexId(someId, "users");
 * } catch (error) {
 *   if (isConvexIdValidationError(error)) {
 *     // Handle validation error specifically
 *     logger.warn(`ID validation failed for ${error.type}: ${error.id}`);
 *   } else {
 *     // Handle other errors
 *     throw error;
 *   }
 * }
 * ```
 */
export function isConvexIdValidationError(error: unknown): error is ConvexIdValidationError {
  return error instanceof ConvexIdValidationError;
}

/**
 * Extracts table type from a Convex ID type
 * This is a utility type helper for TypeScript
 *
 * @example
 * ```typescript
 * type UserIdTable = ExtractTable<Id<"users">>; // "users"
 * type PuzzleIdTable = ExtractTable<Id<"puzzles">>; // "puzzles"
 * ```
 */
export type ExtractTable<T> = T extends Id<infer Table> ? Table : never;
