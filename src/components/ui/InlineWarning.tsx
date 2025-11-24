import React from "react";
import { cn } from "@/lib/utils";

interface InlineWarningProps {
  children: React.ReactNode;
  variant?: "error" | "warning" | "info";
  className?: string;
}

/**
 * Archival inline warning/notification badge.
 *
 * Deep Module Design:
 * - Simple interface: children + optional variant
 * - Hides complexity: color mapping, material styling, archival aesthetic
 * - Scales infinitely: easy to add new variants
 *
 * Aesthetic:
 * - Archival paper badge with subtle rounding
 * - Color-coded borders and backgrounds
 * - Consistent with Chrondle's material system
 *
 * @example
 * <InlineWarning variant="error">
 *   Range too wide: 5026 years
 * </InlineWarning>
 */
export function InlineWarning({ children, variant = "warning", className }: InlineWarningProps) {
  const styles = {
    error:
      "bg-feedback-error/10 text-feedback-error border-feedback-error/30 dark:bg-feedback-error/20",
    warning:
      "bg-feedback-warning/10 text-feedback-warning border-feedback-warning/30 dark:bg-feedback-warning/20",
    info: "bg-feedback-info/10 text-feedback-info border-feedback-info/30 dark:bg-feedback-info/20",
  };

  return (
    <div
      className={cn(
        // Material archival badge
        "material-paper rounded-archival border-2 px-3 py-2 text-xs font-semibold",
        // Variant-specific colors
        styles[variant],
        // Custom className override
        className,
      )}
      role="alert"
      aria-live="polite"
    >
      {children}
    </div>
  );
}
