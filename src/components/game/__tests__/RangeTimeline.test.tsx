import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RangeTimeline, RangeTimelineRange } from "../RangeTimeline";

describe("RangeTimeline", () => {
  const baseRanges: RangeTimelineRange[] = [
    { start: 1900, end: 1920, score: 400, contained: true, hintsUsed: 1 },
    { start: 1950, end: 1980, score: 200, contained: false, hintsUsed: 2 },
  ];

  it("renders a bar for each range", () => {
    render(<RangeTimeline ranges={baseRanges} targetYear={1969} isComplete={false} />);

    expect(screen.getAllByTestId("range-bar")).toHaveLength(baseRanges.length);
  });

  it("only shows the answer marker when complete", () => {
    const { rerender } = render(
      <RangeTimeline ranges={baseRanges} targetYear={1969} isComplete={false} />,
    );

    expect(screen.queryByTestId("answer-marker")).toBeNull();

    rerender(<RangeTimeline ranges={baseRanges} targetYear={1969} isComplete={true} />);

    expect(screen.getByTestId("answer-marker")).toBeInTheDocument();
  });

  it("shows fallback text when no ranges exist", () => {
    render(<RangeTimeline ranges={[]} targetYear={null} isComplete={false} />);

    expect(screen.getByText(/submit a range to see it on the timeline/i)).toBeInTheDocument();
  });
});
