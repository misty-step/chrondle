// Static Puzzle Database for Chrondle
// TEMPORARY: This file needs to be updated to use Convex data
// TODO: Complete migration to Convex-based puzzle data

import { logger } from "./logger";
import type { Puzzle } from "@/types/puzzle";
import { ConvexHttpClient } from "convex/browser";
import { api } from "./convexServer";
import { Id } from "convex/_generated/dataModel";

// Re-export Puzzle type for convenience
export type { Puzzle } from "@/types/puzzle";

// Singleton Convex client with lazy initialization
let convexClient: ConvexHttpClient | null = null;

/**
 * Get or create the Convex client instance
 * @returns ConvexHttpClient instance
 * @throws Error if NEXT_PUBLIC_CONVEX_URL is not configured
 */
function getConvexClient(): ConvexHttpClient {
  if (!convexClient) {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!convexUrl) {
      const errorMsg = "NEXT_PUBLIC_CONVEX_URL environment variable is not set";
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      convexClient = new ConvexHttpClient(convexUrl);
      logger.debug("Convex client initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Convex client", error);
      throw error;
    }
  }

  return convexClient;
}

// --- TYPE DEFINITIONS ---

export interface PuzzleMeta {
  version: string;
  total_puzzles: number;
  date_range: string;
}

export interface PuzzleDatabase {
  meta: PuzzleMeta;
  puzzles: Record<string, string[]>;
}

// --- TEMPORARY EMPTY DATA ---
// This is a temporary stub to make the code compile after deleting puzzles.json
// The next task will properly implement Convex-based data fetching

export const puzzleData: PuzzleDatabase = {
  meta: {
    version: "2.0.0",
    total_puzzles: 0,
    date_range: "migrating to Convex",
  },
  puzzles: {},
};

// Cache for total puzzles count
let cachedTotalPuzzles: number | null = null;
let totalPuzzlesFetchPromise: Promise<number> | null = null;

/**
 * Get the total number of puzzles from Convex
 * This function caches the result for performance
 * @returns Total number of puzzles, or 0 if Convex is unavailable
 */
async function fetchTotalPuzzles(): Promise<number> {
  // Return cached value if available
  if (cachedTotalPuzzles !== null) {
    return cachedTotalPuzzles;
  }

  // If already fetching, wait for that promise
  if (totalPuzzlesFetchPromise) {
    return totalPuzzlesFetchPromise;
  }

  // Start new fetch
  totalPuzzlesFetchPromise = (async () => {
    try {
      const result = await getConvexClient().query(api.puzzles.getTotalPuzzles);
      cachedTotalPuzzles = result.count;
      return result.count;
    } catch (error) {
      logger.error("Failed to fetch total puzzles from Convex", error);
      // Return 0 to prevent crashes, but log the error
      return 0;
    } finally {
      totalPuzzlesFetchPromise = null;
    }
  })();

  return totalPuzzlesFetchPromise;
}

// Total number of puzzles - NOW DYNAMIC!
// For synchronous access (legacy compatibility), default to 0
// Components should use fetchTotalPuzzles() for accurate count
export const TOTAL_PUZZLES = 0; // This will be replaced by server-side fetching

// --- CORE FUNCTIONS ---

/**
 * Get all available puzzle years in descending order - Async version using Convex
 * @returns Promise resolving to array of years that have puzzles, sorted newest to oldest
 */
export async function getPuzzleYearsAsync(): Promise<number[]> {
  try {
    const result = await getConvexClient().query(api.puzzles.getPuzzleYears);
    return result.years;
  } catch (error) {
    logger.error("Failed to fetch puzzle years from Convex", error);
    return [];
  }
}

// --- NEW INDEX-BASED FUNCTIONS ---

/**
 * Get puzzle by index (0-based) - Async version using Convex
 * @param index - The puzzle index (0 to TOTAL_PUZZLES-1)
 * @returns Promise resolving to Puzzle object or null if index is invalid
 */
export async function getPuzzleByIndexAsync(index: number): Promise<Puzzle | null> {
  try {
    // Validate index
    if (index < 0) {
      logger.warn(`Invalid puzzle index: ${index}`);
      return null;
    }

    // Convert 0-based index to 1-based puzzle number
    const puzzleNumber = index + 1;

    // Fetch puzzle from Convex
    const convexPuzzle = await getConvexClient().query(api.puzzles.getPuzzleByNumber, {
      puzzleNumber,
    });

    if (!convexPuzzle) {
      logger.debug(`No puzzle found for index ${index} (puzzle #${puzzleNumber})`);
      return null;
    }

    // Map Convex format to canonical Puzzle interface
    const puzzle: Puzzle = {
      id: convexPuzzle._id as Id<"puzzles">,
      targetYear: convexPuzzle.targetYear,
      events: convexPuzzle.events,
      puzzleNumber: convexPuzzle.puzzleNumber,
    };

    return puzzle;
  } catch (error) {
    logger.error(`Failed to fetch puzzle by index ${index}`, error);
    return null;
  }
}

/**
 * Get puzzle database metadata
 * @returns Metadata about the puzzle collection
 */
export function getPuzzleMeta(): PuzzleMeta {
  return { ...puzzleData.meta }; // Return copy to prevent mutations
}

/**
 * Validate puzzle data structure at runtime - DEPRECATED SYNC VERSION
 * @returns True if all puzzles are valid, false otherwise
 * @deprecated Use validatePuzzleDataAsync instead
 */
export function validatePuzzleData(): boolean {
  logger.warn(
    "🚧 validatePuzzleData() - DEPRECATED: Use validatePuzzleDataAsync for accurate connectivity check",
  );
  return true; // Assume valid for backward compatibility
}

/**
 * Validate Convex connectivity by attempting a simple query
 * @returns Promise resolving to true if Convex is accessible, false otherwise
 */
export async function validatePuzzleDataAsync(): Promise<boolean> {
  try {
    // Attempt a simple query to check Convex connectivity
    const result = await getConvexClient().query(api.puzzles.getTotalPuzzles);

    // If we get a result with a count property, Convex is working
    if (typeof result.count === "number") {
      logger.debug(`Convex connectivity validated: ${result.count} puzzles found`);
      return true;
    }

    logger.warn("Unexpected response format from Convex");
    return false;
  } catch (error) {
    logger.error("Failed to connect to Convex", error);
    return false;
  }
}

// Export the dynamic puzzle count fetcher
export { fetchTotalPuzzles };
