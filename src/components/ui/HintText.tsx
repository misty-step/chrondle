"use client";

import React from "react";
import { InlineMarkdown } from "@/components/ui/InlineMarkdown";
import { cn } from "@/lib/utils";

interface HintTextProps {
  children: string;
  className?: string;
}

export const HintText: React.FC<HintTextProps> = React.memo(({ children, className }) => {
  return (
    <div className={cn("hint-text", className)}>
      <InlineMarkdown>{children || ""}</InlineMarkdown>
    </div>
  );
});

HintText.displayName = "HintText";
