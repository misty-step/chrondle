import { ConvexHttpClient } from "convex/browser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { OrderPuzzle } from "@/types/orderGameState";
import type { Puzzle } from "@/types/puzzle";

export { api };

/**
 * Get Convex client, returning null if not configured.
 * Use this for pages that can gracefully degrade without Convex.
 */
export function getConvexClient(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    // Return null instead of throwing - allows pages to handle missing env var gracefully
    return null;
  }
  return new ConvexHttpClient(url);
}

/**
 * Get Convex client, throwing if not configured.
 * Use this for API routes where Convex is required.
 */
export function requireConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL not configured");
  }
  return new ConvexHttpClient(url);
}

export async function fetchOrderPuzzleByNumber(
  client: ConvexHttpClient,
  puzzleNumber: number,
): Promise<OrderPuzzle | null> {
  const convexPuzzle = await client.query(api.orderPuzzles.getOrderPuzzleByNumber, {
    puzzleNumber,
  });
  if (!convexPuzzle) return null;

  return {
    id: convexPuzzle._id as Id<"orderPuzzles">,
    date: convexPuzzle.date,
    puzzleNumber: convexPuzzle.puzzleNumber,
    seed: convexPuzzle.seed,

    events: convexPuzzle.events.map((event: any) => ({
      id: event.id,
      year: event.year,
      text: event.text,
    })),
  };
}

export async function fetchClassicPuzzleByNumber(
  client: ConvexHttpClient,
  puzzleNumber: number,
): Promise<Puzzle | null> {
  const puzzle = await client.query(api.puzzles.getPuzzleByNumber, { puzzleNumber });
  if (!puzzle) return null;

  return {
    ...puzzle,
    id: puzzle._id as Id<"puzzles">,
    puzzleNumber: puzzle.puzzleNumber,
  };
}
