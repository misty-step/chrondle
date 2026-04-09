"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { anonymousStreakStorage } from "@/lib/secureStorage";
import { anyPublicApi } from "@/lib/convexAnyApi";
import {
  calculateStreakUpdate,
  applyStreakUpdate,
  getUTCDateString,
} from "../../convex/lib/streakCalculation";
import { STREAK_CONFIG } from "@/lib/constants";
import { logger } from "@/lib/logger";

/**
 * Streak data structure (compatible with existing interface)
 */
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalGamesPlayed: number;
  lastPlayedDate: string;
  playedDates: string[]; // Kept for compatibility, but not used
  achievements: string[];
}

/**
 * Return type for the useStreak hook
 */
interface UseStreakReturn {
  streakData: StreakData;
  updateStreak: (hasWon: boolean) => StreakData;
  hasNewAchievement: boolean;
  newAchievement: string | null;
  clearNewAchievement: () => void;
}

/**
 * Dual-mode streak hook: Convex for authenticated, localStorage for anonymous
 *
 * This hook provides streak tracking for both authenticated and anonymous users:
 * - Authenticated: Reads from Convex users table, updates via submitGuess mutation
 * - Anonymous: Reads from localStorage, updates locally with same calculation logic
 * - Migration: Automatically merges anonymous streaks when user signs in
 *
 * Module Responsibility: Provide streak data and update mechanism regardless of auth state
 * Hidden Complexity: Auth state branching, migration logic, dual persistence layers
 */
export function useStreak(): UseStreakReturn {
  // Clerk authentication state
  const { isSignedIn, user: clerkUser } = useUser();

  // Convex user data (authenticated users only)
  const convexUser = useQuery(anyPublicApi.users.getCurrentUser);

  // Anonymous streak from localStorage
  const [anonymousStreak, setAnonymousStreak] = useState(() => {
    if (typeof window === "undefined") {
      return { currentStreak: 0, lastCompletedDate: "" };
    }
    const stored = anonymousStreakStorage.get();
    return stored || { currentStreak: 0, lastCompletedDate: "" };
  });

  // Achievement state
  const [hasNewAchievement, setHasNewAchievement] = useState(false);
  const [newAchievement, setNewAchievement] = useState<string | null>(null);

  // Migration state - track if we've already migrated this session
  const hasMigratedRef = useRef(false);

  // Convex mutation for merging anonymous streaks
  const mergeStreakMutation = useMutation(anyPublicApi.users.mergeAnonymousStreak);

  // Derive streak data based on auth state
  const streakData = useMemo((): StreakData => {
    if (isSignedIn && convexUser) {
      // Authenticated: use Convex data
      return {
        currentStreak: convexUser.currentStreak,
        longestStreak: convexUser.longestStreak,
        totalGamesPlayed: convexUser.totalPlays,
        lastPlayedDate: convexUser.lastCompletedDate || "",
        playedDates: [], // Not used, kept for compatibility
        achievements: [], // TODO: Implement achievements in Convex
      };
    } else {
      // Anonymous: use localStorage data
      return {
        currentStreak: anonymousStreak.currentStreak,
        longestStreak: anonymousStreak.currentStreak, // No history for anonymous
        totalGamesPlayed: 0, // Not tracked for anonymous
        lastPlayedDate: anonymousStreak.lastCompletedDate,
        playedDates: [], // Not used
        achievements: [], // Not tracked for anonymous
      };
    }
  }, [isSignedIn, convexUser, anonymousStreak]);

  // Update streak function - routes to correct persistence layer
  const updateStreak = useCallback(
    (hasWon: boolean): StreakData => {
      if (isSignedIn && convexUser) {
        // Authenticated: Calculate optimistic update while backend processes
        // submitGuess mutation handles actual persistence, but we provide immediate feedback
        const today = getUTCDateString();

        const update = calculateStreakUpdate(
          convexUser.lastCompletedDate || null,
          convexUser.currentStreak,
          today,
          hasWon,
        );

        // Apply optimistic update for immediate UI feedback
        const optimisticState = applyStreakUpdate(
          {
            currentStreak: convexUser.currentStreak,
            lastCompletedDate: convexUser.lastCompletedDate || null,
          },
          update,
        );

        logger.debug("[useStreak] Authenticated user - returning optimistic update:", {
          type: update.type,
          optimisticStreak: optimisticState.currentStreak,
          actualStreak: convexUser.currentStreak,
        });

        return {
          currentStreak: optimisticState.currentStreak,
          longestStreak: Math.max(convexUser.longestStreak, optimisticState.currentStreak),
          totalGamesPlayed: convexUser.totalPlays,
          lastPlayedDate: optimisticState.lastCompletedDate,
          playedDates: [],
          achievements: [],
        };
      } else {
        // Anonymous: calculate update and apply using discriminated union pattern
        let resultData: StreakData | null = null;

        setAnonymousStreak((prev) => {
          const today = getUTCDateString();

          // Calculate what should happen (explicit command pattern)
          const update = calculateStreakUpdate(
            prev.lastCompletedDate || null,
            prev.currentStreak,
            today,
            hasWon,
          );

          // Log the update for visibility
          logger.debug("[useStreak] Calculated streak update:", {
            type: update.type,
            reason: update.reason,
            currentStreak: prev.currentStreak,
          });

          // Apply the update to get new state
          const newState = applyStreakUpdate(prev, update);

          // Log same-day replays explicitly (this was the bug!)
          if (update.type === "no-change") {
            logger.debug("[useStreak] Same-day replay detected - preserving streak:", {
              preservedStreak: newState.currentStreak,
              date: newState.lastCompletedDate,
            });
          }

          // Save to localStorage (even for no-change, to ensure consistency)
          const saveSuccess = anonymousStreakStorage.set({
            currentStreak: newState.currentStreak,
            lastCompletedDate: newState.lastCompletedDate,
          });

          if (!saveSuccess) {
            logger.warn("[useStreak] Failed to save streak to localStorage");
          }

          // Prepare return data
          resultData = {
            currentStreak: newState.currentStreak,
            longestStreak: newState.currentStreak, // Anonymous users don't track history
            totalGamesPlayed: 0, // Not tracked for anonymous
            lastPlayedDate: newState.lastCompletedDate,
            playedDates: [],
            achievements: [],
          };

          return {
            currentStreak: newState.currentStreak,
            lastCompletedDate: newState.lastCompletedDate,
          };
        });

        // Return the calculated result
        return (
          resultData || {
            currentStreak: 0,
            longestStreak: 0,
            totalGamesPlayed: 0,
            lastPlayedDate: "",
            playedDates: [],
            achievements: [],
          }
        );
      }
    },
    [isSignedIn, convexUser], // Stable dependencies - no anonymousStreak
  );

  // Trigger migration when user signs in
  useEffect(() => {
    // Only migrate once per session
    if (hasMigratedRef.current) {
      return;
    }

    // Only migrate if signed in and Convex user exists
    // CRITICAL: Must wait for convexUser to be provisioned before attempting migration
    // First-time sign-ins won't have a Convex user until creation mutation completes
    if (!isSignedIn || !clerkUser || !convexUser) {
      return;
    }

    // Only migrate if there's an anonymous streak to merge
    if (anonymousStreak.currentStreak === 0 || !anonymousStreak.lastCompletedDate) {
      return;
    }

    // Trigger migration (mark as complete only AFTER success)
    logger.debug("[useStreak] Attempting anonymous streak migration:", {
      anonymousStreak: anonymousStreak.currentStreak,
      anonymousDate: anonymousStreak.lastCompletedDate,
    });

    mergeStreakMutation({
      anonymousStreak: anonymousStreak.currentStreak,
      anonymousLastCompletedDate: anonymousStreak.lastCompletedDate,
    })
      .then((result) => {
        // Mark as migrated only after successful merge
        hasMigratedRef.current = true;
        logger.info("[useStreak] Streak migration successful:", result);
        // Clear localStorage after successful migration
        anonymousStreakStorage.remove();
        setAnonymousStreak({ currentStreak: 0, lastCompletedDate: "" });
      })
      .catch((error) => {
        logger.error("[useStreak] Streak migration failed:", error);
        // Allow retry for "User not found" errors (Convex user not yet provisioned)
        if (error?.message?.includes("User not found")) {
          logger.warn("[useStreak] User not found - will retry on next render");
          // Don't set hasMigratedRef so effect can retry once user is created
        } else {
          // For other errors, mark as migrated to prevent infinite retries
          hasMigratedRef.current = true;
          logger.error("[useStreak] Non-recoverable migration error - will not retry");
        }
      });
  }, [isSignedIn, clerkUser, convexUser, anonymousStreak, mergeStreakMutation]);

  // Achievement checking (when streak increases)
  useEffect(() => {
    if (streakData.currentStreak > 0) {
      const achievement = STREAK_CONFIG.ACHIEVEMENTS.find(
        (a) => a.threshold === streakData.currentStreak,
      );

      if (achievement && !streakData.achievements.includes(achievement.name)) {
        setNewAchievement(`${achievement.emoji} ${achievement.description}`);
        setHasNewAchievement(true);
      }
    }
  }, [streakData.currentStreak, streakData.achievements]);

  const clearNewAchievement = useCallback(() => {
    setHasNewAchievement(false);
    setNewAchievement(null);
  }, []);

  return useMemo(
    () => ({
      streakData,
      updateStreak,
      hasNewAchievement,
      newAchievement,
      clearNewAchievement,
    }),
    [streakData, updateStreak, hasNewAchievement, newAchievement, clearNewAchievement],
  );
}
