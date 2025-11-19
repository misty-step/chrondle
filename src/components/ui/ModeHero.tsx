"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ModeHeroAlignment = "left" | "center";

interface ModeHeroProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
  align?: ModeHeroAlignment;
  className?: string;
  children?: ReactNode;
}

/**
 * ModeHero standardizes the heading/subheading stack shared by Classic + Order modes.
 * Keeps typography in sync while letting each mode supply its own copy or actions.
 */
export function ModeHero({
  title,
  subtitle,
  eyebrow,
  align = "left",
  className,
  children,
}: ModeHeroProps) {
  const alignmentClasses =
    align === "center" ? "items-center text-center" : "items-start text-left";

  return (
    <section className={cn("space-y-2", alignmentClasses, className)}>
      {eyebrow ? (
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase">
          {eyebrow}
        </p>
      ) : null}

      <div className="space-y-2">
        <h2 className="text-foreground text-xl font-bold sm:text-2xl">{title}</h2>
        <p className="text-muted-foreground text-lg leading-7">{subtitle}</p>
      </div>

      {children ? <div className="w-full">{children}</div> : null}
    </section>
  );
}
