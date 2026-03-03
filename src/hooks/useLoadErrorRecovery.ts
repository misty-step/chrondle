"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { classifyLoadError, getAutoRetryDelayMs } from "@/lib/errorRecovery";

interface UseLoadErrorRecoveryOptions {
  error: string | null;
  onRetry: () => void;
  maxAutoRetries?: number;
  persistenceKey?: string;
}

interface UseLoadErrorRecoveryResult {
  recoverability: "recoverable" | "unrecoverable";
  canAutoRetry: boolean;
  retryCount: number;
}

export function useLoadErrorRecovery({
  error,
  onRetry,
  maxAutoRetries = 2,
  persistenceKey,
}: UseLoadErrorRecoveryOptions): UseLoadErrorRecoveryResult {
  const [retryCountSnapshot, setRetryCountSnapshot] = useState(() => {
    if (!persistenceKey || typeof window === "undefined") {
      return 0;
    }
    const persisted = window.sessionStorage.getItem(persistenceKey);
    return persisted ? Number.parseInt(persisted, 10) || 0 : 0;
  });
  const retryCountRef = useRef(retryCountSnapshot);
  const latestErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (error !== latestErrorRef.current) {
      latestErrorRef.current = error;
      retryCountRef.current = 0;
      if (persistenceKey && typeof window !== "undefined") {
        window.sessionStorage.removeItem(persistenceKey);
      }
    }
  }, [error, persistenceKey]);

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
      setRetryCountSnapshot(retryCountRef.current);
      if (persistenceKey) {
        window.sessionStorage.setItem(persistenceKey, String(retryCountRef.current));
      }
      onRetry();
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [error, plan.canAutoRetry, maxAutoRetries, onRetry, persistenceKey]);

  return {
    recoverability: plan.recoverability,
    canAutoRetry: plan.canAutoRetry && retryCountSnapshot < maxAutoRetries,
    retryCount: retryCountSnapshot,
  };
}
