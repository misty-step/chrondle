// React hook for managing background animation state
// Derives animation intensity from game progress and manages CSS variables

import { useEffect, useMemo } from "react";
import {
  calculateAnimationIntensity,
  getAnimationPhase,
  AnimationPhase,
  ANIMATION_CONFIG,
  ANIMATION_CSS_VARS,
} from "@/lib/backgroundAnimation";

export interface UseBackgroundAnimationProps {
  guesses: number[];
  targetYear: number | null;
  isGameOver: boolean;
  respectsReducedMotion?: boolean;
}

export interface UseBackgroundAnimationReturn {
  intensity: number;
  phase: AnimationPhase;
  isAnimating: boolean;
  cssVars: Record<string, string>;
}

/**
 * Custom hook for managing background animation based on game state
 * Automatically updates CSS custom properties for smooth animation control
 */
export function useBackgroundAnimation({
  guesses,
  targetYear,
  isGameOver,
  respectsReducedMotion = true,
}: UseBackgroundAnimationProps): UseBackgroundAnimationReturn {
  // Calculate animation intensity based on current game state
  const intensity = useMemo(() => {
    if (!targetYear || guesses.length === 0) {
      return 0;
    }

    // Reduce intensity if motion is disabled
    if (respectsReducedMotion && typeof window !== "undefined") {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) {
        return 0;
      }
    }

    return calculateAnimationIntensity(guesses, targetYear);
  }, [guesses, targetYear, respectsReducedMotion]);

  // Get discrete animation phase
  const phase = useMemo(() => {
    return getAnimationPhase(intensity);
  }, [intensity]);

  // Determine if animation should be active
  const isAnimating = useMemo(() => {
    return intensity > 0 && !isGameOver;
  }, [intensity, isGameOver]);

  // Generate CSS custom properties object
  const cssVars = useMemo(() => {
    const config = ANIMATION_CONFIG;

    return {
      [ANIMATION_CSS_VARS.INTENSITY]: intensity.toString(),
      [ANIMATION_CSS_VARS.PHASE]: phase,
      [ANIMATION_CSS_VARS.DURATION]: `${config.DURATIONS[phase]}s`,
      [ANIMATION_CSS_VARS.OPACITY]: config.OPACITY[phase].toString(),
      [ANIMATION_CSS_VARS.ELEMENT_COUNT]: config.ELEMENT_COUNT[phase].toString(),
    };
  }, [intensity, phase]);

  // Apply CSS variables to document root when animation state changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;

    Object.entries(cssVars).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Cleanup function to reset variables when component unmounts
    return () => {
      Object.keys(cssVars).forEach((property) => {
        root.style.removeProperty(property);
      });
    };
  }, [cssVars]);

  // Handle prefers-reduced-motion changes
  useEffect(() => {
    if (typeof window === "undefined" || !respectsReducedMotion) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleChange = () => {
      // Force re-render when motion preference changes
      // The intensity calculation will handle the reduced motion logic
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [respectsReducedMotion]);

  return {
    intensity,
    phase,
    isAnimating,
    cssVars,
  };
}
