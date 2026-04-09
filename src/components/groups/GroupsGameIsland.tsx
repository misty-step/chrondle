"use client";

import { Preloaded, usePreloadedQuery } from "convex/react";
import { GroupsGameView } from "@/components/groups/GroupsGameView";

interface GroupsGameIslandProps {
  preloadedPuzzle: Preloaded<any>;
}

export function GroupsGameIsland({ preloadedPuzzle }: GroupsGameIslandProps) {
  const puzzle = usePreloadedQuery(preloadedPuzzle);
  return <GroupsGameView initialPuzzle={puzzle} />;
}
