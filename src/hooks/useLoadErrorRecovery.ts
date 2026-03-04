"use client";

import { useEffect, useMemo, useRef } from "react";
import { classifyLoadError, getAutoRetryDelayMs } from "@/lib/errorRecovery";

interface UseLoadErrorRecoveryOptions {
  error: string | null;
  onRetry: () => void;
  maxAutoRetries?: number;
}

interface UseLoadErrorRecoveryResult {
  recoverability: "recoverable" | "unrecoverable";
}

export function useLoadErrorRecovery({
  error,
  onRetry,
  maxAutoRetries = 0,
}: UseLoadErrorRecoveryOptions): UseLoadErrorRecoveryResult {
  const retryCountRef = useRef(0);
  const latestErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (error !== latestErrorRef.current) {
      latestErrorRef.current = error;
      retryCountRef.current = 0;
    }
  }, [error]);

  const plan = useMemo(
    () =>
      error
        ? classifyLoadError(error)
        : { recoverability: "unrecoverable" as const, canAutoRetry: false },
    [error],
  );

  useEffect(() => {
    if (!error || !plan.canAutoRetry || retryCountRef.current >= maxAutoRetries) {
      return;
    }

    const delayMs = getAutoRetryDelayMs(retryCountRef.current);
    const timeoutId = window.setTimeout(() => {
      retryCountRef.current += 1;
      onRetry();
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [error, plan.canAutoRetry, maxAutoRetries, onRetry]);

  return {
    recoverability: plan.recoverability,
  };
}
