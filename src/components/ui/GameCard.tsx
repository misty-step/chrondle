import React from "react";
import { cn } from "@/lib/utils";

interface GameCardProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "muted";
  padding?: "compact" | "default" | "spacious";
  className?: string;
  as?: "section" | "div" | "article";
}

/**
 * Deep module for game surfaces - cards, panels, sections.
 *
 * **Hides complexity:**
 * - Archival angular aesthetic (rounded-sm)
 * - Hard shadow system (shadow-hard)
 * - Solid backgrounds (no translucency)
 * - Responsive padding
 * - Semantic color variants
 *
 * **Simple interface:**
 * Just specify variant + content. All styling decisions internal.
 *
 * **Ousterhout Deep Module:**
 * - Interface complexity: 2 props (variant, padding)
 * - Implementation complexity: 15+ styling decisions
 * - Value = Functionality - Interface ≈ 13 decisions hidden
 *
 * @example
 * // Default card
 * <GameCard>Content here</GameCard>
 *
 * @example
 * // Success variant with compact padding
 * <GameCard variant="success" padding="compact">
 *   Correct event ordering!
 * </GameCard>
 *
 * @example
 * // Muted background for comparison grids
 * <GameCard variant="muted" padding="spacious">
 *   Event comparison grid
 * </GameCard>
 */
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
        // Core archival treatment - angular aesthetic, hard shadows, solid surfaces
        "bg-surface-elevated border-outline-default shadow-hard rounded-sm border-2",

        // Responsive padding (mobile-first, desktop enhancement)
        padding === "compact" && "p-3 md:p-4",
        padding === "default" && "p-4 md:p-6",
        padding === "spacious" && "p-6 md:p-8",

        // Semantic variants - feedback and emphasis
        variant === "success" && "bg-feedback-success/5 border-feedback-success/20",
        variant === "muted" && "bg-muted/30 border-border",

        className,
      )}
    >
      {children}
    </Component>
  );
}
