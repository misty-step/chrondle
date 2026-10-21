import { captureClientException } from "@/observability/reporter";

export function reportClassicSubmissionError(stage: "save" | "after_save" | "analytics"): void {
  try {
    captureClientException(new Error("Classic submission encountered an error"), {
      tags: { source: "classic_submission", action: "submitRange", stage },
    });
  } catch {
    // Reporting must not change the accepted outcome or prevent recovery.
  }
}
