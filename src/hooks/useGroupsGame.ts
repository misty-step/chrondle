"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthState } from "@/hooks/data/useAuthState";
import { useGroupsProgress } from "@/hooks/data/useGroupsProgress";
import { useGroupsPuzzleData } from "@/hooks/data/useGroupsPuzzleData";
import { useGroupsSession } from "@/hooks/useGroupsSession";
import { useMutationWithRetry } from "@/hooks/useMutationWithRetry";
import type { Toast } from "@/hooks/use-toast";
import {
  applyGroupsSelection,
  GROUPS_SELECTION_SIZE,
  MAX_GROUPS_MISTAKES,
} from "@/lib/groups/engine";
import type {
  CompletedState,
  GroupsGameState,
  GroupsProgress,
  GroupsRevealedGroup,
  ReadyState,
  GroupsSubmissionRecord,
  GroupsSubmissionResult,
  GroupsTier,
} from "@/types/groupsGameState";
import { assertConvexId } from "@/lib/validation";
import { logger } from "@/lib/logger";
import type { Id } from "../../convex/_generated/dataModel";
import { anyPublicApi } from "@/lib/convexAnyApi";

interface UseGroupsGameReturn {
  gameState: GroupsGameState;
  toggleSelection: (eventId: string) => void;
  clearSelection: () => void;
  shuffleBoard: () => void;
  submitSelection: () => Promise<void>;
  isSubmitting: boolean;
  lastError: string | null;
}

const EMPTY_PROGRESS: GroupsProgress = {
  solvedGroupIds: [],
  mistakes: 0,
  remainingMistakes: MAX_GROUPS_MISTAKES,
  isComplete: false,
  hasWon: false,
  submissions: [],
  revealedGroups: [],
};

type SubmitGroupSelectionArgs = {
  puzzleId: Id<"groupsPuzzles">;
  userId: Id<"users">;
  eventIds: string[];
};

type SubmitGroupSelectionOutcome =
  | {
      result: "solved";
      matchedGroupId: string;
      revealedYear: number;
      revealedTier: GroupsTier;
    }
  | {
      result: Exclude<GroupsSubmissionResult, "solved">;
    };

type SubmitGroupSelectionResult = {
  playId: Id<"groupsPlays">;
  outcome: SubmitGroupSelectionOutcome | null;
  solvedGroupIds: string[];
  mistakes: number;
  remainingMistakes: number;
  isComplete: boolean;
  hasWon: boolean;
  submissions: GroupsSubmissionRecord[];
  revealedGroups: GroupsRevealedGroup[];
};

export function useGroupsGame(
  puzzleNumber?: number,
  initialPuzzle?: unknown,
  addToast?: (toast: Omit<Toast, "id">) => void,
): UseGroupsGameReturn {
  const puzzle = useGroupsPuzzleData(puzzleNumber, initialPuzzle);
  const auth = useAuthState();
  const progress = useGroupsProgress(auth.userId, puzzle.puzzle?.id ?? null);
  const session = useGroupsSession(puzzle.puzzle?.id ?? null, auth.isAuthenticated);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cardOrder, setCardOrder] = useState<string[]>([]);
  const [optimisticProgress, setOptimisticProgress] = useState<GroupsProgress | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const submitGroupSelection = useMutationWithRetry(
    anyPublicApi.groupsPuzzles.submitGroupSelection,
    {
      maxRetries: 2,
      baseDelayMs: 600,
    },
  ) as (args: SubmitGroupSelectionArgs) => Promise<SubmitGroupSelectionResult>;

  const boardSignature = useMemo(
    () => puzzle.puzzle?.board.map((card) => card.id).join("|") ?? "",
    [puzzle.puzzle?.board],
  );

  useEffect(() => {
    if (!puzzle.puzzle) {
      setCardOrder([]);
      return;
    }

    setCardOrder((previous) =>
      reconcileCardOrder(
        previous,
        puzzle.puzzle!.board.map((card) => card.id),
      ),
    );
  }, [boardSignature, puzzle.puzzle]);

  useEffect(() => {
    setSelectedIds([]);
    setOptimisticProgress(null);
    setLastError(null);
  }, [auth.userId, puzzle.puzzle?.id]);

  const currentProgress = auth.isAuthenticated
    ? (optimisticProgress ?? progress.progress ?? EMPTY_PROGRESS)
    : session.state;

  const solvedEventIds = useMemo(
    () => new Set(currentProgress.revealedGroups.flatMap((group) => group.eventIds)),
    [currentProgress.revealedGroups],
  );

  const activeCards = useMemo(() => {
    if (!puzzle.puzzle) {
      return [];
    }

    const unsolvedCards = puzzle.puzzle.board.filter((card) => !solvedEventIds.has(card.id));
    const orderLookup = new Map(cardOrder.map((id, index) => [id, index]));

    return [...unsolvedCards].sort(
      (left, right) => (orderLookup.get(left.id) ?? 0) - (orderLookup.get(right.id) ?? 0),
    );
  }, [cardOrder, puzzle.puzzle, solvedEventIds]);

  const gameState = useMemo<GroupsGameState>(() => {
    if (puzzle.isLoading) {
      return { status: "loading-puzzle" };
    }

    if (puzzle.error) {
      return { status: "error", error: puzzle.error.message };
    }

    if (!puzzle.puzzle) {
      return { status: "error", error: "No Groups puzzle available" };
    }

    if (auth.isLoading) {
      return { status: "loading-auth" };
    }

    if (auth.isAuthenticated && progress.isLoading) {
      return { status: "loading-progress" };
    }

    if (currentProgress.isComplete) {
      const completedState: CompletedState = {
        status: "completed",
        puzzle: puzzle.puzzle,
        activeCards,
        solvedGroupIds: currentProgress.solvedGroupIds,
        mistakes: currentProgress.mistakes,
        remainingMistakes: currentProgress.remainingMistakes,
        submissions: currentProgress.submissions,
        revealedGroups: currentProgress.revealedGroups,
        hasWon: currentProgress.hasWon,
      };
      return completedState;
    }

    const readyState: ReadyState = {
      status: "ready",
      puzzle: puzzle.puzzle,
      activeCards,
      selectedIds,
      solvedGroupIds: currentProgress.solvedGroupIds,
      mistakes: currentProgress.mistakes,
      remainingMistakes: currentProgress.remainingMistakes,
      submissions: currentProgress.submissions,
      revealedGroups: currentProgress.revealedGroups,
    };

    return readyState;
  }, [
    activeCards,
    auth.isAuthenticated,
    auth.isLoading,
    currentProgress,
    progress.isLoading,
    puzzle.error,
    puzzle.isLoading,
    puzzle.puzzle,
    selectedIds,
  ]);

  const toggleSelection = useCallback((eventId: string) => {
    setSelectedIds((previous) => {
      if (previous.includes(eventId)) {
        return previous.filter((id) => id !== eventId);
      }
      if (previous.length >= 4) {
        return previous;
      }
      return [...previous, eventId];
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const shuffleBoard = useCallback(() => {
    setCardOrder((previous) => {
      const activeIds = activeCards.map((card) => card.id);
      const activeIdSet = new Set(activeIds);
      const shuffledActiveIds = shuffle(activeIds);
      const archivedIds = previous.filter((id) => !activeIdSet.has(id));
      return [...shuffledActiveIds, ...archivedIds];
    });
  }, [activeCards]);

  const submitSelection = useCallback(async () => {
    if (selectedIds.length !== GROUPS_SELECTION_SIZE || isSubmitting) {
      return;
    }

    if (!puzzle.puzzle) {
      return;
    }

    setIsSubmitting(true);
    setLastError(null);

    try {
      if (!auth.isAuthenticated) {
        const result = applyGroupsSelection({
          groups: puzzle.puzzle.groups,
          boardEventIds: puzzle.puzzle.board.map((card) => card.id),
          solvedGroupIds: session.state.solvedGroupIds,
          submissions: session.state.submissions,
          eventIds: selectedIds,
        });

        session.replaceProgress(result.progress);
        setSelectedIds([]);
        showSubmissionToast(result.outcome, result.progress, addToast);
        return;
      }

      if (!auth.userId) {
        return;
      }

      const result = await submitGroupSelection({
        puzzleId: assertConvexId(puzzle.puzzle.id, "groupsPuzzles"),
        userId: assertConvexId(auth.userId, "users"),
        eventIds: selectedIds,
      });

      setOptimisticProgress({
        solvedGroupIds: result.solvedGroupIds,
        mistakes: result.mistakes,
        remainingMistakes: result.remainingMistakes,
        isComplete: result.isComplete,
        hasWon: result.hasWon,
        submissions: result.submissions,
        revealedGroups: result.revealedGroups,
      });
      setSelectedIds([]);

      if (result.outcome) {
        showSubmissionToast(result.outcome, result, addToast);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit selection";
      logger.error("[useGroupsGame] Submission failed:", error);
      setLastError(message);
      addToast?.({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    addToast,
    auth.isAuthenticated,
    auth.userId,
    isSubmitting,
    puzzle.puzzle,
    selectedIds,
    session,
    submitGroupSelection,
  ]);

  return {
    gameState,
    toggleSelection,
    clearSelection,
    shuffleBoard,
    submitSelection,
    isSubmitting,
    lastError,
  };
}

function reconcileCardOrder(previous: string[], nextIds: string[]): string[] {
  if (!previous.length) {
    return nextIds;
  }

  const nextIdSet = new Set(nextIds);
  const preserved = previous.filter((id) => nextIdSet.has(id));
  const missing = nextIds.filter((id) => !preserved.includes(id));
  return [...preserved, ...missing];
}

function shuffle(ids: string[]): string[] {
  const next = [...ids];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function formatYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BC` : `${year} AD`;
}

function capitalizeTier(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function showSubmissionToast(
  outcome: SubmitGroupSelectionOutcome,
  progress: Pick<GroupsProgress, "hasWon" | "isComplete" | "mistakes" | "remainingMistakes">,
  addToast?: (toast: Omit<Toast, "id">) => void,
) {
  if (outcome.result === "solved") {
    addToast?.({
      title: `${formatYear(outcome.revealedYear)} solved`,
      description: `${capitalizeTier(outcome.revealedTier)} group locked in.`,
    });
  } else if (outcome.result === "one_away") {
    addToast?.({
      title: "One away",
      description: "Three of the four events belong together.",
    });
  } else {
    addToast?.({
      title: "Miss",
      description: `${progress.remainingMistakes} mistakes remaining.`,
    });
  }

  if (progress.isComplete) {
    addToast?.({
      title: progress.hasWon ? "Puzzle solved" : "Out of mistakes",
      description: progress.hasWon
        ? `You found all four hidden years with ${progress.mistakes} mistakes.`
        : "All four groups are now revealed.",
    });
  }
}
