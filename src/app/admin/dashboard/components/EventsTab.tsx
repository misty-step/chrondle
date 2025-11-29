"use client";

import React from "react";
import { Card } from "@/components/ui/Card";

/**
 * Events Browser Tab - Placeholder
 *
 * Will be implemented in Phase 4.4:
 * - Search events by text
 * - Filter by year, era, usage status
 * - Inline edit event text
 * - Delete problematic events
 */
export default function EventsTab() {
  return (
    <Card className="p-6">
      <h2 className="font-heading text-text-primary mb-4 text-lg font-semibold">Events Browser</h2>
      <p className="text-text-secondary">Event browsing, search, and management coming soon.</p>
      <p className="text-text-tertiary mt-2 text-sm">
        Phase 4.4 - Search, filter, edit, delete events
      </p>
    </Card>
  );
}
