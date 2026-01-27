"use client";

import React, { Suspense, lazy } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Admin Dashboard Tab Navigation
 *
 * Deep module pattern: Simple tab interface hides complex routing + lazy loading.
 * URL-driven state enables deep linking, browser history, and shareable URLs.
 */

type TabId = "overview" | "events" | "puzzles";

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: "overview", label: "Overview" },
  { id: "events", label: "Events" },
  { id: "puzzles", label: "Puzzles" },
];

// Lazy load tab content for code splitting
const OverviewTab = lazy(() => import("./OverviewTab"));
const EventsTab = lazy(() => import("./EventsTab"));
const PuzzlesTab = lazy(() => import("./PuzzlesTab"));

function TabSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="bg-surface-secondary h-32 rounded-lg" />
      <div className="bg-surface-secondary h-32 rounded-lg" />
    </div>
  );
}

export function AdminTabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get current tab from URL, default to "overview"
  const currentTab = (searchParams.get("tab") as TabId) || "overview";

  // Validate tab ID
  const isValidTab = TABS.some((t) => t.id === currentTab);
  const activeTab = isValidTab ? currentTab : "overview";

  const handleTabChange = (tabId: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "overview") {
      // Remove tab param for default tab (cleaner URL)
      params.delete("tab");
    } else {
      params.set("tab", tabId);
    }
    // Preserve other params like mode
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const handleKeyDown = (e: React.KeyboardEvent, tabId: TabId) => {
    const currentIndex = TABS.findIndex((t) => t.id === activeTab);

    switch (e.key) {
      case "ArrowLeft": {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : TABS.length - 1;
        handleTabChange(TABS[prevIndex].id);
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        const nextIndex = currentIndex < TABS.length - 1 ? currentIndex + 1 : 0;
        handleTabChange(TABS[nextIndex].id);
        break;
      }
      case "Enter":
      case " ":
        e.preventDefault();
        handleTabChange(tabId);
        break;
    }
  };

  return (
    <div>
      {/* Tab List */}
      <div
        role="tablist"
        aria-label="Admin dashboard sections"
        className="border-border-secondary mb-6 flex gap-1 border-b"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => handleTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, tab.id)}
            className={cn(
              "relative px-4 py-2 text-sm font-medium transition-colors",
              "hover:text-text-primary focus-visible:ring-accent-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              activeTab === tab.id
                ? "text-text-primary"
                : "text-text-secondary hover:bg-surface-secondary rounded-t-md",
            )}
          >
            {tab.label}
            {/* Active indicator */}
            {activeTab === tab.id && (
              <span className="bg-accent-primary absolute inset-x-0 -bottom-px h-0.5" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Panel */}
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
      >
        <Suspense fallback={<TabSkeleton />}>
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "events" && <EventsTab />}
          {activeTab === "puzzles" && <PuzzlesTab />}
        </Suspense>
      </div>
    </div>
  );
}
