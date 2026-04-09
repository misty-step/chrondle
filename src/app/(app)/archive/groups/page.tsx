import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  CaretLeft,
  CaretRight,
  ClockCounterClockwise,
  Clock,
  GridFour,
} from "@phosphor-icons/react/dist/ssr";
import { ArchiveErrorBoundary } from "@/components/ArchiveErrorBoundary";
import { ArchiveGrid } from "@/components/archive/ArchiveGrid";
import { UserCreationHandler } from "@/components/UserCreationHandler";
import { LoadingShell } from "@/components/LoadingShell";
import { logger } from "@/lib/logger";
import {
  fetchArchiveGroupsPuzzles,
  fetchUserByClerkId,
  fetchUserCompletedGroupsPlays,
  getConvexClient,
} from "@/lib/convexServer";

interface PuzzleCardData {
  index: number;
  puzzleNumber: number;
  date?: string;
  firstHint: string;
  isCompleted: boolean;
}

interface ArchivePageProps {
  searchParams: Promise<{ page?: string }>;
}

function validatePageParam(pageParam: string | undefined): number {
  const DEFAULT_PAGE = 1;
  const MAX_PAGE = 10000;

  if (!pageParam) return DEFAULT_PAGE;
  const trimmed = pageParam.trim();
  if (!trimmed || !/^\+?\d+$/.test(trimmed)) return DEFAULT_PAGE;

  const parsed = parseInt(trimmed, 10);
  if (isNaN(parsed) || parsed < 1) return DEFAULT_PAGE;
  if (parsed > MAX_PAGE) return MAX_PAGE;

  return parsed;
}

async function GroupsArchivePageContent({
  searchParams,
}: ArchivePageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const currentPage = validatePageParam(params.page);
  const PUZZLES_PER_PAGE = 24 as const;

  const client = getConvexClient();
  if (!client) {
    logger.warn("[ArchiveGroupsPage] Convex client unavailable - missing NEXT_PUBLIC_CONVEX_URL");
    notFound();
  }

  let hasRequestContext = false;
  try {
    const headersList = await headers();
    hasRequestContext = !!headersList.get("cookie");
  } catch (error) {
    logger.warn("[GroupsArchive] Headers not available:", error);
  }

  let clerkUser = null;
  if (hasRequestContext) {
    try {
      clerkUser = await currentUser();
    } catch (error) {
      logger.error("[GroupsArchive] Clerk auth failed:", error);
    }
  }

  let convexUser = null;
  let completedPuzzleIds = new Set<string>();

  if (clerkUser) {
    try {
      convexUser = await fetchUserByClerkId(client, clerkUser.id);
    } catch (error) {
      logger.error("[GroupsArchive] getUserByClerkId failed:", error);
    }

    if (convexUser && convexUser._id) {
      try {
        const completedPlays = await fetchUserCompletedGroupsPlays(client, convexUser._id);
        const validPuzzleIds = (completedPlays || [])
          .map((play: { puzzleId: string }) => play.puzzleId)
          .filter(Boolean);
        completedPuzzleIds = new Set(validPuzzleIds);
      } catch (error) {
        logger.warn("[GroupsArchive] Completed plays fetch failed:", error);
      }
    }
  }

  let archiveData: { puzzles: any[]; totalPages: number; totalCount: number; currentPage: number } =
    {
      puzzles: [],
      totalPages: 0,
      totalCount: 0,
      currentPage: 1,
    };
  try {
    archiveData = await fetchArchiveGroupsPuzzles(client, currentPage, PUZZLES_PER_PAGE);
  } catch (error) {
    logger.error("[GroupsArchive] Failed to load puzzles:", error);
  }

  const { puzzles, totalPages, totalCount } = archiveData;
  const validPuzzles = Array.isArray(puzzles) ? puzzles : [];

  const paginatedData: PuzzleCardData[] = validPuzzles.map((puzzle: any) => ({
    index: (puzzle?.puzzleNumber || 1) - 1,
    puzzleNumber: puzzle?.puzzleNumber || 0,
    date: puzzle?.date,
    firstHint: puzzle?.board?.[0]?.text || "Groups puzzle",
    isCompleted: !!puzzle?._id && completedPuzzleIds.has(puzzle._id),
  }));

  const completedCount = completedPuzzleIds.size;

  const authState = {
    hasClerkUser: !!clerkUser,
    hasConvexUser: !!convexUser,
    completedCount,
    totalCount,
    environment: process.env.VERCEL_ENV || "local",
    timestamp: new Date().toISOString(),
  };

  return (
    <UserCreationHandler authState={authState}>
      <div className="bg-background flex min-h-screen flex-col">
        <AppHeader currentStreak={0} mode="groups" />

        <main className="mx-auto w-full max-w-2xl flex-grow px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-8">
            <h1 className="font-heading text-foreground mb-2 text-3xl font-bold text-balance sm:text-4xl">
              Groups Mode Archive
            </h1>
            <p className="text-muted-foreground text-lg">Explore and play past Groups puzzles</p>
          </div>

          <div className="mb-6 flex gap-2">
            <Link
              href="/archive"
              className="text-muted-foreground hover:text-foreground hover:bg-surface-inset flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors"
            >
              <ClockCounterClockwise className="h-4 w-4" /> Classic
            </Link>
            <Link
              href="/archive/order"
              className="text-muted-foreground hover:text-foreground hover:bg-surface-inset flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors"
            >
              <Clock className="h-4 w-4" /> Order
            </Link>
            <Link
              href="/archive/groups"
              className="bg-surface-inset text-foreground flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
            >
              <GridFour className="h-4 w-4" /> Groups
            </Link>
          </div>

          {clerkUser && (
            <div className="mb-6" suppressHydrationWarning>
              {convexUser ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">Completed:</span>
                      <span className="text-foreground font-mono font-semibold tabular-nums">
                        {completedCount} of {totalCount}
                      </span>
                    </div>
                    <span className="font-mono font-semibold tabular-nums">
                      {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
                    </span>
                  </div>
                  <div className="bg-surface-inset h-2 w-full overflow-hidden rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]">
                    <div
                      className="h-full rounded-full bg-slate-700 transition-all duration-300 ease-out dark:bg-slate-300"
                      style={{
                        width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : "0%",
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="animate-pulse">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="bg-muted h-5 w-32 rounded" />
                    <div className="bg-muted h-4 w-12 rounded" />
                  </div>
                  <div className="bg-muted border-outline-default/30 h-2 w-full rounded border" />
                </div>
              )}
            </div>
          )}

          {validPuzzles.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No puzzles available yet. Check back soon!</p>
            </div>
          ) : (
            <>
              <ArchiveGrid puzzles={paginatedData} mode="groups" linkPrefix="/archive/groups" />

              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  {currentPage > 1 ? (
                    <Link href={`/archive/groups?page=${currentPage - 1}`}>
                      <Button
                        variant="outline"
                        size="default"
                        className="h-10 w-10 rounded-full p-0 sm:h-8 sm:w-8"
                      >
                        <CaretLeft className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant="outline"
                      size="default"
                      disabled
                      className="h-10 w-10 rounded-full p-0 sm:h-8 sm:w-8"
                    >
                      <CaretLeft className="h-4 w-4" />
                    </Button>
                  )}

                  <span className="text-muted-foreground px-2 font-mono text-sm tabular-nums sm:px-4">
                    Page {currentPage} of {totalPages}
                  </span>

                  {currentPage < totalPages ? (
                    <Link href={`/archive/groups?page=${currentPage + 1}`}>
                      <Button
                        variant="outline"
                        size="default"
                        className="h-10 w-10 rounded-full p-0 sm:h-8 sm:w-8"
                      >
                        <CaretRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant="outline"
                      size="default"
                      disabled
                      className="h-10 w-10 rounded-full p-0 sm:h-8 sm:w-8"
                    >
                      <CaretRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </main>
        <Footer />
      </div>
    </UserCreationHandler>
  );
}

export default function GroupsArchivePage({ searchParams }: ArchivePageProps): React.ReactElement {
  return (
    <ArchiveErrorBoundary>
      <React.Suspense
        fallback={
          <LoadingShell
            intent="generic"
            stage="loading_puzzle"
            message="Opening the Groups archive"
            subMessage="Preparing grouped records"
          />
        }
      >
        <GroupsArchivePageContent searchParams={searchParams} />
      </React.Suspense>
    </ArchiveErrorBoundary>
  );
}
