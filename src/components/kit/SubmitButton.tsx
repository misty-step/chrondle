"use client";

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
 * Primary action with shared button feedback and mobile ergonomics.
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
        "bg-feedback-success text-feedback-success-foreground min-h-12 w-full rounded-lg font-semibold",
        "hover:bg-feedback-success-hover transition-colors duration-150",
        size === "lg" && "text-base",
        className,
      )}
    >
      {children}
    </Button>
  );
}
