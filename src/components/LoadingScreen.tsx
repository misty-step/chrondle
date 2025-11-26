"use client";

import { useReducedMotion } from "motion/react";
import React from "react";
import { LoadingExperience } from "@/components/loading/LoadingExperience";
import type { LoadingProps } from "@/components/loading/loadingTokens";
import { useDelayedRender } from "@/components/loading/useDelayedRender";

// Client wrapper that respects prefers-reduced-motion at runtime.
export function LoadingScreen(props: Omit<LoadingProps, "prefersReducedMotion">) {
  const prefersReducedMotion = useReducedMotion();
  const ready = useDelayedRender(props.delayMs ?? 150);
  if (!ready) return null;
  return <LoadingExperience {...props} prefersReducedMotion={prefersReducedMotion ?? undefined} />;
}
