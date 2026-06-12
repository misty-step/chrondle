// Server component: renders the endless Duel experience.
// No SSR preload — runs are seeded client-side per session.

import type { Metadata } from "next";

import { DuelGameIsland } from "@/components/duel/DuelGameIsland";

export const metadata: Metadata = {
  title: "Duel — Chrondle",
  description:
    "Two historical events. Tap the one that happened first. How long can your streak last?",
};

export default function DuelPage() {
  return <DuelGameIsland />;
}
