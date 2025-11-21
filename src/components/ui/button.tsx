import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 uppercase tracking-wider font-bold",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-vermilion-600 border-2 border-primary shadow-sm",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 border-2 border-destructive shadow-sm",
        outline: "border-2 border-primary text-primary bg-transparent hover:bg-primary/5",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-2 border-secondary shadow-sm",
        ghost: "text-primary hover:bg-primary/10 border-2 border-transparent",
        link: "text-primary underline-offset-4 hover:underline normal-case tracking-normal",
        // Archival variants
        "ink-bleed":
          "bg-transparent text-ink-900 border-2 border-ink-900 hover:bg-ink-900 hover:text-parchment-50 transition-colors duration-300",
        stamp:
          "bg-transparent text-primary border-2 border-primary material-stamp hover:scale-105 active:scale-95 transition-transform",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-8 rounded-md px-4 text-xs",
        lg: "h-12 rounded-md px-8 text-base",
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
