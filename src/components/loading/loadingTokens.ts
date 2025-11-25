export type LoadingIntent = "order" | "classic" | "generic";

export type LoadingStage =
  | "fetching"
  | "hydrating"
  | "readying"
  | "authenticating"
  | "loading_puzzle"
  | "resolving_year";

export interface LoadingProps {
  message: string;
  subMessage?: string;
  intent?: LoadingIntent;
  progress?: number; // 0–100, optional
  stage?: LoadingStage;
  prefersReducedMotion?: boolean;
  /**
   * Delay (ms) before showing the loader. Short loads (< threshold) render nothing.
   * Defaults to 150ms.
   */
  delayMs?: number;
}

type IntentTokens = {
  accent: string;
  accentSoft: string;
  accentText: string;
  label: string;
};

export const INTENT_TOKENS: Record<LoadingIntent, IntentTokens> = {
  order: {
    accent: "var(--timeline-marker)",
    accentSoft: "color-mix(in oklab, var(--timeline-marker) 30%, transparent)",
    accentText: "var(--timeline-marker-contrast)",
    label: "Preparing Order puzzle",
  },
  classic: {
    accent: "var(--primary)",
    accentSoft: "color-mix(in oklab, var(--primary) 25%, transparent)",
    accentText: "var(--primary-foreground)",
    label: "Preparing Classic puzzle",
  },
  generic: {
    accent: "var(--primary)",
    accentSoft: "color-mix(in oklab, var(--primary) 20%, transparent)",
    accentText: "var(--primary-foreground)",
    label: "Loading",
  },
};

export const STAGE_COPY: Record<LoadingStage, string> = {
  fetching: "Consulting the archives",
  hydrating: "Preparing the ledger",
  readying: "Ready shortly",
  authenticating: "Verifying credentials",
  loading_puzzle: "Retrieving historical record",
  resolving_year: "Locating date entry",
};
