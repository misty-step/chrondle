// Server component for the Order mode.

import { preloadQuery } from "convex/nextjs";
import { api } from "@/lib/convexServer";
import { OrderGameIsland } from "@/components/order/OrderGameIsland";

export default async function OrderPage() {
  const preloadedPuzzle = await preloadQuery(api.orderPuzzles.getDailyOrderPuzzle);
  return <OrderGameIsland preloadedPuzzle={preloadedPuzzle} />;
}
