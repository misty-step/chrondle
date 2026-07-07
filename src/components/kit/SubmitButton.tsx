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
        "bg-feedback-success h-11 rounded font-bold tracking-[0.04em] text-white uppercase",
        "hover:bg-feedback-success-hover transition-all duration-150 hover:translate-y-[-1px]",

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
