import { ConvexHttpClient } from "convex/browser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { OrderPuzzle } from "@/types/orderGameState";
import type { Puzzle } from "@/types/puzzle";

export { api };

export function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
