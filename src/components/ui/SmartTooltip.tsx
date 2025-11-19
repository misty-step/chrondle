"use client";

import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface SmartTooltipProps {
  content: string;
  children: React.ReactNode;
  delay?: number;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}

export const SmartTooltip: React.FC<SmartTooltipProps> = ({
  content,
  children,
  delay = 500,
  className,
  side = "top",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<"center" | "left" | "right">("center");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile("ontouchstart" in window && window.innerWidth < 768);
    };

    checkMobile();
    const handleResize = () => checkMobile();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const calculateTooltipPosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      // If trigger is in left 30% of screen, align tooltip left
      if (rect.left < viewportWidth * 0.3) {
        setTooltipPosition("left");
      }
      // If trigger is in right 30% of screen, align tooltip right
      else if (rect.right > viewportWidth * 0.7) {
        setTooltipPosition("right");
      }
      // Otherwise center the tooltip
      else {
        setTooltipPosition("center");
      }
    }
  };

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Calculate optimal position before showing
    calculateTooltipPosition();

    if (isMobile) {
      // On mobile, toggle tooltip on tap
      setIsVisible(!isVisible);

      // Auto-hide after 3 seconds on mobile
      if (!isVisible) {
        timeoutRef.current = setTimeout(() => {
          setIsVisible(false);
        }, 3000);
      }
    } else {
      // On desktop, show after delay
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delay);
    }
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!isMobile) {
      setIsVisible(false);
    }
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getPositionClasses = () => {
    // On mobile, prefer bottom positioning to avoid cutoff issues
    const effectiveSide = isMobile && side === "top" ? "bottom" : side;

    // Base positioning for top/bottom tooltips
    if (effectiveSide === "top" || effectiveSide === "bottom") {
      const verticalClass = effectiveSide === "top" ? "bottom-full mb-2" : "top-full mt-2";

      // Horizontal positioning based on calculated position
      switch (tooltipPosition) {
        case "left":
          return `${verticalClass} left-0`;
        case "right":
          return `${verticalClass} right-0`;
        case "center":
        default:
          return `${verticalClass} left-1/2 transform -translate-x-1/2`;
      }
    }

    // Side positioning (left/right tooltips)
    switch (effectiveSide) {
      case "left":
        return "right-full top-1/2 transform -translate-y-1/2 mr-2";
      case "right":
        return "left-full top-1/2 transform -translate-y-1/2 ml-2";
      default:
        return "bottom-full left-1/2 transform -translate-x-1/2 mb-2";
    }
  };

  const getArrowClasses = () => {
    // On mobile, prefer bottom positioning to avoid cutoff issues
    const effectiveSide = isMobile && side === "top" ? "bottom" : side;

    // Arrow positioning for top/bottom tooltips
    if (effectiveSide === "top" || effectiveSide === "bottom") {
      const arrowVertical =
        effectiveSide === "top"
          ? "top-full border-t-muted border-t-8 border-x-transparent border-x-8 border-b-0"
          : "bottom-full border-b-muted border-b-8 border-x-transparent border-x-8 border-t-0";

      // Horizontal arrow positioning based on tooltip position
      switch (tooltipPosition) {
        case "left":
          return `${arrowVertical} left-4`;
        case "right":
          return `${arrowVertical} right-4`;
        case "center":
        default:
          return `${arrowVertical} left-1/2 transform -translate-x-1/2`;
      }
    }

    // Arrow positioning for left/right tooltips
    switch (effectiveSide) {
      case "left":
        return "left-full top-1/2 transform -translate-y-1/2 border-l-muted border-l-8 border-y-transparent border-y-8 border-r-0";
      case "right":
        return "right-full top-1/2 transform -translate-y-1/2 border-r-muted border-r-8 border-y-transparent border-y-8 border-l-0";
      default:
        return "top-full left-1/2 transform -translate-x-1/2 border-t-muted border-t-8 border-x-transparent border-x-8 border-b-0";
    }
  };

  return (
    <div
      className="relative inline-block"
      ref={triggerRef}
      onMouseEnter={!isMobile ? showTooltip : undefined}
      onMouseLeave={!isMobile ? hideTooltip : undefined}
    >
      <div
        onClick={isMobile ? showTooltip : undefined}
        className={isMobile ? "cursor-pointer" : ""}
      >
        {children}
      </div>

      {isVisible && (
        <div
          className={cn(
            "text-foreground bg-muted border-border absolute z-50 rounded-lg border px-3 py-2 text-sm shadow-lg transition-opacity duration-200",
            "max-w-sm whitespace-normal",
            getPositionClasses(),
            className,
          )}
          role="tooltip"
          aria-live="polite"
        >
          {content}
          {/* Arrow */}
          <div className={cn("absolute h-0 w-0", getArrowClasses())} />
        </div>
      )}
    </div>
  );
};
