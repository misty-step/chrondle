// Server component: renders the Classic Chrondle experience.

import { preloadQuery } from "convex/nextjs";
import { api } from "../../../convex/_generated/api";
import { GameIsland } from "@/components/GameIsland";

export default async function ClassicPage() {
  const preloadedPuzzle = await preloadQuery(api.puzzles.getDailyPuzzle);
  return <GameIsland preloadedPuzzle={preloadedPuzzle} />;
}
