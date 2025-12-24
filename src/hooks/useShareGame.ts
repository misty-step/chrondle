"use client";

import { useState, useCallback, useEffect } from "react";
import { generateShareText } from "@/lib/sharing/generator";
import { useWebShare } from "@/hooks/useWebShare";
import type { RangeGuess } from "@/types/range";

export type ShareStatus = "idle" | "success" | "error";

interface UseShareGameOptions {
  onSuccess?: () => void;
  onError?: () => void;
  targetYear?: number;
  missDistance?: number | null;
  missDirection?: "earlier" | "later" | null;
}

export function useShareGame(
  ranges: RangeGuess[],
  totalScore: number,
  hasWon: boolean,
  puzzleNumber?: number,
  options?: UseShareGameOptions,
) {
  const { onSuccess, onError, targetYear, missDistance, missDirection } = options || {};
  const { share, canShare, shareMethod, isSharing } = useWebShare();
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");

  const shareText = generateShareText(ranges, totalScore, hasWon, puzzleNumber, {
    targetYear,
    missDistance,
    missDirection,
  });

  // Reset status after delay
  useEffect(() => {
    if (shareStatus === "success" || shareStatus === "error") {
      const timer = setTimeout(() => {
        setShareStatus("idle");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [shareStatus]);

  const shareGame = useCallback(async () => {
    const success = await share(shareText);

    if (success) {
      setShareStatus("success");
      onSuccess?.();

      if (hasWon) {
        window.dispatchEvent(new CustomEvent("chrondle:celebrate"));
      }
    } else {
      setShareStatus("error");
      onError?.();
    }
  }, [share, shareText, hasWon, onSuccess, onError]);

  return {
    shareGame,
    shareStatus,
    canShare,
    shareMethod,
    isSharing,
  };
}
