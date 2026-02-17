"use client";

import React from "react";
import { Layers } from "lucide-react";
import { VariationPreview } from "./components/VariationPreview";
import { ClueCard } from "./components/ClueCard";
import { HintButton } from "./components/HintButton";
import { GuessInput } from "./components/GuessInput";
import type { ClueCardVariation } from "./components/ClueCard";

/**
 * Dev-only visual catalogue page.
 *
 * WARNING: Do not use real puzzle hints here. Keep content generic.
 */
export default function DesignPreviewClient() {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-50 border-b border-[#d3d6da] bg-white/90 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-6 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-[#f0f7f4]">
              <Layers className="h-5 w-5 text-[#2d6a4f]" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold text-[#1a1a1b]">
                Design Catalogue
              </h1>
              <p className="text-xs text-[#787c7e]">Chrondle Visual Variations</p>
            </div>
          </div>
          <span className="rounded border border-[#d3d6da] bg-[#f8f8f8] px-3 py-1 font-mono text-xs text-[#787c7e]">
            dev-only
          </span>
        </div>
      </header>

      <section className="border-b border-[#d3d6da] bg-[#f0f7f4] px-6 py-12 lg:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-[#1a1a1b] sm:text-4xl">
            Clue Card Design Variations
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[#787c7e]">
            Compare five distinct visual approaches for the Chrondle game interface. Each variation
            keeps the same content structure while exploring different aesthetic directions.
          </p>

          <div className="mt-8 inline-flex flex-wrap items-center justify-center gap-4 rounded-lg border border-[#d3d6da] bg-white px-6 py-3 text-sm text-[#787c7e]">
            <span className="font-medium">Content Preview:</span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#2d6a4f]" />
              Clue Card
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#2d6a4f]/60" />
              Hint Controls
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#2d6a4f]/30" />
              Guess Input
            </span>
          </div>
        </div>
      </section>

      <main>
        <VariationPreview
          number={1}
          name="Paper Stock"
          description="Clean archival paper aesthetic with subtle shadow elevation and crisp top border accent"
        >
          {(mode) => <VariationSet variation="paper-stock" isDark={mode === "dark"} />}
        </VariationPreview>

        <VariationPreview
          number={2}
          name="Archival Ledger"
          description="Flat design with header strip, dashed ledger lines, and institutional document styling"
        >
          {(mode) => <VariationSet variation="archival-ledger" isDark={mode === "dark"} />}
        </VariationPreview>

        <VariationPreview
          number={3}
          name="Museum Label"
          description="Inset shadow depth with left accent bar, evoking gallery placard aesthetics"
        >
          {(mode) => <VariationSet variation="museum-label" isDark={mode === "dark"} />}
        </VariationPreview>

        <VariationPreview
          number={4}
          name="Index Card"
          description="Warm white tones with slight rotation, asymmetric radius, and analog library feel"
        >
          {(mode) => <VariationSet variation="index-card" isDark={mode === "dark"} />}
        </VariationPreview>

        <VariationPreview
          number={5}
          name="Editorial Slate"
          description="Premium 4-layer shadow system with centered typography and sophisticated hairline accents"
        >
          {(mode) => <VariationSet variation="editorial-slate" isDark={mode === "dark"} />}
        </VariationPreview>
      </main>

      <footer className="border-t border-[#d3d6da] bg-[#f0f7f4] px-6 py-8 lg:px-12">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-[#787c7e]">
            Chrondle Design System — {new Date().getFullYear()}
          </p>
          <p className="text-xs text-[#a1a1aa]">Built with React, Tailwind CSS, and TypeScript</p>
        </div>
      </footer>
    </div>
  );
}

function VariationSet({ variation, isDark }: { variation: ClueCardVariation; isDark: boolean }) {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <ClueCard variation={variation} isDark={isDark} />
      <HintButton variation={variation} isDark={isDark} />
      <GuessInput variation={variation} isDark={isDark} />
    </div>
  );
}
