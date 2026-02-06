import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, History, BarChart } from "lucide-react";
import { ArchiveErrorBoundary } from "@/components/ArchiveErrorBoundary";
import { ArchiveGrid } from "@/components/archive/ArchiveGrid";
import { UserCreationHandler } from "@/components/UserCreationHandler";
import { LoadingShell } from "@/components/LoadingShell";
import { logger } from "@/lib/logger";
import { api, getConvexClient } from "@/lib/convexServer";

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

// Sanitize and validate page parameter
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

async function OrderArchivePageContent({
  searchParams,
}: ArchivePageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const currentPage = validatePageParam(params.page);
  const PUZZLES_PER_PAGE = 24 as const;

  const client = getConvexClient();

  // If Convex client unavailable (missing env var), let client-side handle it
  if (!client) {
    logger.warn("[ArchiveOrderPage] Convex client unavailable - missing NEXT_PUBLIC_CONVEX_URL");
    notFound();
  }

  let hasRequestContext = false;
  try {
    const headersList = await headers();
    hasRequestContext = !!headersList.get("cookie");
  } catch (error) {
    logger.warn("[OrderArchive] Headers not available:", error);
  }

  let clerkUser = null;
  if (hasRequestContext) {
    try {
      clerkUser = await currentUser();
    } catch (error) {
      logger.error("[OrderArchive] Clerk auth failed:", error);
    }
  }

  let convexUser = null;
  let completedPuzzleIds = new Set<string>();

  if (clerkUser) {
    try {
      convexUser = await client.query(api.users.getUserByClerkId, { clerkId: clerkUser.id });
    } catch (error) {
      logger.error("[OrderArchive] getUserByClerkId failed:", error);
    }

    if (convexUser && convexUser._id) {
      try {
        const completedPlays = await client.query(api.orderPlays.getUserCompletedOrderPlays, {
          userId: convexUser._id,
        });
        const validPuzzleIds = (completedPlays || [])
          .map((play: { puzzleId: string }) => play.puzzleId)
          .filter(Boolean);
        completedPuzzleIds = new Set(validPuzzleIds);
      } catch (error) {
        logger.warn("[OrderArchive] Completed plays fetch failed:", error);
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
    archiveData = await client.query(api.orderPuzzles.getArchiveOrderPuzzles, {
      page: currentPage,
      pageSize: PUZZLES_PER_PAGE,
    });
  } catch (error) {
    logger.error("[OrderArchive] Failed to load puzzles:", error);
  }

  const { puzzles, totalPages, totalCount } = archiveData;
  const validPuzzles = Array.isArray(puzzles) ? puzzles : [];

  const paginatedData: PuzzleCardData[] = validPuzzles.map((puzzle: any) => ({
    index: (puzzle?.puzzleNumber || 1) - 1,
    puzzleNumber: puzzle?.puzzleNumber || 0,
    date: puzzle?.date,
    firstHint: (puzzle?.events && puzzle.events[0]?.text) || "Historical event puzzle",
    isCompleted: !!puzzle?._id && completedPuzzleIds.has(puzzle._id),
  }));

  const completedCount = completedPuzzleIds.size;

  // Check archive access (subscription status)
  let hasArchiveAccess = false;
  if (clerkUser && convexUser) {
    try {
      hasArchiveAccess = await client.query(api.users.hasArchiveAccess, {
        clerkId: clerkUser.id,
      });
    } catch (error) {
      logger.warn("[OrderArchive] hasArchiveAccess check failed:", error);
      hasArchiveAccess = false;
    }
  }

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
        <AppHeader currentStreak={0} />

        <main className="mx-auto w-full max-w-2xl flex-grow px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-8">
            <h1 className="font-heading text-foreground mb-2 text-3xl font-bold sm:text-4xl">
              Order Mode Archive
            </h1>
            <p className="text-muted-foreground text-lg">Explore and play past Order puzzles</p>
          </div>

          {/* Navigation */}
          <div className="mb-6 flex gap-2 border-b">
            <Link
              href="/archive"
              className="text-muted-foreground hover:text-foreground flex items-center gap-2 border-b-2 border-transparent px-3 py-2 transition-colors hover:border-gray-300"
            >
              <History className="h-4 w-4" /> Classic
            </Link>
            <Link
              href="/archive/order"
              className="border-primary text-body-primary flex items-center gap-2 border-b-2 px-3 py-2 font-semibold"
            >
              <BarChart className="h-4 w-4" /> Order
            </Link>
          </div>

          {clerkUser && (
            <div className="mb-6" suppressHydrationWarning>
              {convexUser ? (
                // Show actual completion data
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-foreground font-medium">
                      Completed: {completedCount} of {totalCount}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
                    </span>
                  </div>
                  <div className="bg-muted border-outline-default/30 h-3 w-full overflow-hidden rounded border">
                    <div
                      className="h-full bg-green-600 transition-all duration-300 ease-out"
                      style={{
                        width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : "0%",
                      }}
                    />
                  </div>
                </div>
              ) : (
                // Show skeleton loader while user data loads
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
              {/* Archive grid - filters by local date to hide future puzzles */}
              <ArchiveGrid
                puzzles={paginatedData}
                linkPrefix="/archive/order"
                hasAccess={hasArchiveAccess}
              />

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  {currentPage > 1 ? (
                    <Link href={`/archive/order?page=${currentPage - 1}`}>
                      <Button
                        variant="outline"
                        size="default"
                        className="h-10 w-10 p-0 sm:h-8 sm:w-8"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant="outline"
                      size="default"
                      disabled
                      className="h-10 w-10 p-0 sm:h-8 sm:w-8"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  )}

                  <span className="text-muted-foreground px-2 text-sm sm:px-4">
                    Page {currentPage} of {totalPages}
                  </span>

                  {currentPage < totalPages ? (
                    <Link href={`/archive/order?page=${currentPage + 1}`}>
                      <Button
                        variant="outline"
                        size="default"
                        className="h-10 w-10 p-0 sm:h-8 sm:w-8"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant="outline"
                      size="default"
                      disabled
                      className="h-10 w-10 p-0 sm:h-8 sm:w-8"
                    >
                      <ChevronRight className="h-4 w-4" />
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

export default function OrderArchivePage({ searchParams }: ArchivePageProps): React.ReactElement {
  return (
    <ArchiveErrorBoundary>
      <React.Suspense
        fallback={
          <LoadingShell
            intent="order"
            stage="loading_puzzle"
            message="Opening the timeline archive"
            subMessage="Preparing chronological records"
          />
        }
      >
        <OrderArchivePageContent searchParams={searchParams} />
      </React.Suspense>
    </ArchiveErrorBoundary>
  );
}
