import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SubmitButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  size?: "default" | "lg";
  className?: string;
}

/**
 * Deep module for primary submit actions across all game modes.
 *
 * **Hides complexity:**
 * - Archival angular aesthetic (rounded-sm)
 * - Hard shadow with elevation on hover
 * - Vermilion brand color theming
 * - Consistent sizing and padding
 * - Hover lift animation
 * - Focus ring accessibility
 *
 * **Simple interface:**
 * Just specify action handler + label. All styling decisions internal.
 *
 * **Ousterhout Deep Module:**
 * - Interface complexity: 1 required prop (onClick)
 * - Implementation complexity: 10+ styling decisions
 * - Value = Consistency across all submit actions
 *
 * **Cross-Mode Consistency:**
 * Before: Order Mode used rounded-full, Classic used rounded-sm
 * After: Both modes use identical submit styling (architectural guarantee)
 *
 * @example
 * // Order Mode
 * <SubmitButton onClick={commitOrdering}>
 *   Submit My Timeline
 * </SubmitButton>
 *
 * @example
 * // Classic Mode
 * <SubmitButton onClick={commitRange}>
 *   Commit Range
 * </SubmitButton>
 */
export function SubmitButton({
  onClick,
  disabled,
  children,
  size = "lg",
  className,
}: SubmitButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      size={size}
      className={cn(
        // Core archival treatment - angular aesthetic
        "shadow-hard-lg hover:shadow-hard rounded-sm border-2",

        // Vermilion brand theming
        "bg-vermilion-500 hover:bg-vermilion-600 border-vermilion-600 text-white",

        // Interaction - lift on hover
        "font-semibold transition-all hover:translate-y-[-2px]",

        // Layout - full width mobile, auto desktop
        "relative z-10 w-full",
        size === "lg" && "text-base",

        className,
      )}
    >
      {children}
    </Button>
  );
}
