"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { ClueCardVariation } from "./ClueCard";

interface HintButtonProps {
  variation: ClueCardVariation;
  isDark?: boolean;
}

/**
 * Hint button component rendered in 5 different design variations.
 * Shows 5 empty hint indicators + Take Hint button.
 */
export function HintButton({ variation, isDark = false }: HintButtonProps) {
  const content = {
    buttonText: "TAKE HINT",
  };

  switch (variation) {
    case "paper-stock":
      return <PaperStockHint content={content} isDark={isDark} />;
    case "archival-ledger":
      return <ArchivalLedgerHint content={content} isDark={isDark} />;
    case "museum-label":
      return <MuseumLabelHint content={content} isDark={isDark} />;
    case "index-card":
      return <IndexCardHint content={content} isDark={isDark} />;
    case "editorial-slate":
      return <EditorialSlateHint content={content} isDark={isDark} />;
    default:
      return <PaperStockHint content={content} isDark={isDark} />;
  }
}

interface HintContentProps {
  content: { buttonText: string };
  isDark: boolean;
}

// Hint indicators - 5 empty squares
function HintIndicators({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex gap-2" aria-label="5 hints available">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-3.5 w-3.5 rounded-[1px] border-2",
            isDark ? "border-[#6b7280]/50 bg-transparent" : "border-[#787c7e]/40 bg-transparent",
          )}
        />
      ))}
    </div>
  );
}

// 1. Paper Stock: Transparent bg, 2px green border, green text
function PaperStockHint({ content, isDark }: HintContentProps) {
  return (
    <div className="flex items-center justify-end gap-4">
      <HintIndicators isDark={isDark} />
      <button
        className={cn(
          "h-10 rounded border-2 bg-transparent px-4 text-sm font-semibold transition-all duration-150",
          isDark
            ? "border-[#6ee7b7] text-[#6ee7b7] hover:bg-[#6ee7b7]/10"
            : "border-[#2d6a4f] text-[#2d6a4f] hover:bg-[#2d6a4f]/5",
        )}
      >
        {content.buttonText}
      </button>
    </div>
  );
}

// 2. Archival Ledger: Filled #f0f7f4 bg, 1px green border
function ArchivalLedgerHint({ content, isDark }: HintContentProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-4 border-t px-4 py-3",
        isDark
          ? "border-[#3a3a3c] bg-[#1a2f25]/50"
          : "border-dashed border-[#d3d6da] bg-[#f0f7f4]/50",
      )}
    >
      <HintIndicators isDark={isDark} />
      <button
        className={cn(
          "h-10 rounded border px-4 text-sm font-semibold transition-all duration-150",
          isDark
            ? "border-[#6ee7b7] bg-[#1a2f25] text-[#6ee7b7] hover:bg-[#1a2f25]/80"
            : "border-[#2d6a4f] bg-[#f0f7f4] text-[#2d6a4f] hover:bg-[#e8f5ee]",
        )}
      >
        {content.buttonText}
      </button>
    </div>
  );
}

// 3. Museum Label: White bg, 3px green bottom border
function MuseumLabelHint({ content, isDark }: HintContentProps) {
  return (
    <div className="flex items-center justify-end gap-4">
      <HintIndicators isDark={isDark} />
      <button
        className={cn(
          "h-10 rounded bg-white px-4 text-sm font-semibold transition-all duration-150",
          isDark
            ? "border-b-[3px] border-[#6ee7b7] bg-[#1e1e1f] text-[#6ee7b7] hover:bg-[#6ee7b7]/10"
            : "border-b-[3px] border-[#2d6a4f] text-[#2d6a4f] hover:bg-[#f8f8f8]",
        )}
        style={{
          boxShadow: isDark ? "0 1px 2px rgba(0,0,0,0.2)" : "0 1px 2px rgba(0,0,0,0.05)",
        }}
      >
        {content.buttonText}
      </button>
    </div>
  );
}

// 4. Index Card: Matching warm bg, press-down shadow effect
function IndexCardHint({ content, isDark }: HintContentProps) {
  return (
    <div className="flex items-center justify-end gap-4">
      <HintIndicators isDark={isDark} />
      <button
        className={cn(
          "h-10 rounded border-2 px-4 text-sm font-semibold transition-all duration-100 active:translate-y-[1px]",
          isDark
            ? "border-[#6ee7b7]/50 bg-[#1a1915] text-[#6ee7b7] hover:border-[#6ee7b7]"
            : "border-[#2d6a4f]/30 bg-[#fffef8] text-[#2d6a4f] hover:border-[#2d6a4f]",
        )}
        style={{
          boxShadow: isDark ? "0 1px 0 rgba(0,0,0,0.3)" : "0 1px 0 rgba(0,0,0,0.1)",
        }}
      >
        {content.buttonText}
      </button>
    </div>
  );
}

// 5. Editorial Slate: Micro-elevation shadow on hover
function EditorialSlateHint({ content, isDark }: HintContentProps) {
  return (
    <div className="flex items-center justify-end gap-4">
      <HintIndicators isDark={isDark} />
      <button
        className={cn(
          "h-10 rounded px-4 text-sm font-semibold tracking-wider uppercase transition-all duration-200",
          isDark
            ? "bg-[#2a2a2b] text-[#6ee7b7] hover:shadow-[0_2px_8px_rgba(110,231,183,0.15)]"
            : "bg-white text-[#2d6a4f] hover:shadow-[0_2px_8px_rgba(45,106,79,0.12)]",
        )}
        style={{
          boxShadow: isDark ? "0 1px 2px rgba(0,0,0,0.3)" : "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        {content.buttonText}
      </button>
    </div>
  );
}
