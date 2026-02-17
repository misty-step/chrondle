"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { ClueCardVariation } from "./ClueCard";

interface GuessInputProps {
  variation: ClueCardVariation;
  isDark?: boolean;
}

/**
 * Guess input component rendered in 5 different design variations.
 * Shows Year range input with BC/AD toggles and submit button.
 */
export function GuessInput({ variation, isDark = false }: GuessInputProps) {
  const content = {
    label: "YOUR GUESS",
    fromYear: "0",
    toYear: "0",
    eraFrom: "AD",
    eraTo: "AD",
    arrow: "→",
    submitText: "LOCK IN FINAL GUESS",
  };

  switch (variation) {
    case "paper-stock":
      return <PaperStockInput content={content} isDark={isDark} />;
    case "archival-ledger":
      return <ArchivalLedgerInput content={content} isDark={isDark} />;
    case "museum-label":
      return <MuseumLabelInput content={content} isDark={isDark} />;
    case "index-card":
      return <IndexCardInput content={content} isDark={isDark} />;
    case "editorial-slate":
      return <EditorialSlateInput content={content} isDark={isDark} />;
    default:
      return <PaperStockInput content={content} isDark={isDark} />;
  }
}

interface InputContentProps {
  content: {
    label: string;
    fromYear: string;
    toYear: string;
    eraFrom: string;
    eraTo: string;
    arrow: string;
    submitText: string;
  };
  isDark: boolean;
}

// Year input field component
function YearField({ year, era, isDark }: { year: string; era: string; isDark: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "min-w-[3ch] text-center font-mono text-2xl font-medium tabular-nums",
          isDark ? "text-[#e4e5f1]" : "text-[#1a1a1b]",
        )}
      >
        {year}
      </span>
      <button
        className={cn(
          "rounded px-2 py-1 text-xs font-medium transition-colors",
          isDark
            ? "bg-[#2a2a2b] text-[#9ca3af] hover:bg-[#3a3a3c]"
            : "bg-[#f0f0f0] text-[#787c7e] hover:bg-[#e5e5e5]",
        )}
      >
        {era}
      </button>
    </div>
  );
}

// 1. Paper Stock: Clean input with subtle shadow
function PaperStockInput({ content, isDark }: InputContentProps) {
  return (
    <div
      className={cn("rounded bg-white p-5", isDark && "bg-[#1e1e1f]")}
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div
        className={cn(
          "mb-4 text-xs font-semibold tracking-wider uppercase",
          isDark ? "text-[#9ca3af]" : "text-[#787c7e]",
        )}
      >
        {content.label}
      </div>

      <div className="mb-5 flex items-center justify-center gap-4">
        <YearField year={content.fromYear} era={content.eraFrom} isDark={isDark} />
        <span className={cn("text-xl", isDark ? "text-[#6b7280]" : "text-[#d3d6da]")}>
          {content.arrow}
        </span>
        <YearField year={content.toYear} era={content.eraTo} isDark={isDark} />
      </div>

      <button
        className={cn(
          "w-full rounded py-3 text-sm font-bold tracking-wide uppercase transition-all duration-150",
          isDark
            ? "bg-[#6ee7b7] text-[#121213] hover:bg-[#5dd6a6]"
            : "bg-[#4a9b7f] text-white hover:bg-[#3d8a6e]",
        )}
      >
        {content.submitText}
      </button>
    </div>
  );
}

// 2. Archival Ledger: Flat design with ledger lines
function ArchivalLedgerInput({ content, isDark }: InputContentProps) {
  return (
    <div
      className={cn(
        "border-t-2 bg-[#fafafa] p-5",
        isDark ? "border-[#3a3a3c] bg-[#1a1a1b]" : "border-[#2d6a4f] bg-[#fafafa]",
      )}
    >
      <div
        className={cn(
          "mb-4 text-xs font-semibold tracking-wider uppercase",
          isDark ? "text-[#9ca3af]" : "text-[#787c7e]",
        )}
      >
        {content.label}
      </div>

      <div
        className="mb-5 flex items-center justify-center gap-4 py-3"
        style={{
          backgroundImage: isDark
            ? "repeating-linear-gradient(0deg, transparent, transparent 39px, #3a3a3c 39px, #3a3a3c 40px)"
            : "repeating-linear-gradient(0deg, transparent, transparent 39px, #e5e5e5 39px, #e5e5e5 40px)",
          backgroundSize: "100% 40px",
        }}
      >
        <YearField year={content.fromYear} era={content.eraFrom} isDark={isDark} />
        <span className={cn("text-xl", isDark ? "text-[#6b7280]" : "text-[#d3d6da]")}>
          {content.arrow}
        </span>
        <YearField year={content.toYear} era={content.eraTo} isDark={isDark} />
      </div>

      <button
        className={cn(
          "w-full border-2 py-3 text-sm font-bold tracking-wide uppercase transition-all duration-150",
          isDark
            ? "border-[#6ee7b7] bg-transparent text-[#6ee7b7] hover:bg-[#6ee7b7]/10"
            : "border-[#2d6a4f] bg-transparent text-[#2d6a4f] hover:bg-[#2d6a4f]/5",
        )}
      >
        {content.submitText}
      </button>
    </div>
  );
}

// 3. Museum Label: Inset styling with left accent
function MuseumLabelInput({ content, isDark }: InputContentProps) {
  return (
    <div
      className={cn("relative rounded-[2px] bg-white p-5", isDark && "bg-[#1e1e1f]")}
      style={{ boxShadow: "inset 0 2px 4px rgba(0,0,0,0.03)" }}
    >
      {/* Left accent */}
      <div
        className="absolute top-0 bottom-0 left-0 w-1 rounded-l-[2px]"
        style={{ backgroundColor: isDark ? "#6ee7b7" : "#2d6a4f" }}
      />

      <div
        className={cn(
          "mb-4 text-xs font-semibold tracking-wider uppercase",
          isDark ? "text-[#9ca3af]" : "text-[#787c7e]",
        )}
      >
        {content.label}
      </div>

      <div className="mb-5 flex items-center justify-center gap-4 rounded bg-white/50 p-4 dark:bg-[#27272a]/50">
        <YearField year={content.fromYear} era={content.eraFrom} isDark={isDark} />
        <span className={cn("text-xl", isDark ? "text-[#6b7280]" : "text-[#d3d6da]")}>
          {content.arrow}
        </span>
        <YearField year={content.toYear} era={content.eraTo} isDark={isDark} />
      </div>

      <button
        className={cn(
          "w-full rounded border-b-[3px] py-3 text-sm font-bold tracking-wide uppercase transition-all duration-150",
          isDark
            ? "border-b-[#6ee7b7] bg-[#27272a] text-[#6ee7b7] hover:bg-[#3a3a3c]"
            : "border-b-[#2d6a4f] bg-white text-[#2d6a4f] hover:bg-[#f8f8f8]",
        )}
      >
        {content.submitText}
      </button>
    </div>
  );
}

// 4. Index Card: Warm white with asymmetric styling
function IndexCardInput({ content, isDark }: InputContentProps) {
  return (
    <div
      className={cn("bg-[#fffef8] p-5", isDark && "bg-[#1a1915]")}
      style={{
        borderRadius: "3px 3px 12px 3px",
        boxShadow: "0 2px 0 rgba(0,0,0,0.08)",
        transform: "rotate(0.2deg)",
      }}
    >
      <div className="mb-4 flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: isDark ? "#6ee7b7" : "#2d6a4f" }}
        />
        <span
          className={cn(
            "text-xs font-semibold tracking-wider uppercase",
            isDark ? "text-[#9ca3af]" : "text-[#787c7e]",
          )}
        >
          {content.label}
        </span>
      </div>

      <div
        className="mb-5 flex items-center justify-center gap-4 rounded p-4"
        style={{
          backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
        }}
      >
        <YearField year={content.fromYear} era={content.eraFrom} isDark={isDark} />
        <span className={cn("text-xl", isDark ? "text-[#6b7280]" : "text-[#d3d6da]")}>
          {content.arrow}
        </span>
        <YearField year={content.toYear} era={content.eraTo} isDark={isDark} />
      </div>

      <button
        className={cn(
          "w-full rounded border-2 py-3 text-sm font-bold tracking-wide uppercase transition-all duration-100 active:translate-y-[1px]",
          isDark
            ? "border-[#6ee7b7]/50 bg-[#1a1915] text-[#6ee7b7] hover:border-[#6ee7b7]"
            : "border-[#2d6a4f]/30 bg-[#fffef8] text-[#2d6a4f] hover:border-[#2d6a4f]",
        )}
        style={{
          boxShadow: isDark ? "0 1px 0 rgba(0,0,0,0.3)" : "0 1px 0 rgba(0,0,0,0.1)",
        }}
      >
        {content.submitText}
      </button>
    </div>
  );
}

// 5. Editorial Slate: Premium centered design with 4-layer shadow
function EditorialSlateInput({ content, isDark }: InputContentProps) {
  return (
    <div
      className={cn(
        "mx-auto max-w-[40ch] rounded-lg bg-white p-6 text-center",
        isDark && "bg-[#1e1e1f]",
      )}
      style={{
        boxShadow: isDark
          ? "0 1px 1px rgba(0,0,0,0.15), 0 2px 2px rgba(0,0,0,0.15), 0 4px 4px rgba(0,0,0,0.15), 0 8px 8px rgba(0,0,0,0.15)"
          : "0 1px 1px rgba(0,0,0,0.05), 0 2px 2px rgba(0,0,0,0.05), 0 4px 4px rgba(0,0,0,0.05), 0 8px 8px rgba(0,0,0,0.05)",
      }}
    >
      {/* Decorative header */}
      <div className="mb-5 flex items-center justify-center gap-3">
        <div className="h-px w-6" style={{ backgroundColor: isDark ? "#3a3a3c" : "#d3d6da" }} />
        <span
          className={cn(
            "text-xs font-medium tracking-[0.2em] uppercase",
            isDark ? "text-[#9ca3af]" : "text-[#787c7e]",
          )}
          style={{ fontVariant: "small-caps" }}
        >
          {content.label.toLowerCase()}
        </span>
        <div className="h-px w-6" style={{ backgroundColor: isDark ? "#3a3a3c" : "#d3d6da" }} />
      </div>

      <div className="mb-6 flex items-center justify-center gap-6">
        <YearField year={content.fromYear} era={content.eraFrom} isDark={isDark} />
        <span className={cn("text-xl", isDark ? "text-[#6b7280]" : "text-[#d3d6da]")}>
          {content.arrow}
        </span>
        <YearField year={content.toYear} era={content.eraTo} isDark={isDark} />
      </div>

      <button
        className={cn(
          "w-full rounded py-3 text-sm font-bold tracking-wide uppercase transition-all duration-200",
          isDark
            ? "bg-[#6ee7b7] text-[#121213] hover:shadow-[0_4px_12px_rgba(110,231,183,0.25)]"
            : "bg-[#2d6a4f] text-white hover:shadow-[0_4px_12px_rgba(45,106,79,0.25)]",
        )}
      >
        {content.submitText}
      </button>
    </div>
  );
}
