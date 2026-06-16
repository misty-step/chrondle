"use client";

import { useEffect } from "react";
import { captureClientException } from "@/observability/reporter";

interface ChrondleCanaryApi {
  captureException(error: unknown, extras?: Record<string, unknown>): void;
  captureMessage(message: string, extras?: Record<string, unknown>): void;
}

declare global {
  interface Window {
    ChrondleCanary?: ChrondleCanaryApi;
  }
}

export function CanaryClientObserver() {
  useEffect(() => {
    const previousApi = window.ChrondleCanary;

    const handleError = (event: ErrorEvent) => {
      captureClientException(event.error ?? new Error(event.message || "Unhandled browser error"), {
        level: "error",
        tags: { source: "window.error" },
        extras: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error
          ? event.reason
          : new Error(event.reason ? String(event.reason) : "Unhandled promise rejection");

      captureClientException(reason, {
        level: "error",
        tags: { source: "window.unhandledrejection" },
      });
    };

    window.ChrondleCanary = {
      captureException(error, extras) {
        captureClientException(error, {
          level: "error",
          tags: { source: "manual.smoke" },
          extras,
        });
      },
      captureMessage(message, extras) {
        captureClientException(new Error(message), {
          level: "info",
          tags: { source: "manual.smoke" },
          extras,
        });
      },
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);

      if (previousApi) {
        window.ChrondleCanary = previousApi;
      } else {
        delete window.ChrondleCanary;
      }
    };
  }, []);

  return null;
}
