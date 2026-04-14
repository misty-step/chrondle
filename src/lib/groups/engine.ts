export type GroupsTier = "easy" | "medium" | "hard" | "very hard";
export type GroupsSubmissionResult = "solved" | "one_away" | "miss";

export interface GroupsPuzzleGroup {
  id: string;
  year: number;
  tier: GroupsTier;
  eventIds: string[];
}

export type GroupsRevealedGroup = GroupsPuzzleGroup;

export interface GroupsSubmissionRecord {
  eventIds: string[];
  result: GroupsSubmissionResult;
  timestamp: number;
}

export interface GroupsProgress {
  solvedGroupIds: string[];
  mistakes: number;
  remainingMistakes: number;
  isComplete: boolean;
  hasWon: boolean;
  submissions: GroupsSubmissionRecord[];
  revealedGroups: GroupsRevealedGroup[];
}

export const GROUPS_SELECTION_SIZE = 4;
export const MAX_GROUPS_MISTAKES = 4;

type SolvedSelection = {
  result: "solved";
  matchedGroupId: string;
  revealedYear: number;
  revealedTier: GroupsTier;
};

type NonSolvedSelection = { result: "one_away" | "miss" };

export type GroupsSelectionOutcome = SolvedSelection | NonSolvedSelection;

export interface ApplyGroupsSelectionArgs {
  groups: GroupsPuzzleGroup[];
  boardEventIds: string[];
  solvedGroupIds: string[];
  submissions: GroupsSubmissionRecord[];
  eventIds: string[];
  timestamp?: number;
}

export interface ApplyGroupsSelectionResult {
  outcome: GroupsSelectionOutcome;
  progress: GroupsProgress;
}

function normalizeSelection(eventIds: string[]): string[] {
  return [...new Set(eventIds)].sort();
}

function countOverlap(left: string[], right: string[]): number {
  const rightSet = new Set(right);
  return left.reduce((count, id) => count + (rightSet.has(id) ? 1 : 0), 0);
}

export function evaluateGroupSelection(
  groups: GroupsPuzzleGroup[],
  eventIds: string[],
): GroupsSelectionOutcome {
  const normalizedSelection = normalizeSelection(eventIds);
  if (normalizedSelection.length !== GROUPS_SELECTION_SIZE) {
    throw new Error(
      `Groups selection must contain exactly ${GROUPS_SELECTION_SIZE} unique event ids.`,
    );
  }

  for (const group of groups) {
    const normalizedGroup = normalizeSelection(group.eventIds);
    const overlap = countOverlap(normalizedSelection, normalizedGroup);

    if (overlap === GROUPS_SELECTION_SIZE) {
      return {
        result: "solved",
        matchedGroupId: group.id,
        revealedYear: group.year,
        revealedTier: group.tier,
      };
    }
  }

  for (const group of groups) {
    const normalizedGroup = normalizeSelection(group.eventIds);
    if (countOverlap(normalizedSelection, normalizedGroup) === 3) {
      return { result: "one_away" };
    }
  }

  return { result: "miss" };
}

export function countMistakes(submissions: GroupsSubmissionRecord[]): number {
  return submissions.filter((submission) => submission.result !== "solved").length;
}

export function isGroupsPuzzleComplete(
  groups: GroupsPuzzleGroup[],
  solvedGroupIds: string[],
): boolean {
  const solved = new Set(solvedGroupIds);
  return groups.every((group) => solved.has(group.id));
}

export function serializeRevealedGroups(
  groups: GroupsPuzzleGroup[],
  solvedGroupIds: string[],
  revealAll: boolean,
): GroupsRevealedGroup[] {
  const solved = new Set(solvedGroupIds);

  return groups
    .filter((group) => revealAll || solved.has(group.id))
    .map((group) => ({
      id: group.id,
      year: group.year,
      tier: group.tier,
      eventIds: group.eventIds,
    }));
}

export function buildGroupsProgress(
  groups: GroupsPuzzleGroup[],
  solvedGroupIds: string[],
  submissions: GroupsSubmissionRecord[],
): GroupsProgress {
  const mistakes = countMistakes(submissions);
  const hasWon = isGroupsPuzzleComplete(groups, solvedGroupIds);
  const isComplete = hasWon || mistakes >= MAX_GROUPS_MISTAKES;

  return {
    solvedGroupIds,
    mistakes,
    remainingMistakes: Math.max(0, MAX_GROUPS_MISTAKES - mistakes),
    isComplete,
    hasWon,
    submissions,
    revealedGroups: serializeRevealedGroups(groups, solvedGroupIds, isComplete),
  };
}

export function applyGroupsSelection({
  groups,
  boardEventIds,
  solvedGroupIds,
  submissions,
  eventIds,
  timestamp = Date.now(),
}: ApplyGroupsSelectionArgs): ApplyGroupsSelectionResult {
  const normalizedEventIds = normalizeSelection(eventIds);
  if (normalizedEventIds.length !== GROUPS_SELECTION_SIZE) {
    throw new Error(
      `Groups selection must contain exactly ${GROUPS_SELECTION_SIZE} unique event ids.`,
    );
  }

  const boardEventIdSet = new Set(boardEventIds);
  for (const eventId of normalizedEventIds) {
    if (!boardEventIdSet.has(eventId)) {
      throw new Error("Selection contains an event that is not on the board.");
    }
  }

  const solvedGroupSet = new Set(solvedGroupIds);
  const solvedEventIds = new Set(
    groups.filter((group) => solvedGroupSet.has(group.id)).flatMap((group) => group.eventIds),
  );

  for (const eventId of normalizedEventIds) {
    if (solvedEventIds.has(eventId)) {
      throw new Error("Solved cards cannot be submitted again.");
    }
  }

  const remainingGroups = groups.filter((group) => !solvedGroupSet.has(group.id));
  const outcome = evaluateGroupSelection(remainingGroups, normalizedEventIds);
  const nextSolvedGroupIds =
    outcome.result === "solved" ? [...solvedGroupIds, outcome.matchedGroupId] : solvedGroupIds;
  const nextSubmissions = [
    ...submissions,
    {
      eventIds: normalizedEventIds,
      result: outcome.result,
      timestamp,
    },
  ];

  return {
    outcome,
    progress: buildGroupsProgress(groups, nextSolvedGroupIds, nextSubmissions),
  };
}

export function validateCompletedGroupsPlay({
  groups,
  solvedGroupIds,
  submissions,
  mistakes,
}: {
  groups: GroupsPuzzleGroup[];
  solvedGroupIds: string[];
  submissions: GroupsSubmissionRecord[];
  mistakes: number;
}): { ok: true } | { ok: false; reason: string } {
  if (mistakes < 0 || mistakes >= MAX_GROUPS_MISTAKES) {
    return { ok: false, reason: "Completed winning plays must finish before the mistake limit." };
  }

  if (!isGroupsPuzzleComplete(groups, solvedGroupIds)) {
    return { ok: false, reason: "Solved group ids do not cover the full puzzle." };
  }

  const solvedGroups = new Set(solvedGroupIds);
  if (solvedGroups.size !== solvedGroupIds.length) {
    return { ok: false, reason: "Solved group ids contain duplicates." };
  }

  const solvedGroupsSeen = new Set<string>();

  for (const submission of submissions) {
    const outcome = evaluateGroupSelection(groups, submission.eventIds);

    if (outcome.result !== submission.result) {
      return { ok: false, reason: "Submission transcript does not match server evaluation." };
    }

    if (outcome.result === "solved") {
      if (solvedGroupsSeen.has(outcome.matchedGroupId)) {
        return { ok: false, reason: "Submission transcript solved the same group more than once." };
      }
      solvedGroupsSeen.add(outcome.matchedGroupId);
    }
  }

  if (countMistakes(submissions) !== mistakes) {
    return { ok: false, reason: "Stored mistakes do not match submission transcript." };
  }

  for (const groupId of solvedGroupsSeen) {
    if (!solvedGroups.has(groupId)) {
      return { ok: false, reason: "Submission transcript solved a group missing from play data." };
    }
  }

  for (const groupId of solvedGroups) {
    if (!solvedGroupsSeen.has(groupId)) {
      return {
        ok: false,
        reason: "Solved group ids include groups never solved in the transcript.",
      };
    }
  }

  return { ok: true };
}
