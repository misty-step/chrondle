"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface VariationPreviewProps {
  number: number;
  name: string;
  description: string;
  children: (mode: "light" | "dark") => React.ReactNode;
  className?: string;
}

/**
 * Reusable container for design variation previews.
 * Shows variation name, description, and renders content in both light and dark mode contexts.
 */
export function VariationPreview({
  number,
  name,
  description,
  children,
  className,
}: VariationPreviewProps) {
  return (
    <section className={cn("border-b border-[#d3d6da] py-12 dark:border-[#3a3a3c]", className)}>
      {/* Section Header */}
      <div className="mb-8 px-6 lg:px-12">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-sm text-[#787c7e]">{number}.</span>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-[#1a1a1b] dark:text-[#e4e5f1]">
            {name}
          </h2>
        </div>
        <p className="mt-1 pl-8 text-[#787c7e]">{description}</p>
      </div>

      {/* Side-by-Side Previews */}
      <div className="grid gap-6 px-6 lg:grid-cols-2 lg:px-12">
        {/* Light Mode Preview */}
        <PreviewCard mode="light">{children("light")}</PreviewCard>

        {/* Dark Mode Preview */}
        <PreviewCard mode="dark">{children("dark")}</PreviewCard>
      </div>
    </section>
  );
}

interface PreviewCardProps {
  mode: "light" | "dark";
  children: React.ReactNode;
}

function PreviewCard({ mode, children }: PreviewCardProps) {
  const isDark = mode === "dark";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border",
        isDark ? "border-[#3a3a3c] bg-[#121213]" : "border-[#d3d6da] bg-[#f8f8f8]",
      )}
    >
      {/* Mode Label */}
      <div
        className={cn(
          "border-b px-4 py-2 text-xs font-semibold tracking-wider uppercase",
          isDark
            ? "border-[#3a3a3c] bg-[#1e1e1f] text-[#9ca3af]"
            : "border-[#d3d6da] bg-white text-[#787c7e]",
        )}
      >
        {isDark ? "Dark Mode" : "Light Mode"}
      </div>

      {/* Preview Content Area */}
      <div className={cn("p-6", isDark ? "bg-[#121213]" : "bg-[#f0f0f0]")}>{children}</div>
    </div>
  );
}
