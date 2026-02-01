import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded h-11 text-sm font-bold tracking-[0.04em] uppercase transition-all duration-150 ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#4a9b7f] text-white border-0 hover:bg-[#3d8a6e] hover:translate-y-[-1px]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 border-2 border-destructive shadow-sm disabled:bg-muted disabled:text-muted-foreground disabled:border-muted-foreground/50",
        outline:
          "border border-[#d3d6da] text-[#1a1a1b] bg-white hover:bg-black/5 hover:border-[#1a1a1b] dark:hover:bg-white/5",
        secondary:
          "bg-secondary text-body-secondary-foreground hover:bg-secondary/80 border-2 border-secondary shadow-sm disabled:bg-muted disabled:text-muted-foreground disabled:border-muted-foreground/50",
        ghost:
          "text-body-primary hover:bg-primary/10 border-2 border-transparent disabled:text-muted-foreground",
        link: "text-body-primary underline-offset-4 hover:underline normal-case tracking-normal disabled:text-muted-foreground",
      },
      size: {
        default: "px-6 py-2",
        sm: "h-8 rounded px-4 text-xs",
        lg: "h-12 rounded px-8 text-base",
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
