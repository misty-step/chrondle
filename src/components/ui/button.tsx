"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { playSound, type SoundCue } from "@/lib/sound/soundEngine";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-feedback-success text-feedback-success-foreground border-0 hover:bg-feedback-success-hover",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-destructive",
        outline:
          "border border-border text-foreground bg-surface-elevated hover:bg-surface-elevated-hover hover:border-foreground/40",
        secondary:
          "bg-secondary text-body-secondary-foreground hover:bg-secondary/80 border border-border",
        ghost: "text-body-primary hover:bg-primary/10 border-0",
        link: "text-body-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "px-6 py-2.5",
        sm: "h-11 px-3.5 text-sm",
        lg: "h-12 px-8 text-base",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  soundCue?: SoundCue | false;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  soundCue = "press",
  onClick,
  onClickCapture,
  disabled,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.defaultPrevented) return;
    onClick?.(e);
    if (soundCue && !e.defaultPrevented) {
      playSound(soundCue);
    }
  };

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      onClick={handleClick}
      {...props}
      onClickCapture={
        disabled
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
            }
          : onClickCapture
      }
      disabled={disabled}
      aria-disabled={disabled || props["aria-disabled"]}
    />
  );
}

export { Button, buttonVariants };
