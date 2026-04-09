"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { GameModeLayout } from "@/components/GameModeLayout";
import { LayoutContainer } from "@/components/LayoutContainer";
import { LoadingScreen } from "@/components/LoadingScreen";
import { LoadErrorState } from "@/components/LoadErrorState";
import { GroupsBoard } from "@/components/groups/GroupsBoard";
import { GroupsReveal } from "@/components/groups/GroupsReveal";
import { useGroupsGame } from "@/hooks/useGroupsGame";
import { useToast } from "@/hooks/use-toast";
import { useWebShare } from "@/hooks/useWebShare";
import { useLoadErrorRecovery } from "@/hooks/useLoadErrorRecovery";

interface GroupsGameViewProps {
  puzzleNumber?: number;
  initialPuzzle?: unknown;
  isArchive?: boolean;
  backHref?: string;
  backLabel?: string;
}

export function GroupsGameView({
  puzzleNumber,
  initialPuzzle,
  isArchive = false,
  backHref,
  backLabel,
}: GroupsGameViewProps) {
  const { addToast } = useToast();
  const { share, shareMethod } = useWebShare();
  const {
    gameState,
    toggleSelection,
    clearSelection,
    shuffleBoard,
    submitSelection,
    isSubmitting,
    lastError,
  } = useGroupsGame(puzzleNumber, initialPuzzle, addToast);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const retryLoad = useCallback(() => {
    window.location.reload();
  }, []);

  const recovery = useLoadErrorRecovery({
    error: gameState.status === "error" ? gameState.error : null,
    onRetry: retryLoad,
    maxAutoRetries: 0,
  });

  if (gameState.status === "loading-puzzle") {
    return (
      <LoadingScreen
        intent="generic"
        stage="fetching"
        message={isArchive ? "Loading Groups archive puzzle..." : "Loading Groups puzzle..."}
        subMessage={isArchive ? "Fetching archived event board" : "Fetching today's event board"}
      />
    );
  }

  if (gameState.status === "loading-auth" || gameState.status === "loading-progress") {
    return (
      <LoadingScreen
        intent="generic"
        stage="hydrating"
        message={
          isArchive
            ? "Preparing your archive Groups session..."
            : "Preparing your Groups session..."
        }
        subMessage="Restoring revealed groups and recent guesses"
      />
    );
  }

  if (gameState.status === "error") {
    return (
      <LoadErrorState
        title="Something went wrong"
        message={gameState.error}
        recoverability={recovery.recoverability}
        onRetry={retryLoad}
      />
    );
  }

  if (gameState.status === "completed") {
    const handleShare = async () => {
      const success = await share(buildShareText(gameState));
      if (success) {
        setShareFeedback(shareMethod === "webshare" ? "Shared!" : "Copied to clipboard!");
      } else {
        setShareFeedback("Share failed. Try again.");
      }
    };

    return (
      <GameModeLayout
        mode="groups"
        puzzleNumber={gameState.puzzle.puzzleNumber}
        puzzleDate={gameState.puzzle.date}
        isArchive={isArchive}
      >
        <LayoutContainer className="flex max-w-5xl flex-col gap-6">
          {backHref && backLabel ? <BackLink href={backHref} label={backLabel} /> : null}
          <GroupsReveal gameState={gameState} onShare={handleShare} />
          {shareFeedback && (
            <p className="text-muted-foreground text-center text-sm" role="status">
              {shareFeedback}
            </p>
          )}
        </LayoutContainer>
      </GameModeLayout>
    );
  }

  return (
    <GameModeLayout
      mode="groups"
      puzzleNumber={gameState.puzzle.puzzleNumber}
      puzzleDate={gameState.puzzle.date}
      isArchive={isArchive}
    >
      <LayoutContainer className="flex max-w-6xl flex-col gap-6">
        {backHref && backLabel ? <BackLink href={backHref} label={backLabel} /> : null}
        <GroupsBoard
          gameState={gameState}
          toggleSelection={toggleSelection}
          clearSelection={clearSelection}
          shuffleBoard={shuffleBoard}
          submitSelection={submitSelection}
          isSubmitting={isSubmitting}
          lastError={lastError}
        />
      </LayoutContainer>
    </GameModeLayout>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <div>
      <Link href={href} className="text-muted-foreground hover:text-body-primary text-sm">
        {label}
      </Link>
    </div>
  );
}

function buildShareText(gameState: {
  puzzle: { puzzleNumber: number };
  hasWon: boolean;
  mistakes: number;
  revealedGroups: Array<{ year: number; tier: string }>;
}) {
  const lines = gameState.revealedGroups.map((group) => `${group.tier}: ${formatYear(group.year)}`);
  return [
    `Chrondle Groups #${gameState.puzzle.puzzleNumber}`,
    gameState.hasWon
      ? `Solved with ${gameState.mistakes} mistakes`
      : "Missed on the fourth mistake",
    ...lines,
  ].join("\n");
}

function formatYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BC` : `${year} AD`;
}
