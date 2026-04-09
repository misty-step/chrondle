import React, { Suspense } from "react";
import { preloadQuery } from "convex/nextjs";
import { GroupsGameIsland } from "@/components/groups/GroupsGameIsland";
import { GroupsUnavailableState } from "@/components/groups/GroupsUnavailableState";
import { GameModeLayout } from "@/components/GameModeLayout";
import { LoadingShell } from "@/components/LoadingShell";
import { api } from "@/lib/convexServer";
import { logger } from "@/lib/logger";

export default async function GroupsPage() {
  let preloadedPuzzle = null;
  let backendUnavailable = false;

  try {
    preloadedPuzzle = await preloadQuery(api.groupsPuzzles.getDailyGroupsPuzzle);
  } catch (error) {
    backendUnavailable = true;
    logger.warn("[GroupsPage] Failed to preload Groups puzzle", { error });
  }

  if (backendUnavailable || !preloadedPuzzle) {
    return (
      <GameModeLayout mode="groups">
        <div className="flex flex-1 items-center px-4">
          <GroupsUnavailableState
            title="Groups Is Warming Up"
            description="This build is connected to a backend that has not deployed the Groups queries yet. Classic and Order are still available, and Groups will light up once the Convex deploy completes."
            primaryHref="/"
            primaryLabel="Back to Home"
            secondaryHref="/classic"
            secondaryLabel="Play Classic"
            className="my-auto"
          />
        </div>
      </GameModeLayout>
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
