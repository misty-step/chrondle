import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { RangePreview } from "../RangePreview";

describe("RangePreview", () => {
  const props = {
    start: 1900,
    end: 1950,
    width: 51,
    hintsUsed: 2, // 70 points max (2 hints revealed)
  };

  it("shows range boundaries with BC/AD formatting", () => {
    render(<RangePreview {...props} />);
    // Should show formatted years with AD
    expect(screen.getByText(/1900 AD – 1950 AD/)).toBeInTheDocument();
    expect(screen.getByText(/51 years/)).toBeInTheDocument();
  });

  it("displays score potential when range is valid", () => {
    render(<RangePreview {...props} />);
    // Should show score with XXX pts format (now without ~)
    expect(screen.getByText(/Potential Score/)).toBeInTheDocument();
    expect(screen.getByText(/\d+ pts/)).toBeInTheDocument();
  });

  it("shows max possible score when range exceeds limit", () => {
    const invalidProps = { ...props, width: 300 };
    render(<RangePreview {...invalidProps} />);
    // Should show "Range too wide" message
    expect(screen.getByText(/Range too wide/)).toBeInTheDocument();
    expect(screen.getByText(/max \d+ pts/)).toBeInTheDocument();
  });

  it("handles BC years correctly", () => {
    const bcProps = {
      start: -500,
      end: -400,
      width: 101,
      hintsUsed: 0, // 100 points max (no hints)
    };
    render(<RangePreview {...bcProps} />);
    // Should format as BC
    expect(screen.getByText(/500 BC – 400 BC/)).toBeInTheDocument();
  });
});
