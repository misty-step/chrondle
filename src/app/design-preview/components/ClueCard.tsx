"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type ClueCardVariation =
  | "paper-stock"
  | "archival-ledger"
  | "museum-label"
  | "index-card"
  | "editorial-slate";

interface ClueCardProps {
  variation: ClueCardVariation;
  isDark?: boolean;
}

/**
 * Clue card component rendered in 5 different design variations.
 * Each variation has distinct styling for stakeholder comparison.
 */
export function ClueCard({ variation, isDark = false }: ClueCardProps) {
  const content = {
    label: "PRIMARY CLUE",
    clue: "Mother Teresa dies in Calcutta at age 87",
  };

  switch (variation) {
    case "paper-stock":
      return <PaperStockCard content={content} isDark={isDark} />;
    case "archival-ledger":
      return <ArchivalLedgerCard content={content} isDark={isDark} />;
    case "museum-label":
      return <MuseumLabelCard content={content} isDark={isDark} />;
    case "index-card":
      return <IndexCardCard content={content} isDark={isDark} />;
    case "editorial-slate":
      return <EditorialSlateCard content={content} isDark={isDark} />;
    default:
      return <PaperStockCard content={content} isDark={isDark} />;
  }
}

interface CardContentProps {
  content: { label: string; clue: string };
  isDark: boolean;
}

// 1. Paper Stock: White card with subtle shadow, green top border
function PaperStockCard({ content, isDark }: CardContentProps) {
  return (
    <div
      className={cn("relative rounded bg-white px-6 py-5", isDark && "bg-[#1e1e1f]")}
      style={{
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        borderTop: "2px solid #2d6a4f",
      }}
    >
      <div
        className={cn(
          "mb-2 text-xs font-semibold tracking-wider uppercase",
          isDark ? "text-[#6ee7b7]" : "text-[#2d6a4f]",
        )}
      >
        {content.label}
      </div>
      <p
        className={cn(
          "font-body text-lg leading-relaxed",
          isDark ? "text-[#e4e5f1]" : "text-[#1a1a1b]",
        )}
      >
        {content.clue}
      </p>
    </div>
  );
}

// 2. Archival Ledger: Off-white bg, header strip, double-border
function ArchivalLedgerCard({ content, isDark }: CardContentProps) {
  return (
    <div
      className={cn("overflow-hidden rounded bg-[#fafafa]", isDark && "bg-[#1a1a1b]")}
      style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)" }}
    >
      {/* Header strip */}
      <div
        className={cn(
          "border-b border-dashed px-6 py-2",
          isDark ? "border-[#3a3a3c] bg-[#1a2f25]" : "border-[#d3d6da] bg-[#f0f7f4]",
        )}
      >
        <span
          className={cn(
            "text-xs font-semibold tracking-wider uppercase",
            isDark ? "text-[#6ee7b7]" : "text-[#2d6a4f]",
          )}
        >
          {content.label}
        </span>
      </div>

      {/* Content with inner dashed border effect */}
      <div
        className={cn("px-6 py-5", isDark ? "border-[#3a3a3c]" : "border-[#d3d6da]")}
        style={{
          backgroundImage: isDark
            ? "repeating-linear-gradient(0deg, transparent, transparent 29px, #3a3a3c 29px, #3a3a3c 30px)"
            : "repeating-linear-gradient(0deg, transparent, transparent 29px, #e5e5e5 29px, #e5e5e5 30px)",
          backgroundSize: "100% 30px",
          lineHeight: "30px",
        }}
      >
        <p className={cn("font-body text-lg", isDark ? "text-[#e4e5f1]" : "text-[#1a1a1b]")}>
          {content.clue}
        </p>
      </div>
    </div>
  );
}

// 3. Museum Label: Inset shadow, left accent bar, sharp radius
function MuseumLabelCard({ content, isDark }: CardContentProps) {
  return (
    <div
      className={cn("relative rounded-[2px] bg-white px-6 py-5", isDark && "bg-[#1e1e1f]")}
      style={{
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.03)",
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute top-0 bottom-0 left-0 w-1 rounded-l-[2px]"
        style={{ backgroundColor: isDark ? "#6ee7b7" : "#2d6a4f" }}
      />

      <div
        className={cn(
          "mb-2 text-xs font-semibold tracking-wider uppercase",
          isDark ? "text-[#6ee7b7]" : "text-[#2d6a4f]",
        )}
      >
        {content.label}
      </div>
      <p
        className={cn(
          "font-body text-lg leading-relaxed",
          isDark ? "text-[#e4e5f1]" : "text-[#1a1a1b]",
        )}
      >
        {content.clue}
      </p>
    </div>
  );
}

// 4. Index Card: Warm white, slight rotation, asymmetric radius
function IndexCardCard({ content, isDark }: CardContentProps) {
  return (
    <div
      className={cn("bg-[#fffef8] px-6 py-5", isDark && "bg-[#1a1915]")}
      style={{
        borderRadius: "3px 3px 3px 12px",
        boxShadow: "0 2px 0 rgba(0,0,0,0.08)",
        transform: "rotate(-0.3deg)",
      }}
    >
      {/* Corner notch detail */}
      <div
        className={cn(
          "mb-3 flex items-center gap-2 border-b pb-2",
          isDark ? "border-[#3a3a3c]" : "border-[#e5e5e5]",
        )}
      >
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: isDark ? "#6ee7b7" : "#2d6a4f" }}
        />
        <span
          className={cn(
            "text-xs font-semibold tracking-wider uppercase",
            isDark ? "text-[#6ee7b7]" : "text-[#2d6a4f]",
          )}
        >
          {content.label}
        </span>
      </div>

      <p
        className={cn(
          "font-body text-lg leading-relaxed",
          isDark ? "text-[#e4e5f1]" : "text-[#1a1a1b]",
        )}
        style={{ transform: "rotate(0.1deg)" }}
      >
        {content.clue}
      </p>
    </div>
  );
}

// 5. Editorial Slate: 4-layer shadow, centered text, small caps header
function EditorialSlateCard({ content, isDark }: CardContentProps) {
  return (
    <div
      className={cn(
        "mx-auto max-w-[40ch] rounded-lg bg-white px-8 py-6 text-center",
        isDark && "bg-[#1e1e1f]",
      )}
      style={{
        boxShadow: isDark
          ? "0 1px 1px rgba(0,0,0,0.15), 0 2px 2px rgba(0,0,0,0.15), 0 4px 4px rgba(0,0,0,0.15), 0 8px 8px rgba(0,0,0,0.15)"
          : "0 1px 1px rgba(0,0,0,0.05), 0 2px 2px rgba(0,0,0,0.05), 0 4px 4px rgba(0,0,0,0.05), 0 8px 8px rgba(0,0,0,0.05)",
      }}
    >
      {/* Small caps header with decorative hairlines */}
      <div className="mb-4 flex items-center justify-center gap-3">
        <div className="h-px w-8" style={{ backgroundColor: isDark ? "#3a3a3c" : "#d3d6da" }} />
        <span
          className={cn(
            "text-xs font-medium tracking-[0.2em] uppercase",
            isDark ? "text-[#6ee7b7]" : "text-[#2d6a4f]",
          )}
          style={{ fontVariant: "small-caps" }}
        >
          {content.label.toLowerCase()}
        </span>
        <div className="h-px w-8" style={{ backgroundColor: isDark ? "#3a3a3c" : "#d3d6da" }} />
      </div>

      <p
        className={cn(
          "font-body text-lg leading-relaxed",
          isDark ? "text-[#e4e5f1]" : "text-[#1a1a1b]",
        )}
      >
        {content.clue}
      </p>
    </div>
  );
}
