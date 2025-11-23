// Background Animation Component for Chrondle
// Renders ambient parchment and star animations based on game progress

"use client";

import React from "react";
import { useBackgroundAnimation } from "@/hooks/useBackgroundAnimation";
import { AnimationPhase, ANIMATION_CONFIG } from "@/lib/backgroundAnimation";
import "@/styles/background-animation.css";

export interface BackgroundAnimationProps {
  guesses: number[];
  targetYear: number | null;
  isGameOver: boolean;
  className?: string;
}

/**
 * BackgroundAnimation component provides ambient visual feedback
 * that intensifies as player guesses get closer to the target year
 */
export function BackgroundAnimation({
  guesses,
  targetYear,
  isGameOver,
  className = "",
}: BackgroundAnimationProps) {
  const { phase, isAnimating } = useBackgroundAnimation({
    guesses,
    targetYear,
    isGameOver,
    respectsReducedMotion: true,
  });

  // Don't render anything if animation is disabled or no animation needed
  if (!isAnimating || phase === AnimationPhase.Idle) {
    return null;
  }

  // Generate stars based on current animation phase
  const starCount = ANIMATION_CONFIG.ELEMENT_COUNT[phase];
  const stars = Array.from({ length: starCount }, (_, index) => {
    // Vary star sizes based on index for visual interest
    let starClass = "star";
    if (index % 5 === 0) {
      starClass += " star--large";
    } else if (index % 3 === 0) {
      starClass += " star--medium";
    } else {
      starClass += " star--small";
    }

    return (
      <div
        key={index}
        className={starClass}
        style={{
          // Distribute stars across viewport with some randomness
          // but keep positions consistent for each phase
          animationDelay: `${(index * 0.3) % parseFloat(ANIMATION_CONFIG.DURATIONS[phase].toString())}s`,
        }}
      />
    );
  });

  return (
    <div className={`background-animation ${className}`}>
      {/* Parchment texture layer */}
      <div className="parchment-layer" />

      {/* Stars layer with phase-specific positioning */}
      <div className="stars-layer" data-phase={phase}>
        {stars}
      </div>
    </div>
  );
}

export default BackgroundAnimation;
