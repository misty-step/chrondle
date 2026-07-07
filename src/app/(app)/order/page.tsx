// Server component for the Order mode.

import React, { Suspense } from "react";
import { preloadQuery } from "convex/nextjs";
import { GameModeUnavailableState } from "@/components/GameModeUnavailableState";
import { api } from "@/lib/convexServer";
import { OrderGameIsland } from "@/components/order/OrderGameIsland";
import { LoadingShell } from "@/components/LoadingShell";
import { logger } from "@/lib/logger";
import { isBackendUnavailablePreloadError } from "@/lib/preloadQueryAvailability";
import { getUTCDateString } from "@/lib/time/dailyDate";

export default async function OrderPage() {
  let preloadedPuzzle = null;

  try {
    // Best-effort SSR seed only: the server cannot know the player's local
    // date, so it seeds with its own (UTC) date. The client hook
    // (useTodaysOrderPuzzle) validates the seed against the player's LOCAL
    // date — Chrondle's canonical "today", see src/lib/time/dailyDate.ts —
    // and refetches when they differ. The seed never decides which puzzle is
    // played.
    preloadedPuzzle = await preloadQuery(api.orderPuzzles.getOrderPuzzleByDate, {
      date: getUTCDateString(),
    });
  } catch (error) {
    if (!isBackendUnavailablePreloadError(error)) {
      throw error;
    }

    logger.warn("[OrderPage] Failed to preload Order puzzle", { error });
    return (
      <GameModeUnavailableState
        mode="order"
        title="Order Is Unavailable"
        description="This build cannot load the daily Order puzzle yet because the backend configuration or deployment is incomplete. Classic remains available while Order catches up."
        primaryHref="/"
        primaryLabel="Back to Home"
        secondaryHref="/classic"
        secondaryLabel="Play Classic"
      />
    );
  }

  if (!preloadedPuzzle) {
    logger.warn("[OrderPage] Daily Order puzzle unavailable during preload");
    return (
      <GameModeUnavailableState
        mode="order"
        title="Order Is Unavailable"
        description="This build cannot load the daily Order puzzle yet because the backend configuration or deployment is incomplete. Classic remains available while Order catches up."
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
          intent="order"
          stage="fetching"
          message="Loading Order puzzle…"
          subMessage="Fetching events and your progress"
        />
      }
    >
      <OrderGameIsland preloadedPuzzle={preloadedPuzzle} />
    </Suspense>
  );
}
