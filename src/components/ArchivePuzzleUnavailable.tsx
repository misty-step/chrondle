"use client";

import Link from "next/link";
import { BACKEND_UNREACHABLE_ERROR } from "@/lib/errorRecovery";

interface ArchivePuzzleUnavailableProps {
  puzzleNumber: number;
  /** Load error from the game state; "not found" errors render the not-found copy */
  error: string;
  /** Archive index to return to */
  archiveHref: string;
}

/**
 * Terminal state for an archive puzzle that failed to load.
 * A missing puzzle gets a not-found message; anything else offers a reload.
 */
export function ArchivePuzzleUnavailable({
  puzzleNumber,
  error,
  archiveHref,
}: ArchivePuzzleUnavailableProps) {
  const isNotFound = /not found/i.test(error);
  const isUnreachable = error === BACKEND_UNREACHABLE_ERROR;

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div
        role="alert"
        className="bg-card w-full max-w-md rounded border p-6 text-center shadow-lg"
      >
        <h1 className="text-foreground mb-2 text-xl font-bold">
          {isNotFound
            ? `Puzzle #${puzzleNumber} doesn't exist`
            : `Couldn't load puzzle #${puzzleNumber}`}
        </h1>
        <p className="text-muted-foreground mb-6">
          {isNotFound
            ? "There's no puzzle with that number. Pick one from the archive."
            : isUnreachable
              ? BACKEND_UNREACHABLE_ERROR
              : "Something went wrong while loading this puzzle. Please try again."}
        </p>
        <div className="flex flex-col gap-3">
          {!isNotFound && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-4 py-2 transition-colors"
            >
              Try again
            </button>
          )}
          <Link
            href={archiveHref}
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            ← Back to Archive
          </Link>
        </div>
      </div>
    </div>
  );
}
