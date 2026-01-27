// Server component: renders the Classic Chrondle experience.
// No SSR preload - GameIsland fetches puzzle by local date client-side.

import { GameIsland } from "@/components/GameIsland";

export default function ClassicPage() {
  return <GameIsland />;
}
