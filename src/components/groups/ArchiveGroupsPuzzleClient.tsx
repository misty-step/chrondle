"use client";

import React from "react";
import type { GroupsPuzzle } from "@/lib/convexServer";
import { GroupsGameView } from "@/components/groups/GroupsGameView";

interface ArchiveGroupsPuzzleClientProps {
  puzzleNumber: number;
  initialPuzzle: GroupsPuzzle;
}

export function ArchiveGroupsPuzzleClient({
  puzzleNumber,
  initialPuzzle,
}: ArchiveGroupsPuzzleClientProps): React.ReactElement {
  return (
    <GroupsGameView
      puzzleNumber={puzzleNumber}
      initialPuzzle={initialPuzzle}
      isArchive={true}
      backHref="/archive/groups"
      backLabel="← Back to Groups Archive"
    />
  );
}
