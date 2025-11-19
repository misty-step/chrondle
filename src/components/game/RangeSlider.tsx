"use client";

import React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { ElementRef, forwardRef } from "react";

import { cn } from "@/lib/utils";

export type RangeSliderValue = [number, number];

export interface RangeSliderProps {
  min: number;
  max: number;
  value: RangeSliderValue;
  step?: number;
  disabled?: boolean;
  className?: string;
  onChange: (value: RangeSliderValue) => void;
  onCommit?: (value: RangeSliderValue) => void;
}

type SliderRootElement = ElementRef<typeof SliderPrimitive.Root>;

export const RangeSlider = forwardRef<SliderRootElement, RangeSliderProps>(
  ({ min, max, value, onChange, onCommit, step = 1, disabled = false, className }, ref) => {
    const handleValueChange = (next: number[]) => {
      if (next.length !== 2) {
        return;
      }

      onChange([next[0], next[1]]);
    };

    const handleValueCommit = (next: number[]) => {
      if (!onCommit || next.length !== 2) {
        return;
      }

      onCommit([next[0], next[1]]);
    };

    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn("relative flex h-10 w-full touch-none items-center select-none", className)}
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={handleValueChange}
        onValueCommit={handleValueCommit}
        disabled={disabled}
        minStepsBetweenThumbs={1}
        aria-label="Range slider"
      >
        <SliderPrimitive.Track className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full">
          <SliderPrimitive.Range className="bg-primary absolute h-full" />
        </SliderPrimitive.Track>
        {["Range start", "Range end"].map((label) => (
          <SliderPrimitive.Thumb
            key={label}
            aria-label={label}
            className="border-border bg-background focus-visible:ring-primary block h-6 w-6 rounded-full border shadow-lg transition outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Root>
    );
  },
);

RangeSlider.displayName = "RangeSlider";
