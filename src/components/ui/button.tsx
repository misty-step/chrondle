import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 uppercase tracking-wider font-bold",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-white hover:bg-vermilion-600 border-2 border-primary shadow-sm disabled:bg-muted disabled:text-muted-foreground disabled:border-muted-foreground/50",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 border-2 border-destructive shadow-sm disabled:bg-muted disabled:text-muted-foreground disabled:border-muted-foreground/50",
        outline:
          "border-2 border-primary text-body-primary bg-transparent hover:bg-primary/5 disabled:text-muted-foreground disabled:border-muted-foreground/50",
        secondary:
          "bg-secondary text-body-secondary-foreground hover:bg-secondary/80 border-2 border-secondary shadow-sm disabled:bg-muted disabled:text-muted-foreground disabled:border-muted-foreground/50",
        ghost:
          "text-body-primary hover:bg-primary/10 border-2 border-transparent disabled:text-muted-foreground",
        link: "text-body-primary underline-offset-4 hover:underline normal-case tracking-normal disabled:text-muted-foreground",
        // Archival variants
        "ink-bleed":
          "bg-transparent text-body-primary border-2 border-primary hover:bg-primary hover:text-background transition-colors duration-300 disabled:text-muted-foreground disabled:border-muted-foreground/50",
        stamp:
          "bg-transparent text-body-primary border-2 border-primary material-stamp hover:scale-105 active:scale-95 transition-transform disabled:text-muted-foreground disabled:border-muted-foreground/50",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-8 rounded-sm px-4 text-xs",
        lg: "h-12 rounded-sm px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
