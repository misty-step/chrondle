"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  className?: string;
  duration?: number;
  stagger?: number;
}

/**
 * AnimatedNumber Component
 *
 * Displays numbers with a smooth digit-by-digit flip animation.
 * Each digit animates independently with a staggered delay,
 * creating an odometer or slot machine effect.
 *
 * @param value - The number to display
 * @param className - Optional CSS classes
 * @param duration - Animation duration per digit (default: 0.6s)
 * @param stagger - Delay between each digit animation (default: 0.05s)
 *
 * @example
 * <AnimatedNumber value={85} className="text-4xl" />
 */
export function AnimatedNumber({
  value,
  className,
  duration = 0.6,
  stagger = 0.05,
}: AnimatedNumberProps) {
  const [prevValue, setPrevValue] = useState(value);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    setPrevValue(value);
  }, [value]);

  // Split number into digit array
  const digits = String(value).split("");
  const prevDigits = String(prevValue).split("");

  // If reduced motion is preferred, skip animation
  if (shouldReduceMotion) {
    return <span className={cn("inline-flex tabular-nums", className)}>{value}</span>;
  }

  return (
    <div className={cn("inline-flex overflow-hidden tabular-nums", className)}>
      {digits.map((digit, index) => {
        const prevDigit = prevDigits[index] || "0";
        const changed = digit !== prevDigit;

        return (
          <motion.span
            key={`${index}-${value}`}
            className="inline-block"
            initial={
              changed
                ? {
                    y: -30,
                    opacity: 0,
                    filter: "blur(4px)",
                    scale: 0.8,
                  }
                : false
            }
            animate={{
              y: 0,
              opacity: 1,
              filter: "blur(0px)",
              scale: 1,
            }}
            exit={{
              y: 30,
              opacity: 0,
              filter: "blur(4px)",
              scale: 0.8,
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              delay: index * stagger,
              duration,
            }}
          >
            {digit}
          </motion.span>
        );
      })}
    </div>
  );
}
