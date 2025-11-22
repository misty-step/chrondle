import React from "react";
import { cn } from "@/lib/utils";

interface LayoutContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Single source of truth for page width and horizontal padding.
 * Keeps header and body aligned across modes.
 */
export function LayoutContainer({ children, className }: LayoutContainerProps) {
  return <div className={cn("mx-auto w-full max-w-4xl px-6 sm:px-0", className)}>{children}</div>;
}
