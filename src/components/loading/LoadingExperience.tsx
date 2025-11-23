import React, { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { INTENT_TOKENS, STAGE_COPY, type LoadingProps } from "./loadingTokens";

/**
 * Pure presentational loading experience. No hooks; safe for server render.
 * Callers provide prefersReducedMotion if they want to disable shimmer.
 */
export function LoadingExperience({
  message,
  subMessage,
  intent = "generic",
  progress,
  stage = "fetching",
  prefersReducedMotion = false,
  delayMs = 150,
}: LoadingProps) {
  const tokens = INTENT_TOKENS[intent];

  const clampedProgress = useMemo(() => {
    if (progress === undefined) return undefined;
    return Math.min(100, Math.max(0, Math.round(progress)));
  }, [progress]);

  return (
    <main className="bg-background text-foreground relative min-h-screen overflow-hidden">
      {/* Thin top bar for quick feedback */}
      <TopBar
        intentAccent={tokens.accent}
        delayMs={delayMs}
        prefersReducedMotion={prefersReducedMotion}
      />

      <section className="relative mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 py-16 sm:py-18">
        <InlineSpinner intentAccent={tokens.accent} />
        <div className="space-y-1 text-center">
          <p className="text-base font-semibold">{message}</p>
          {subMessage && <p className="text-secondary text-sm">{subMessage}</p>}
          <p className="text-secondary text-xs tracking-[0.16em] uppercase">{STAGE_COPY[stage]}</p>
        </div>
        <ProgressBar
          progress={clampedProgress}
          accent={tokens.accent}
          prefersReducedMotion={prefersReducedMotion}
        />
      </section>
    </main>
  );
}

function TopBar({
  intentAccent,
  delayMs,
  prefersReducedMotion,
}: {
  intentAccent: string;
  delayMs: number;
  prefersReducedMotion: boolean;
}) {
  const barStyle = prefersReducedMotion
    ? { backgroundColor: intentAccent, width: "35%" }
    : {
        backgroundImage: `linear-gradient(90deg, transparent, ${intentAccent}, transparent)`,
      };

  return (
    <div className="absolute top-0 right-0 left-0 h-0.5 overflow-hidden">
      <div
        className={cn("h-full", prefersReducedMotion ? "" : "loading-shimmer")}
        style={{
          ...barStyle,
          animationDelay: `${delayMs}ms`,
        }}
        aria-hidden
      />
    </div>
  );
}

function InlineSpinner({ intentAccent }: { intentAccent: string }) {
  return (
    <div className="border-outline-default/60 flex h-12 w-12 items-center justify-center rounded-full border">
      <Loader2
        className="h-5 w-5 animate-spin"
        style={{ color: intentAccent, animationDuration: "0.9s" }}
        aria-hidden
      />
    </div>
  );
}

function ProgressBar({
  progress,
  accent,
  prefersReducedMotion,
}: {
  progress: number | undefined;
  accent: string;
  prefersReducedMotion: boolean;
}) {
  const showDeterminate = typeof progress === "number";
  const pct = progress ?? 34;

  return (
    <div className="bg-muted/70 relative mt-4 h-1.5 w-48 overflow-hidden rounded-full">
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full",
          !showDeterminate && !prefersReducedMotion && "loading-shimmer",
        )}
        style={{
          width: showDeterminate ? `${pct}%` : "40%",
          backgroundColor: showDeterminate ? accent : "var(--muted-foreground)",
          backgroundImage:
            !showDeterminate && !prefersReducedMotion
              ? `linear-gradient(90deg, transparent, ${accent}, transparent)`
              : undefined,
          transition: "width 200ms ease, background-color 200ms ease",
        }}
        aria-hidden
      />
    </div>
  );
}
