"use client";

import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import { motion, useMotionValue, animate } from "motion/react";
import { logger } from "@/lib/logger";

interface NumberTickerProps {
  value: number;
  startValue?: number;
  duration?: number;
  className?: string;
  initialValue?: number; // New prop to set initial display value
}

export const NumberTicker: React.FC<NumberTickerProps> = ({
  value,
  startValue,
  duration = 400,
  className = "",
  initialValue,
}) => {
  // Use initialValue if provided, otherwise use value
  const motionValue = useMotionValue(initialValue ?? startValue ?? value);
  const ref = useRef<HTMLSpanElement>(null);

  // Track if component is mounted to prevent animation on first render
  const [isMounted, setIsMounted] = useState(false);
  const isFirstRenderRef = useRef(true);

  // Use useLayoutEffect to set mounted state before paint
  useLayoutEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Skip animation on first render - just set the value immediately
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      motionValue.set(value);
      logger.debug(`NumberTicker initial mount: setting to ${value}`);
      return;
    }

    // Only animate on subsequent value changes after mount
    if (!isMounted) {
      motionValue.set(value);
      return;
    }

    // Clamp animation delta to prevent extreme jumps
    const currentValue = motionValue.get();
    const delta = Math.abs(value - currentValue);
    const maxDelta = 100; // Maximum year jump per animation

    if (delta > maxDelta && startValue === undefined) {
      // For large jumps without explicit startValue, use a closer starting point
      const clampedStart = value > currentValue ? value - maxDelta : value + maxDelta;

      logger.debug(
        `NumberTicker clamping large jump: ${currentValue} → ${clampedStart} → ${value}`,
      );

      motionValue.set(clampedStart);
      const controls = animate(motionValue, value, {
        duration: duration / 1000,
        ease: "easeOut",
      });
      return () => controls.stop();
    }

    // Normal animation for reasonable changes
    if (startValue !== undefined && startValue !== value) {
      logger.debug(`NumberTicker animating from ${startValue} to ${value}`);
      const controls = animate(motionValue, value, {
        duration: duration / 1000,
        ease: "easeOut",
      });

      return () => controls.stop();
    } else if (currentValue !== value) {
      logger.debug(`NumberTicker animating from ${currentValue} to ${value}`);
      const controls = animate(motionValue, value, {
        duration: duration / 1000,
        ease: "easeOut",
      });

      return () => controls.stop();
    } else {
      logger.debug(`NumberTicker value unchanged: ${value}`);
      // Value hasn't changed, no animation needed
      motionValue.set(value);
    }
  }, [value, startValue, duration, motionValue, isMounted]);

  useEffect(() => {
    const unsubscribe = motionValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = Math.round(latest).toString();
      }
    });

    return unsubscribe;
  }, [motionValue]);

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 1 }}
      style={{ willChange: "transform" }}
    >
      {(initialValue ?? value).toString()}
    </motion.span>
  );
};
