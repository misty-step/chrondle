import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Buttons are not links: contained ink shapes (aesthetic .ae-button).
 * Primary is solid ink; quiet is the hairline secondary. Accents and
 * status hues are never spent on buttons — danger lives in the words
 * and the dialog that asks.
 */
const buttonVariants = cva("ae-button", {
  variants: {
    variant: {
      default: "",
      destructive: "",
      outline: "ae-button-quiet",
      secondary: "ae-button-quiet",
      ghost: "ae-button-quiet border-transparent",
    },
    size: {
      default: "",
      sm: "ae-button-compact",
      lg: "",
      icon: "w-11 px-0",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

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
