import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The badge, refused (aesthetic .ae-tag): a word in the plate-caption
 * voice — mono, spaced, hairline at most. No fill, no pill; when a
 * status needs a hue it rides a glyph beside the word, never a box.
 */
const badgeVariants = cva("ae-tag", {
  variants: {
    variant: {
      default: "",
      secondary: "",
      destructive: "",
      outline: "",
      earlier: "",
      later: "",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
