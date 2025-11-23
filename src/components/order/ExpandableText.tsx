"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExpandableTextProps {
  text: string;
  className?: string;
}

export function ExpandableText({ text, className }: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showToggle, setShowToggle] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const checkOverflow = () => {
      const element = textRef.current;
      if (element) {
        if (isExpanded) {
          // If expanded, always allow collapsing
          setShowToggle(true);
        } else {
          // If collapsed, check if content overflows
          // We use a small buffer (1px) to account for sub-pixel rendering differences
          setShowToggle(element.scrollHeight > element.clientHeight + 1);
        }
      }
    };

    // Check immediately and on resize
    checkOverflow();

    // We also need to check after a short delay because font loading or layout shifts
    // might affect height after initial render.
    const timeoutId = setTimeout(checkOverflow, 100);

    window.addEventListener("resize", checkOverflow);
    return () => {
      window.removeEventListener("resize", checkOverflow);
      clearTimeout(timeoutId);
    };
  }, [text, isExpanded]);

  return (
    <div className="flex flex-col items-start gap-1 w-full">
      <p
        ref={textRef}
        className={cn(
          className,
          !isExpanded && "line-clamp-3"
        )}
      >
        {text}
      </p>
      {showToggle && (
        <Button
          variant="link"
          size="sm"
          onClick={(e) => {
            e.stopPropagation(); // Prevent interfering with parent click handlers (if any)
            setIsExpanded(!isExpanded);
          }}
          className="h-auto p-0 text-muted-foreground hover:text-foreground font-medium"
        >
          {isExpanded ? "Show less" : "Show more"}
          {isExpanded ? (
            <ChevronUp className="ml-1 h-3 w-3" />
          ) : (
            <ChevronDown className="ml-1 h-3 w-3" />
          )}
        </Button>
      )}
    </div>
  );
}
