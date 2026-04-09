"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import type { Id } from "convex/_generated/dataModel";
import { anyPublicApi } from "@/lib/convexAnyApi";
import { safeConvexId } from "@/lib/validation";
import type {
  GroupsProgress,
  GroupsRevealedGroup,
  GroupsSubmissionRecord,
} from "@/types/groupsGameState";

interface ConvexGroupsPlay {
  _id: Id<"groupsPlays">;
  userId: Id<"users">;
  puzzleId: Id<"groupsPuzzles">;
  solvedGroupIds: string[];
  mistakes: number;
  remainingMistakes: number;
  isComplete: boolean;
  hasWon: boolean;
  submissions: GroupsSubmissionRecord[];
  revealedGroups: GroupsRevealedGroup[];
}

interface UseGroupsProgressReturn {
  progress: GroupsProgress | null;
  isLoading: boolean;
}

export function useGroupsProgress(
  userId: string | null,
  puzzleId: string | null,
): UseGroupsProgressReturn {
  const validUserId = safeConvexId(userId, "users");
  const validPuzzleId = safeConvexId(puzzleId, "groupsPuzzles");
  const shouldQuery = validUserId !== null && validPuzzleId !== null;
  const getGroupsPlayQuery = anyPublicApi.groupsPlays.getGroupsPlay;

  const convexPlay = useQuery(
    getGroupsPlayQuery as any,
    shouldQuery
      ? {
          userId: validUserId as Id<"users">,
          puzzleId: validPuzzleId as Id<"groupsPuzzles">,
        }
      : "skip",
  ) as ConvexGroupsPlay | null | undefined;

  return useMemo<UseGroupsProgressReturn>(() => {
    if (!shouldQuery) {
      return { progress: null, isLoading: false };
    }

    if (convexPlay === undefined) {
      return { progress: null, isLoading: true };
    }

    if (convexPlay === null) {
      return { progress: null, isLoading: false };
    }

    return {
      progress: {
        solvedGroupIds: convexPlay.solvedGroupIds,
        mistakes: convexPlay.mistakes,
        remainingMistakes: convexPlay.remainingMistakes,
        isComplete: convexPlay.isComplete,
        hasWon: convexPlay.hasWon,
        submissions: convexPlay.submissions,
        revealedGroups: convexPlay.revealedGroups,
      },
      isLoading: false,
    };
  }, [convexPlay, shouldQuery]);
}
