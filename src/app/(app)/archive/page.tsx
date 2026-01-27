import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, getConvexClient } from "@/lib/convexServer";
import { currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, History, BarChart } from "lucide-react";
import { ArchiveErrorBoundary } from "@/components/ArchiveErrorBoundary";
import { ArchiveGrid } from "@/components/archive/ArchiveGrid";
import { UserCreationHandler } from "@/components/UserCreationHandler";
import { LoadingShell } from "@/components/LoadingShell";
import { logger } from "@/lib/logger";

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
  const MAX_PAGE = 10000; // Reasonable upper limit

  if (!pageParam) return DEFAULT_PAGE;

  // Trim whitespace
  const trimmed = pageParam.trim();
  if (!trimmed) return DEFAULT_PAGE;

  // Reject if contains non-digit characters (except leading +)
  // This prevents "12abc", "1e10", etc.
  if (!/^\+?\d+$/.test(trimmed)) return DEFAULT_PAGE;

  // Parse as integer
  const parsed = parseInt(trimmed, 10);

  // Check for NaN, negative, or unreasonably large values
  if (isNaN(parsed) || parsed < 1) return DEFAULT_PAGE;
  if (parsed > MAX_PAGE) return MAX_PAGE;

  return parsed;
}

async function ArchivePageContent({ searchParams }: ArchivePageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const currentPage = validatePageParam(params.page);
  const PUZZLES_PER_PAGE = 24 as const;

  // Runtime environment detection for debugging
  const environment = process.env.VERCEL_ENV || "local";
  // Debug: Running in environment

  // Initialize Convex client
  const client = getConvexClient();

  // If Convex client unavailable (missing env var), let client-side handle it
  if (!client) {
    logger.warn("[ArchiveClassicPage] Convex client unavailable - missing NEXT_PUBLIC_CONVEX_URL");
    notFound();
  }

  // Performance timing

  // Request context validation
  let hasRequestContext = false;
  try {
    const headersList = await headers();
    const cookies = headersList.get("cookie");
    hasRequestContext = !!cookies;
    // Debug: Request context with cookies
  } catch (error) {
    logger.warn("[Archive] Headers not available (SSG/ISR context):", error);
  }

  // Get current user from Clerk - comprehensive error handling
  let clerkUser = null;
  try {
    // TEST: Force error before auth call
    // throw new Error("TEST: Forced error before auth");

    // Skip auth if no request context (SSG/ISR)
    if (!hasRequestContext) {
      // Debug: Skipping auth - no request context
    } else {
      clerkUser = await currentUser();
      // Debug: Clerk auth successful
    }
  } catch (error) {
    // Comprehensive error logging for production debugging
    logger.error("[Archive] Clerk auth failed:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      environment,
      hasRequestContext,
    });
    // Explicitly set to null on ANY error
    clerkUser = null;
    // Archive is publicly accessible, continue without auth
  }

  // Auth check complete

  // Fetch user data and completed puzzles if authenticated
  // Start Convex queries
  let convexUser = null;
  let completedPuzzleIds = new Set<string>();

  if (clerkUser) {
    // Get the Convex user by Clerk ID with defensive error handling
    try {
      convexUser = await client.query(api.users.getUserByClerkId, {
        clerkId: clerkUser.id,
      });
    } catch (error) {
      logger.error("[Archive] getUserByClerkId failed:", error);
      // Continue with null user - don't cascade failure
      convexUser = null;
    }

    // Only fetch completed puzzles if we have a valid Convex user
    if (convexUser && convexUser._id) {
      try {
        // Get user's completed puzzles with error handling
        const completedPlays = await client.query(api.puzzles.getUserCompletedPuzzles, {
          userId: convexUser._id,
        });

        // Defensive validation of completed plays data
        if (!Array.isArray(completedPlays)) {
          logger.warn("[Archive] Invalid completedPlays data:", completedPlays);
          completedPuzzleIds = new Set();
        } else {
          // Create a set of completed puzzle IDs with robust null checking
          const validPuzzleIds = completedPlays
            .filter((play, index) => {
              // Validate play record structure
              if (!play || typeof play !== "object") {
                logger.warn(`[Archive] Invalid play record at index ${index}:`, play);
                return false;
              }

              // Validate puzzleId exists and is truthy
              if (!play.puzzleId) {
                logger.warn(`[Archive] Play record at index ${index} missing puzzleId:`, {
                  play,
                  hasCompletedAt: !!play.completedAt,
                  hasUserId: !!play.userId,
                  playKeys: Object.keys(play),
                });
                return false;
              }

              // Additional type validation - ensure puzzleId looks like a Convex ID
              if (typeof play.puzzleId !== "string" || play.puzzleId.length === 0) {
                logger.warn(`[Archive] Play record at index ${index} has invalid puzzleId type:`, {
                  puzzleId: play.puzzleId,
                  puzzleIdType: typeof play.puzzleId,
                  play,
                });
                return false;
              }

              return true;
            })
            .map((play) => play.puzzleId);

          completedPuzzleIds = new Set(validPuzzleIds);

          // Enhanced debug logging
          // Debug: Completed puzzles loaded
        }
      } catch (error) {
        logger.warn("[Archive] Completed puzzles fetch failed, using empty set:", error);
        // Fallback to empty set - user won't see completion status
        completedPuzzleIds = new Set();
      }
    }
  }
  // Convex queries complete

  // Check archive access (subscription status)
  let hasArchiveAccess = false;
  if (clerkUser && convexUser) {
    try {
      hasArchiveAccess = await client.query(api.users.hasArchiveAccess, {
        clerkId: clerkUser.id,
      });
    } catch (error) {
      logger.warn("[Archive] hasArchiveAccess check failed:", error);
      hasArchiveAccess = false;
    }
  }

  // Fetch archive puzzles from Convex with graceful degradation
  let archiveData: {
    puzzles: any[]; // Will be properly typed from Convex
    totalPages: number;
    totalCount: number;
    currentPage: number;
  } = {
    puzzles: [],
    totalPages: 0,
    totalCount: 0,
    currentPage: 1,
  };

  try {
    archiveData = await client.query(api.puzzles.getArchivePuzzles, {
      page: currentPage,
      pageSize: PUZZLES_PER_PAGE,
    });
    // Debug: Puzzles loaded
  } catch (error) {
    logger.error("[Archive] Failed to load puzzles:", error);
    // Return graceful fallback - archive temporarily unavailable
    // The UI will show appropriate message based on empty data
  }

  const { puzzles, totalPages, totalCount } = archiveData;

  // Validate puzzles data with fallback
  const validPuzzles = Array.isArray(puzzles) ? puzzles : [];
  if (!Array.isArray(puzzles)) {
    logger.warn("[Archive] Invalid puzzles data received:", puzzles);
  }

  // Transform Convex puzzles to PuzzleCardData format
  // ID FORMAT CONSISTENCY: completedPuzzleIds contains play.puzzleId values (Convex IDs)
  // which should match puzzle._id values (also Convex IDs) for proper completion detection
  const paginatedData: PuzzleCardData[] = validPuzzles.map((puzzle) => {
    // Defensive completion checking with robust null handling
    let isCompleted = false;

    if (!puzzle) {
      logger.warn("[Archive] Invalid puzzle object:", puzzle);
    } else if (!puzzle._id) {
      logger.warn("[Archive] Puzzle missing _id field:", puzzle);
    } else {
      // Safe completion check
      isCompleted = completedPuzzleIds.has(puzzle._id);
    }

    // Enhanced debug logging for first few puzzles
    if (puzzle && puzzle.puzzleNumber <= 3) {
      // Debug: Puzzle completion check
    }

    // Safely construct puzzle card data with fallbacks
    return {
      index: (puzzle?.puzzleNumber || 1) - 1, // 0-based index for compatibility
      puzzleNumber: puzzle?.puzzleNumber || 0,
      date: puzzle?.date,
      firstHint: (puzzle?.events && puzzle.events[0]) || "Historical event puzzle",
      isCompleted,
    };
  });

  // Calculate completed count
  const completedCount = completedPuzzleIds.size;

  // Auth state telemetry for debugging
  const authState = {
    hasClerkUser: !!clerkUser,
    hasConvexUser: !!convexUser,
    completedCount,
    totalCount,
    environment,
    timestamp: new Date().toISOString(),
  };

  return (
    <UserCreationHandler authState={authState}>
      <div className="bg-background flex min-h-screen flex-col">
        <AppHeader currentStreak={0} />

        <main className="mx-auto w-full max-w-2xl flex-grow px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-8">
            <h1 className="font-heading text-foreground mb-2 text-3xl font-bold sm:text-4xl">
              Puzzle Archive
            </h1>
            <p className="text-muted-foreground text-lg">Explore and play past Chrondle puzzles</p>
          </div>

          {/* Navigation */}
          <div className="mb-6 flex gap-2 border-b">
            <Link
              href="/archive"
              className="border-primary text-body-primary flex items-center gap-2 border-b-2 px-3 py-2 font-semibold"
            >
              <History className="h-4 w-4" /> Classic
            </Link>
            <Link
              href="/archive/order"
              className="text-muted-foreground hover:text-foreground flex items-center gap-2 border-b-2 border-transparent px-3 py-2 transition-colors hover:border-gray-300"
            >
              <BarChart className="h-4 w-4" /> Order
            </Link>
          </div>

          {/* Completion Statistics - Show loading state or data */}
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
                  <div className="bg-muted border-outline-default/30 h-3 w-full overflow-hidden rounded-sm border">
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
                    <div className="bg-muted h-5 w-32 rounded-sm" />
                    <div className="bg-muted h-4 w-12 rounded-sm" />
                  </div>
                  <div className="bg-muted border-outline-default/30 h-2 w-full rounded-sm border" />
                </div>
              )}
            </div>
          )}

          {/* Archive grid */}
          {archiveData.puzzles.length === 0 && totalCount === 0 ? (
            // Empty archive or connection issue
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                {archiveData.currentPage === 1
                  ? "Archive temporarily unavailable. Please try again later."
                  : "No puzzles available yet. Check back tomorrow!"}
              </p>
            </div>
          ) : paginatedData.length === 0 ? (
            // Loading skeleton cards
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(Math.min(totalCount, PUZZLES_PER_PAGE))].map((_, i) => (
                <Card
                  key={i}
                  className="flex h-36 animate-pulse flex-col gap-2 p-3 sm:h-[10rem] sm:p-4"
                >
                  <div className="bg-muted h-5 w-12 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="bg-muted h-3 w-full rounded" />
                    <div className="bg-muted h-3 w-4/5 rounded" />
                    <div className="bg-muted h-3 w-3/5 rounded" />
                  </div>
                  <div className="bg-muted mt-auto h-3 w-20 rounded" />
                </Card>
              ))}
            </div>
          ) : (
            <>
              {/* Archive grid - filters by local date to hide future puzzles */}
              <ArchiveGrid puzzles={paginatedData} hasAccess={hasArchiveAccess} />

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  {currentPage > 1 ? (
                    <Link href={`/archive?page=${currentPage - 1}`}>
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
                    <Link href={`/archive?page=${currentPage + 1}`}>
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

export default function ArchivePage({ searchParams }: ArchivePageProps): React.ReactElement {
  return (
    <ArchiveErrorBoundary>
      <React.Suspense
        fallback={
          <LoadingShell
            intent="classic"
            stage="loading_puzzle"
            message="Opening the archive"
            subMessage="Retrieving historical records"
          />
        }
      >
        <ArchivePageContent searchParams={searchParams} />
      </React.Suspense>
    </ArchiveErrorBoundary>
  );
}
