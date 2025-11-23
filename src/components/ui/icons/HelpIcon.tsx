"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface HelpIconProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const HelpIcon: React.FC<HelpIconProps> = ({ className, size = "sm" }) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <svg
      className={cn(
        "text-muted-foreground/60 hover:text-muted-foreground transition-colors",
        sizeClasses[size],
        className,
      )}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <circle cx="12" cy="17" r="1" />
    </svg>
  );
};
