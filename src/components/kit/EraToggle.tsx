"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { Era } from "@/lib/eraUtils";
import { playSound } from "@/lib/sound/soundEngine";

const toggleContainerVariants = cva(
  "relative inline-flex rounded-lg border border-border bg-surface-inset p-0.5",
  {
    variants: {
      size: {
        sm: "min-h-12",
        default: "min-h-12",
        lg: "min-h-14",
      },
      width: {
        auto: "w-auto",
        full: "w-full",
      },
    },
    defaultVariants: {
      size: "default",
      width: "auto",
    },
  },
);

const toggleButtonVariants = cva(
  "relative inline-flex min-h-11 min-w-11 flex-1 cursor-pointer select-none items-center justify-center rounded-md px-3 font-semibold transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        active: "bg-foreground text-background",
        inactive: "text-muted-foreground hover:text-foreground hover:bg-surface-elevated/60",
      },
      size: {
        sm: "text-sm",
        default: "text-sm",
        lg: "text-base",
      },
    },
    defaultVariants: {
      variant: "inactive",
      size: "default",
    },
  },
);

export interface EraToggleProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, "onChange">,
    VariantProps<typeof toggleContainerVariants> {
  value: Era;
  onChange: (era: Era) => void;
  disabled?: boolean;
  showLabels?: boolean;
  width?: "auto" | "full";
}

const EraToggle = React.forwardRef<HTMLDivElement, EraToggleProps>(
  (
    {
      className,
      size,
      width = "auto",
      value,
      onChange,
      disabled = false,
      showLabels = false,
      ...props
    },
    ref,
  ) => {
    const bcRef = React.useRef<HTMLButtonElement>(null);
    const adRef = React.useRef<HTMLButtonElement>(null);
    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled || !["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(event.key))
        return;
      event.preventDefault();
      const next = value === "BC" ? "AD" : "BC";
      handleButtonClick(next);
      (next === "BC" ? bcRef : adRef).current?.focus();
    };

    const handleButtonClick = (era: Era) => {
      if (!disabled && era !== value) {
        playSound("toggle", { variant: era === "AD" ? "high" : "low" });
        onChange(era);
      }
    };

    return (
      <div
        ref={ref}
        role="radiogroup"
        aria-label="Select era: BC or AD"
        aria-disabled={disabled}
        className={cn(toggleContainerVariants({ size, width }), className)}
        {...props}
      >
        <button
          ref={bcRef}
          tabIndex={disabled || value !== "BC" ? -1 : 0}
          type="button"
          role="radio"
          aria-checked={value === "BC"}
          aria-label={showLabels ? undefined : "BC - Before Christ"}
          className={cn(
            toggleButtonVariants({
              variant: value === "BC" ? "active" : "inactive",
              size,
            }),
          )}
          onClick={() => handleButtonClick("BC")}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        >
          BC
        </button>
        <button
          ref={adRef}
          tabIndex={disabled || value !== "AD" ? -1 : 0}
          type="button"
          role="radio"
          aria-checked={value === "AD"}
          aria-label={showLabels ? undefined : "AD - Anno Domini"}
          className={cn(
            toggleButtonVariants({
              variant: value === "AD" ? "active" : "inactive",
              size,
            }),
          )}
          onClick={() => handleButtonClick("AD")}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        >
          AD
        </button>
      </div>
    );
  },
);

EraToggle.displayName = "EraToggle";

export { EraToggle };

export const EraToggleWithLabel: React.FC<{
  value: Era;
  onChange: (era: Era) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: "sm" | "default" | "lg";
}> = ({ value, onChange, label = "Era", description, disabled, size }) => {
  const reactId = React.useId();
  const descriptionId = description ? `era-toggle-desc-${reactId}` : undefined;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span
          id={`era-toggle-label-${reactId}`}
          className="text-body text-foreground text-sm font-semibold"
        >
          {label}
        </span>
        {description && (
          <span id={descriptionId} className="text-muted-foreground text-xs">
            {description}
          </span>
        )}
      </div>
      <EraToggle
        value={value}
        onChange={onChange}
        disabled={disabled}
        size={size}
        aria-describedby={descriptionId}
        aria-labelledby={`era-toggle-label-${reactId}`}
      />
    </div>
  );
};
