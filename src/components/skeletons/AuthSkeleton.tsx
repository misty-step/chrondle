"use client";

import { cn } from "@/lib/utils";

interface AuthSkeletonProps {
  className?: string;
}

export function AuthSkeleton({ className }: AuthSkeletonProps) {
  return (
    <div
      className={cn("flex h-11 w-11 items-center justify-center", className)}
      role="status"
      aria-label="Loading authentication status"
    >
      <div className="bg-muted h-8 w-8 rounded-full motion-safe:animate-pulse" />
      <span className="sr-only">Loading authentication status</span>
    </div>
  );
}
