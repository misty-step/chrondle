// Server component for the Order mode.

import React, { Suspense } from "react";
import { preloadQuery } from "convex/nextjs";
import { api } from "@/lib/convexServer";
import { OrderGameIsland } from "@/components/order/OrderGameIsland";
import { LoadingShell } from "@/components/LoadingShell";

export default async function OrderPage() {
  const preloadedPuzzle = await preloadQuery(api.orderPuzzles.getDailyOrderPuzzle);
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
