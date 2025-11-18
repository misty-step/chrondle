"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { Era } from "@/lib/eraUtils";

const toggleContainerVariants = cva(
  "inline-flex rounded-lg bg-muted/50 border border-input shadow-sm p-1 gap-1 relative",
  {
    variants: {
      size: {
        sm: "h-7 text-xs",
        default: "h-8 text-sm",
        lg: "h-12 text-base",
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
  "inline-flex items-center justify-center rounded-md px-3 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 flex-1 sm:flex-initial relative z-10",
  {
    variants: {
      variant: {
        active: [
          "bg-primary text-primary-foreground",
          "font-bold tracking-wide",
          "shadow-md shadow-primary/20",
          "ring-2 ring-primary/30 ring-offset-1 ring-offset-background/50",
          "border-2 border-primary",
          "scale-[1.02]",
        ].join(" "),
        inactive: [
          "text-muted-foreground hover:text-foreground",
          "font-medium",
          "bg-background/30 hover:bg-background/50",
          "border-2 border-transparent",
          "hover:border-input/50",
        ].join(" "),
      },
      size: {
        sm: "h-5 min-w-[2.5rem] text-xs",
        default: "h-6 min-w-[3rem] text-sm",
        lg: "h-10 min-w-[3.5rem] text-base",
      },
    },
    defaultVariants: {
      variant: "inactive",
      size: "default",
    },
  },
);

export interface EraToggleProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange">,
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
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      switch (event.key) {
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          if (value === "AD") {
            onChange("BC");
          }
          break;
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          if (value === "BC") {
            onChange("AD");
          }
          break;
        case " ":
        case "Enter":
          event.preventDefault();
          onChange(value === "BC" ? "AD" : "BC");
          break;
      }
    };

    const handleButtonClick = (era: Era) => {
      if (!disabled && era !== value) {
        onChange(era);
      }
    };

    return (
      <div
        ref={ref}
        role="radiogroup"
        aria-label="Select era: BC or AD"
        aria-disabled={disabled}
        aria-live="polite"
        className={cn(toggleContainerVariants({ size, width }), className)}
        onKeyDown={handleKeyDown}
        {...props}
      >
        <motion.button
          type="button"
          role="radio"
          aria-checked={value === "BC"}
          aria-label={showLabels ? undefined : "BC - Before Common Era"}
          className={cn(
            toggleButtonVariants({
              variant: value === "BC" ? "active" : "inactive",
              size,
            }),
          )}
          onClick={() => handleButtonClick("BC")}
          disabled={disabled}
          whileTap={!disabled ? { scale: 0.98 } : undefined}
          whileHover={!disabled && value !== "BC" ? { scale: 1.02 } : undefined}
          animate={{
            opacity: value === "BC" ? 1 : 0.8,
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 25,
            duration: 0.15,
          }}
        >
          BC
        </motion.button>
        <motion.button
          type="button"
          role="radio"
          aria-checked={value === "AD"}
          aria-label={showLabels ? undefined : "AD - Anno Domini (Common Era)"}
          className={cn(
            toggleButtonVariants({
              variant: value === "AD" ? "active" : "inactive",
              size,
            }),
          )}
          onClick={() => handleButtonClick("AD")}
          disabled={disabled}
          whileTap={!disabled ? { scale: 0.98 } : undefined}
          whileHover={!disabled && value !== "AD" ? { scale: 1.02 } : undefined}
          animate={{
            opacity: value === "AD" ? 1 : 0.8,
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 25,
            duration: 0.15,
          }}
        >
          AD
        </motion.button>
      </div>
    );
  },
);

EraToggle.displayName = "EraToggle";

export { EraToggle };

// Example usage with label for forms:
export const EraToggleWithLabel: React.FC<{
  value: Era;
  onChange: (era: Era) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: "sm" | "default" | "lg";
}> = ({ value, onChange, label = "Era", description, disabled, size }) => {
  const id = React.useId();
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
      )}
      <EraToggle
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        size={size}
        aria-describedby={descriptionId}
      />
      {description && (
        <p id={descriptionId} className="text-muted-foreground text-xs">
          {description}
        </p>
      )}
    </div>
  );
};
