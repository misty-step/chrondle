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
 * Primary CTA button.
 * NYT Refined v3 styling, centralized.
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
        "h-11 rounded bg-[#4a9b7f] font-bold tracking-[0.04em] text-white uppercase",
        "transition-all duration-150 hover:translate-y-[-1px] hover:bg-[#3d8a6e]",

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
