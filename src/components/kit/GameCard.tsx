import React from "react";
import { cn } from "@/lib/utils";

interface GameCardProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "muted";
  padding?: "compact" | "default" | "spacious";
  className?: string;
  as?: "section" | "div" | "article";
}

/** Shared game surfaces with responsive spacing and semantic feedback. */
export function GameCard({
  children,
  variant = "default",
  padding = "default",
  className,
  as: Component = "section",
}: GameCardProps) {
  return (
    <Component
      className={cn(
        "border-border bg-surface-elevated min-w-0 rounded-xl border",

        // Responsive padding (mobile-first, desktop enhancement)
        padding === "compact" && "p-3 md:p-4",
        padding === "default" && "p-4 md:p-6",
        padding === "spacious" && "p-6 md:p-8",

        // Semantic variants - feedback and emphasis
        variant === "success" && "bg-feedback-success/5 border-feedback-success/20",
        variant === "muted" && "bg-surface-inset border-border",

        className,
      )}
    >
      {children}
    </Component>
  );
}
