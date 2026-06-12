"use client";

import React from "react";

import { DuelBoard } from "@/components/duel/DuelBoard";
import { GameModeLayout } from "@/components/GameModeLayout";
import { useDuelGame } from "@/hooks/useDuelGame";

/**
 * Client orchestrator for Duel mode: wires the run hook to the board inside
 * the shared mode shell. No preload — rounds are seeded per run client-side.
 */
export function DuelGameIsland() {
  const game = useDuelGame();

  return (
    <GameModeLayout mode="duel">
      <div className="py-2 sm:py-4">
        <DuelBoard game={game} />
      </div>
    </GameModeLayout>
  );
}
