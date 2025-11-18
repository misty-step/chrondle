import React from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type SliderHandlers = {
  onValueChange?: (value: RangeSliderValue) => void;
  onValueCommit?: (value: RangeSliderValue) => void;
};

type MockSliderProps = { children?: React.ReactNode } & SliderHandlers & Record<string, unknown>;

vi.mock("@radix-ui/react-slider", () => {
  const rootPropsRef: { current: MockSliderProps | null } = { current: null };

  const Root = ({ children, ...props }: MockSliderProps) => {
    rootPropsRef.current = props;
    return (
      <div data-testid="slider-root" {...props}>
        {children}
      </div>
    );
  };

  const Track = ({ children, ...props }: MockSliderProps) => (
    <div data-testid="slider-track" {...props}>
      {children}
    </div>
  );

  const Range = (props: MockSliderProps) => <div data-testid="slider-range" {...props} />;
  const Thumb = (props: MockSliderProps) => <button type="button" {...props} />;

  return {
    __rootPropsRef: rootPropsRef,
    Root,
    Track,
    Range,
    Thumb,
  };
});

import { RangeSlider, RangeSliderValue } from "../RangeSlider";
import * as SliderPrimitive from "@radix-ui/react-slider";

const getRootProps = () =>
  (
    SliderPrimitive as unknown as {
      __rootPropsRef: { current: MockSliderProps | null };
    }
  ).__rootPropsRef.current;

const expectRootProps = () => {
  const props = getRootProps();
  if (!props) {
    throw new Error("Range slider props not initialized");
  }
  return props;
};

describe("RangeSlider", () => {
  const defaultProps = {
    min: 1800,
    max: 2025,
    value: [1900, 1950] as RangeSliderValue,
    onChange: vi.fn(),
  };

  it("renders two accessible thumbs", () => {
    render(<RangeSlider {...defaultProps} />);

    expect(screen.getByLabelText("Range start")).toBeInTheDocument();
    expect(screen.getByLabelText("Range end")).toBeInTheDocument();
  });

  it("invokes onChange when the Radix slider value changes", () => {
    const handleChange = vi.fn();
    render(<RangeSlider {...defaultProps} onChange={handleChange} />);

    act(() => {
      expectRootProps().onValueChange?.([1910, 1960]);
    });

    expect(handleChange).toHaveBeenCalledWith([1910, 1960]);
  });

  it("invokes onCommit when the Radix slider value is committed", () => {
    const handleCommit = vi.fn();
    render(<RangeSlider {...defaultProps} onCommit={handleCommit} />);

    act(() => {
      expectRootProps().onValueCommit?.([1850, 1990]);
    });

    expect(handleCommit).toHaveBeenCalledWith([1850, 1990]);
  });
});
