import React, { Suspense } from "react";
import { preloadQuery } from "convex/nextjs";
import { GameModeUnavailableState } from "@/components/GameModeUnavailableState";
import { GroupsGameIsland } from "@/components/groups/GroupsGameIsland";
import { LoadingShell } from "@/components/LoadingShell";
import { api } from "@/lib/convexServer";
import { logger } from "@/lib/logger";
import { isBackendUnavailablePreloadError } from "@/lib/preloadQueryAvailability";

export default async function GroupsPage() {
  let preloadedPuzzle = null;

  try {
    preloadedPuzzle = await preloadQuery(api.groupsPuzzles.getDailyGroupsPuzzle);
  } catch (error) {
    if (!isBackendUnavailablePreloadError(error)) {
      throw error;
    }

    logger.warn("[GroupsPage] Failed to preload Groups puzzle", { error });
    return (
      <GameModeUnavailableState
        mode="groups"
        title="Groups Is Unavailable"
        description="This build cannot load the daily Groups puzzle yet because the backend configuration or deployment is incomplete. Classic and Order remain available while Groups catches up."
        primaryHref="/"
        primaryLabel="Back to Home"
        secondaryHref="/classic"
        secondaryLabel="Play Classic"
      />
    );
  }

  if (!preloadedPuzzle) {
    logger.warn("[GroupsPage] Daily Groups puzzle unavailable during preload");
    return (
      <GameModeUnavailableState
        mode="groups"
        title="Groups Is Unavailable"
        description="This build cannot load the daily Groups puzzle yet because the backend configuration or deployment is incomplete. Classic and Order remain available while Groups catches up."
        primaryHref="/"
        primaryLabel="Back to Home"
        secondaryHref="/classic"
        secondaryLabel="Play Classic"
      />
    );
  }

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
