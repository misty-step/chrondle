"use client";

import { useCallback, useRef, useState, useEffect } from "react";

interface SwipeGestureState {
  startX: number;
  startY: number;
  startTime: number;
  isActive: boolean;
}

interface UseSwipeNavigationProps {
  /** Total number of available hints */
  totalHints: number;
  /** Currently active hint index */
  currentIndex: number;
  /** Callback when navigation occurs */
  onNavigate: (index: number) => void;
  /** Whether swipe navigation is enabled */
  enabled?: boolean;
}

interface SwipeNavigationReturn {
  /** Touch event handlers to attach to swipe area */
  touchHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
  /** Current swipe progress for visual feedback (-1 to 1) */
  swipeProgress: number;
  /** Whether a swipe gesture is currently active */
  isGestureActive: boolean;
}

// Mathematical constants optimized for mobile gesture recognition
const GESTURE_CONFIG = {
  SWIPE_THRESHOLD: 60, // Minimum horizontal distance (px)
  VELOCITY_THRESHOLD: 0.4, // Minimum velocity (px/ms)
  MAX_VERTICAL_DEVIATION: 100, // Maximum Y-axis deviation before canceling
  MIN_GESTURE_TIME: 50, // Minimum gesture duration (ms)
  MAX_GESTURE_TIME: 800, // Maximum gesture duration (ms)
  PROGRESS_SENSITIVITY: 0.3, // Visual feedback sensitivity
} as const;

/**
 * Custom hook for swipe-based hint navigation with mathematical precision
 *
 * Implements optimal gesture recognition using:
 * - Vector-based direction detection
 * - Velocity-aware threshold calculation
 * - Hysteresis to prevent accidental triggers
 * - Performance-optimized touch event handling
 */
export function useSwipeNavigation({
  totalHints,
  currentIndex,
  onNavigate,
  enabled = true,
}: UseSwipeNavigationProps): SwipeNavigationReturn {
  const gestureRef = useRef<SwipeGestureState | null>(null);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isGestureActive, setIsGestureActive] = useState(false);

  // Performance optimization: use RAF for smooth visual updates
  const rafRef = useRef<number | undefined>(undefined);

  const updateSwipeProgress = useCallback((progress: number) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      setSwipeProgress(Math.max(-1, Math.min(1, progress)));
    });
  }, []);

  // Mathematical gesture evaluation with hysteresis
  const evaluateGesture = useCallback(
    (
      deltaX: number,
      deltaY: number,
      velocity: number,
      duration: number,
    ): "left" | "right" | "cancel" => {
      // Vector magnitude and direction analysis
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const horizontalRatio = Math.abs(deltaX) / distance;

      // Reject vertical or diagonal gestures
      if (Math.abs(deltaY) > GESTURE_CONFIG.MAX_VERTICAL_DEVIATION) {
        return "cancel";
      }

      // Require predominantly horizontal movement
      if (horizontalRatio < 0.7) {
        return "cancel";
      }

      // Duration bounds check
      if (
        duration < GESTURE_CONFIG.MIN_GESTURE_TIME ||
        duration > GESTURE_CONFIG.MAX_GESTURE_TIME
      ) {
        return "cancel";
      }

      // Threshold analysis: distance OR velocity based
      const meetsDistanceThreshold = Math.abs(deltaX) >= GESTURE_CONFIG.SWIPE_THRESHOLD;
      const meetsVelocityThreshold = velocity >= GESTURE_CONFIG.VELOCITY_THRESHOLD;

      if (!meetsDistanceThreshold && !meetsVelocityThreshold) {
        return "cancel";
      }

      return deltaX > 0 ? "right" : "left";
    },
    [],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || e.touches.length !== 1) return;

      const touch = e.touches[0];
      gestureRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: performance.now(),
        isActive: true,
      };

      setIsGestureActive(true);

      // Cancel any existing RAF updates
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      // Prevent scroll during gesture recognition
      e.preventDefault();
    },
    [enabled],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !gestureRef.current?.isActive || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const gesture = gestureRef.current;

      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;

      // Cancel if vertical movement exceeds threshold
      if (Math.abs(deltaY) > GESTURE_CONFIG.MAX_VERTICAL_DEVIATION) {
        gestureRef.current.isActive = false;
        setIsGestureActive(false);
        updateSwipeProgress(0);
        return;
      }

      // Calculate progress for visual feedback
      const progress =
        deltaX / (GESTURE_CONFIG.SWIPE_THRESHOLD * GESTURE_CONFIG.PROGRESS_SENSITIVITY);
      updateSwipeProgress(progress);

      // Prevent default scrolling during horizontal swipes
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        e.preventDefault();
      }
    },
    [enabled, updateSwipeProgress],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !gestureRef.current?.isActive) return;

      const gesture = gestureRef.current;
      const endTime = performance.now();
      const duration = endTime - gesture.startTime;

      // Get final touch position from changedTouches (last touch point)
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;

      // Calculate velocity (px/ms)
      const velocity = Math.abs(deltaX) / Math.max(duration, 1);

      // Evaluate gesture mathematically
      const result = evaluateGesture(deltaX, deltaY, velocity, duration);

      // Navigation logic with bounds checking
      if (result !== "cancel") {
        let nextIndex = currentIndex;

        if (result === "left" && currentIndex > 0) {
          nextIndex = currentIndex - 1;
        } else if (result === "right" && currentIndex < totalHints - 1) {
          nextIndex = currentIndex + 1;
        }

        if (nextIndex !== currentIndex) {
          // Add haptic feedback for successful navigation
          if ("vibrate" in navigator) {
            navigator.vibrate(15);
          }

          onNavigate(nextIndex);
        }
      }

      // Reset gesture state
      gestureRef.current = null;
      setIsGestureActive(false);
      updateSwipeProgress(0);
    },
    [enabled, currentIndex, totalHints, onNavigate, evaluateGesture, updateSwipeProgress],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Handle navigation bounds when totalHints or currentIndex changes
  useEffect(() => {
    if (currentIndex >= totalHints) {
      updateSwipeProgress(0);
    }
  }, [currentIndex, totalHints, updateSwipeProgress]);

  return {
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    swipeProgress,
    isGestureActive,
  };
}
