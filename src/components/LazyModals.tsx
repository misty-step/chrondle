"use client";

import { lazy, Suspense } from "react";
import { LoadingSpinner } from "@/components/kit/LoadingSpinner";

// Lazy load heavy modal components
export const AchievementModal = lazy(() =>
  import("@/components/modals/AchievementModal").then((m) => ({
    default: m.AchievementModal,
  })),
);

// Modal wrapper with Suspense boundary
export function LazyModalWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
