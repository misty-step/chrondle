import Link from "next/link";
import { cn } from "@/lib/utils";

interface ModeUnavailableStateProps {
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  className?: string;
}

export function ModeUnavailableState({
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  className,
}: ModeUnavailableStateProps) {
  return (
    <section
      className={cn(
        "bg-card text-card-foreground mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-3xl border px-6 py-8 text-center shadow-sm",
        className,
      )}
    >
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold text-balance">{title}</h1>
        <p className="text-muted-foreground text-sm leading-6 text-pretty sm:text-base">
          {description}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href={primaryHref}
          className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
        >
          {primaryLabel}
        </Link>

        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="border-border hover:bg-accent hover:text-accent-foreground rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
