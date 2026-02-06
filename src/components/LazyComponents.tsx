"use client";

import { lazy } from "react";

// Lazy load historical context card (uses AI and heavy dependencies)
export const HistoricalContextCard = lazy(() =>
  import("@/components/HistoricalContextCard").then((m) => ({
    default: m.HistoricalContextCard,
  })),
);

// Export the original imports for components that should not be lazy loaded
export { GameLayout } from "@/components/GameLayout";
export { AppHeader } from "@/components/AppHeader";
export { Footer } from "@/components/Footer";
export { LiveAnnouncer } from "@/components/ui/LiveAnnouncer";
