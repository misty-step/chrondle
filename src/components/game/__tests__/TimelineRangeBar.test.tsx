import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { TimelineRangeBar } from "../TimelineRangeBar";

// jsdom lays every element out at 0×0 - stub a fixed, non-zero track rect so
// pointer-position math is deterministic. Track spans a 1000px-wide element
// mapped left-to-right across the full [minYear, maxYear] span.
function mockTrackRect() {
  vi.spyOn(HTMLDivElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    right: 1000,
    width: 1000,
    top: 0,
    bottom: 40,
    height: 40,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

describe("TimelineRangeBar", () => {
  const minYear = -1000;
  const maxYear = 1000;
  // 2000-year span over a 1000px track = 2 years/px.

  beforeEach(() => {
    mockTrackRect();
  });

  it("renders no handles until a range exists", () => {
    render(
      <TimelineRangeBar
        minYear={minYear}
        maxYear={maxYear}
        value={[0, 0]}
        hasValue={false}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("draws a fresh range anchored at the press point on a single drag", () => {
    const onChange = vi.fn();
    render(
      <TimelineRangeBar
        minYear={minYear}
        maxYear={maxYear}
        value={[0, 0]}
        hasValue={false}
        onChange={onChange}
      />,
    );

    const track = screen.getByTestId("timeline-range-track");

    // Press at x=500 (year 0), drag to x=750 (year 500).
    fireEvent.pointerDown(track, { clientX: 500, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith([0, 0]);

    fireEvent.pointerMove(track, { clientX: 750, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith([0, 500]);

    fireEvent.pointerUp(track, { clientX: 750, pointerId: 1 });
  });

  it("draws the range symmetrically when the drag moves left of the anchor", () => {
    const onChange = vi.fn();
    render(
      <TimelineRangeBar
        minYear={minYear}
        maxYear={maxYear}
        value={[0, 0]}
        hasValue={false}
        onChange={onChange}
      />,
    );

    const track = screen.getByTestId("timeline-range-track");

    // Press at x=750 (year 500), drag left to x=500 (year 0).
    fireEvent.pointerDown(track, { clientX: 750, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 500, pointerId: 1 });

    expect(onChange).toHaveBeenLastCalledWith([0, 500]);
  });

  it("ignores pointer movement before a press starts a drag", () => {
    const onChange = vi.fn();
    render(
      <TimelineRangeBar
        minYear={minYear}
        maxYear={maxYear}
        value={[0, 0]}
        hasValue={false}
        onChange={onChange}
      />,
    );

    fireEvent.pointerMove(screen.getByTestId("timeline-range-track"), { clientX: 750 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not draw a range when disabled", () => {
    const onChange = vi.fn();
    render(
      <TimelineRangeBar
        minYear={minYear}
        maxYear={maxYear}
        value={[0, 0]}
        hasValue={false}
        onChange={onChange}
        disabled
      />,
    );

    fireEvent.pointerDown(screen.getByTestId("timeline-range-track"), {
      clientX: 500,
      pointerId: 1,
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders start/end slider handles with era-aware labels once a range exists", () => {
    render(
      <TimelineRangeBar
        minYear={minYear}
        maxYear={maxYear}
        value={[-100, 200]}
        hasValue
        onChange={vi.fn()}
      />,
    );

    const start = screen.getByTestId("timeline-handle-start");
    const end = screen.getByTestId("timeline-handle-end");

    expect(start).toHaveAttribute("role", "slider");
    expect(start).toHaveAttribute("aria-valuetext", "100 BC");
    expect(end).toHaveAttribute("role", "slider");
    expect(end).toHaveAttribute("aria-valuetext", "200 AD");
  });

  it("nudges the start handle by 1 year on ArrowRight and 10 on Shift+ArrowRight", () => {
    const onChange = vi.fn();
    render(
      <TimelineRangeBar
        minYear={minYear}
        maxYear={maxYear}
        value={[0, 500]}
        hasValue
        onChange={onChange}
      />,
    );

    const start = screen.getByTestId("timeline-handle-start");

    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith([1, 500]);

    fireEvent.keyDown(start, { key: "ArrowRight", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith([10, 500]);
  });

  it("clamps the start handle so it never crosses the end handle", () => {
    const onChange = vi.fn();
    render(
      <TimelineRangeBar
        minYear={minYear}
        maxYear={maxYear}
        value={[498, 500]}
        hasValue
        onChange={onChange}
      />,
    );

    const start = screen.getByTestId("timeline-handle-start");
    fireEvent.keyDown(start, { key: "ArrowRight", shiftKey: true });

    expect(onChange).toHaveBeenLastCalledWith([500, 500]);
  });

  it("does not respond to keyboard input when disabled", () => {
    const onChange = vi.fn();
    render(
      <TimelineRangeBar
        minYear={minYear}
        maxYear={maxYear}
        value={[0, 500]}
        hasValue
        onChange={onChange}
        disabled
      />,
    );

    fireEvent.keyDown(screen.getByTestId("timeline-handle-start"), { key: "ArrowRight" });
    expect(onChange).not.toHaveBeenCalled();
  });
});
