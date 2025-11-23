"use client";

import { cn } from "@/lib/utils";

interface AuthSkeletonProps {
  className?: string;
}

export function AuthSkeleton({ className }: AuthSkeletonProps) {
  return (
    <div
      className={cn("flex h-10 w-10 items-center justify-center", className)}
      role="status"
      aria-label="Loading authentication status"
    >
      <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
      <span className="sr-only">Loading authentication status</span>
    </div>
  );
}
