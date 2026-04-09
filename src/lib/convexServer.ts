import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import type { Id } from "convex/_generated/dataModel";
import type { OrderPuzzle } from "@/types/orderGameState";
import type { Puzzle } from "@/types/puzzle";

const serverApi = anyApi as any;
export const api = serverApi;

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

export async function fetchUserByClerkId(client: ConvexHttpClient, clerkId: string) {
  return await client.query(serverApi.users.getUserByClerkId, { clerkId });
}

export async function fetchHasArchiveAccess(client: ConvexHttpClient, clerkId: string) {
  return await client.query(serverApi.users.hasArchiveAccess, { clerkId });
}

export async function fetchOrderPuzzleByNumber(
  client: ConvexHttpClient,
  puzzleNumber: number,
): Promise<OrderPuzzle | null> {
  const convexPuzzle = await client.query(serverApi.orderPuzzles.getOrderPuzzleByNumber, {
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
  const puzzle = await client.query(serverApi.puzzles.getPuzzleByNumber, { puzzleNumber });
  if (!puzzle) return null;

  return {
    ...puzzle,
    id: puzzle._id as Id<"puzzles">,
    puzzleNumber: puzzle.puzzleNumber,
  };
}

export interface GroupsPuzzle {
  id: Id<"groupsPuzzles">;
  date: string;
  puzzleNumber: number;
  board: Array<{
    id: string;
    text: string;
  }>;
  groups: Array<{
    id: string;
    year: number;
    tier: "easy" | "medium" | "hard" | "very hard";
    eventIds: string[];
  }>;
  seed: string;
}

export async function fetchGroupsPuzzleByNumber(
  client: ConvexHttpClient,
  puzzleNumber: number,
): Promise<GroupsPuzzle | null> {
  const convexPuzzle = await client.query(serverApi.groupsPuzzles.getGroupsPuzzleByNumber, {
    puzzleNumber,
  });
  if (!convexPuzzle) return null;

  return {
    id: convexPuzzle._id as Id<"groupsPuzzles">,
    date: convexPuzzle.date,
    puzzleNumber: convexPuzzle.puzzleNumber,
    board: convexPuzzle.board.map((card: { id: string; text: string }) => ({
      id: card.id,
      text: card.text,
    })),
    groups: convexPuzzle.groups.map(
      (group: {
        id: string;
        year: number;
        tier: "easy" | "medium" | "hard" | "very hard";
        eventIds: string[];
      }) => ({
        id: group.id,
        year: group.year,
        tier: group.tier,
        eventIds: group.eventIds,
      }),
    ),
    seed: convexPuzzle.seed,
  };
}

export async function fetchArchiveGroupsPuzzles(
  client: ConvexHttpClient,
  page: number,
  pageSize: number,
) {
  return await client.query(serverApi.groupsPuzzles.getArchiveGroupsPuzzles, {
    page,
    pageSize,
  });
}

export async function fetchUserCompletedGroupsPlays(client: ConvexHttpClient, userId: Id<"users">) {
  return await client.query(serverApi.groupsPlays.getUserCompletedGroupsPlays, {
    userId,
  });
}
