import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// --- Heading Component ---

const headingVariants = cva("font-serif tracking-tight text-body-primary", {
  variants: {
    level: {
      1: "text-6xl font-bold leading-tight lg:text-7xl",
      2: "text-4xl font-semibold leading-snug first:mt-0",
      3: "text-3xl font-semibold leading-snug",
      4: "text-2xl font-semibold leading-snug",
    },
    intent: {
      default: "text-body-primary",
      subtle: "text-body-secondary",
      accent: "text-body-primary italic",
    },
  },
  defaultVariants: {
    level: 1,
    intent: "default",
  },
});

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, level, intent, as, ...props }, ref) => {
    const Comp = as || `h${level || 1}`;
    return (
      <Comp ref={ref} className={cn(headingVariants({ level, intent, className }))} {...props} />
    );
  },
);
Heading.displayName = "Heading";

// --- Prose Component ---

const proseVariants = cva("font-body text-body-primary leading-relaxed", {
  variants: {
    size: {
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg",
    },
    intent: {
      default: "text-body-primary",
      subtle: "text-body-tertiary",
      muted: "text-muted-foreground",
    },
  },
  defaultVariants: {
    size: "base",
    intent: "default",
  },
});

export interface ProseProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof proseVariants> {
  as?: React.ElementType;
}

const Prose = React.forwardRef<HTMLParagraphElement, ProseProps>(
  ({ className, size, intent, as: Comp = "p", ...props }, ref) => {
    return <Comp ref={ref} className={cn(proseVariants({ size, intent, className }))} {...props} />;
  },
);
Prose.displayName = "Prose";

// --- Handwriting Component ---
// Used for "notes" or margin comments

const handwritingVariants = cva("font-serif italic text-body-secondary opacity-90", {
  variants: {
    size: {
      sm: "text-xs",
      base: "text-sm",
      lg: "text-base",
    },
  },
  defaultVariants: {
    size: "base",
  },
});

export interface HandwritingProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof handwritingVariants> {
  as?: React.ElementType;
}

const Handwriting = React.forwardRef<HTMLSpanElement, HandwritingProps>(
  ({ className, size, as: Comp = "span", ...props }, ref) => {
    return <Comp ref={ref} className={cn(handwritingVariants({ size, className }))} {...props} />;
  },
);
Handwriting.displayName = "Handwriting";

export { Heading, Prose, Handwriting };
