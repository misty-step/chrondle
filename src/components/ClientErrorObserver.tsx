"use client";

import { useEffect } from "react";
import { captureClientException } from "@/observability/reporter";

export function ClientErrorObserver() {
  useEffect(() => {
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

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
