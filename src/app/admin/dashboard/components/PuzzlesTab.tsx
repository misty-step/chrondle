"use client";

import React from "react";
import { Card } from "@/components/ui/Card";

/**
 * Puzzles Manager Tab - Placeholder
 *
 * Will be implemented in Phase 4.5:
 * - View puzzles by mode (Classic/Order)
 * - Puzzle detail modal with events
 * - Player stats per puzzle
 */
export default function PuzzlesTab() {
  return (
    <Card className="p-6">
      <h2 className="font-heading text-text-primary mb-4 text-lg font-semibold">Puzzles Manager</h2>
      <p className="text-text-secondary">Puzzle viewing and management coming soon.</p>
      <p className="text-text-tertiary mt-2 text-sm">
        Phase 4.5 - Browse Classic and Order puzzles
      </p>
    </Card>
  );
}
