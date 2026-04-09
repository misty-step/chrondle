import type { Id } from "../../convex/_generated/dataModel";
import type {
  GroupsProgress,
  GroupsPuzzleGroup,
  GroupsSubmissionRecord,
  GroupsSubmissionResult,
  GroupsTier,
} from "@/lib/groups/engine";

export type { GroupsProgress, GroupsSubmissionRecord, GroupsSubmissionResult, GroupsTier };

export interface GroupsBoardCard {
  id: string;
  text: string;
}

export interface GroupsPuzzle {
  id: Id<"groupsPuzzles">;
  date: string;
  puzzleNumber: number;
  board: GroupsBoardCard[];
  groups: GroupsPuzzleGroup[];
  seed: string;
}

export type GroupsRevealedGroup = GroupsPuzzleGroup;

export type GroupsGameState =
  | { status: "loading-puzzle" }
  | { status: "loading-auth" }
  | { status: "loading-progress" }
  | ReadyState
  | CompletedState
  | { status: "error"; error: string };

export interface ReadyState {
  status: "ready";
  puzzle: GroupsPuzzle;
  activeCards: GroupsBoardCard[];
  selectedIds: string[];
  solvedGroupIds: string[];
  mistakes: number;
  remainingMistakes: number;
  submissions: GroupsSubmissionRecord[];
  revealedGroups: GroupsRevealedGroup[];
}

export interface CompletedState {
  status: "completed";
  puzzle: GroupsPuzzle;
  activeCards: GroupsBoardCard[];
  solvedGroupIds: string[];
  mistakes: number;
  remainingMistakes: number;
  submissions: GroupsSubmissionRecord[];
  revealedGroups: GroupsRevealedGroup[];
  hasWon: boolean;
}
