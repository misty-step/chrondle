import React from "react";
import { LoadingExperience } from "@/components/loading/LoadingExperience";
import type { LoadingProps } from "@/components/loading/loadingTokens";

// Server-safe wrapper used in Suspense fallbacks and server components.
export function LoadingShell(props: Omit<LoadingProps, "prefersReducedMotion">) {
  return <LoadingExperience {...props} prefersReducedMotion={true} />;
}
