"use client";

import React from "react";
import { SpeakerHigh, SpeakerSlash } from "@/components/kit/icons";
import { useSound } from "@/lib/sound/useSound";
import { cn } from "@/lib/utils";

interface SoundToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const SoundToggle: React.FC<SoundToggleProps> = ({ className = "", size = "md" }) => {
  const { isEnabled, toggleSound } = useSound();
  const iconSize = size === "sm" ? 16 : size === "lg" ? 22 : 18;

  return (
    <button
      type="button"
      onClick={toggleSound}
      aria-label="Sound effects"
      aria-pressed={isEnabled}
      title={isEnabled ? "Mute sound effects" : "Enable sound effects"}
      className={cn(
        size === "lg" ? "h-12 w-12" : "h-11 w-11",
        "flex shrink-0 cursor-pointer items-center justify-center rounded-lg",
        "text-muted-foreground hover:text-foreground hover:bg-surface-elevated",
        "transition-colors duration-150 motion-reduce:transition-none",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
    >
      {isEnabled ? (
        <SpeakerHigh
          size={iconSize}
          weight="bold"
          className="text-feedback-success"
          aria-hidden="true"
        />
      ) : (
        <SpeakerSlash size={iconSize} weight="bold" aria-hidden="true" />
      )}
    </button>
  );
};
