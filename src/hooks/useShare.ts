"use client";

import { useState, useCallback, useEffect } from "react";
import { useWebShare } from "@/hooks/useWebShare";

export type ShareStatus = "idle" | "success" | "error";

interface UseShareOptions {
  onSuccess?: () => void;
  onError?: () => void;
}

export function useShare(options?: UseShareOptions) {
  const { onSuccess, onError } = options || {};
  const { share: webShare, canShare, shareMethod, isSharing } = useWebShare();
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");

  // Reset status after delay
  useEffect(() => {
    if (shareStatus === "success" || shareStatus === "error") {
      const timer = setTimeout(() => {
        setShareStatus("idle");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [shareStatus]);

  const share = useCallback(
    async (text: string) => {
      const success = await webShare(text);

      if (success) {
        setShareStatus("success");
        onSuccess?.();
      } else {
        setShareStatus("error");
        onError?.();
      }
      return success;
    },
    [webShare, onSuccess, onError],
  );

  return {
    share,
    shareStatus,
    canShare,
    shareMethod,
    isSharing,
  };
}
