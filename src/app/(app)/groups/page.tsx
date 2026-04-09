import React, { Suspense } from "react";
import { preloadQuery } from "convex/nextjs";
import { GroupsGameIsland } from "@/components/groups/GroupsGameIsland";
import { LoadingShell } from "@/components/LoadingShell";
import { api } from "@/lib/convexServer";

export default async function GroupsPage() {
  const preloadedPuzzle = await preloadQuery(api.groupsPuzzles.getDailyGroupsPuzzle);

  return (
    <Suspense
      fallback={
        <LoadingShell
          intent="generic"
          stage="fetching"
          message="Loading Groups puzzle..."
          subMessage="Fetching today's event board"
        />
      }
    >
      <GroupsGameIsland preloadedPuzzle={preloadedPuzzle} />
    </Suspense>
  );
}
