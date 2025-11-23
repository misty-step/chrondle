import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExpandableText } from "../ExpandableText";
import { describe, it, expect, vi, afterEach } from "vitest";

describe("ExpandableText", () => {
  const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
  const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

  afterEach(() => {
    if (originalScrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
    if (originalClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
  });

  it("renders text correctly", () => {
    render(<ExpandableText text="Hello World" />);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("shows 'Show more' button when text overflows", async () => {
    // Mock overflow: scrollHeight > clientHeight
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 100 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 50 });

    render(<ExpandableText text="Long text" />);

    // Wait for effect
    await waitFor(() => {
      expect(screen.getByText("Show more")).toBeInTheDocument();
    });
  });

  it("does not show toggle button when text does not overflow", async () => {
    // Mock no overflow: scrollHeight <= clientHeight
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 50 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 50 });

    render(<ExpandableText text="Short text" />);

    // Check that button is not there. We use queryByText and expect null.
    // Need to wait briefly because of the timeout in the component
    await new Promise((r) => setTimeout(r, 150));

    expect(screen.queryByText("Show more")).not.toBeInTheDocument();
  });

  it("expands text and changes button to 'Show less' when clicked", async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 100 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 50 });

    render(<ExpandableText text="Long text" />);

    await waitFor(() => {
      expect(screen.getByText("Show more")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Show more"));

    expect(screen.getByText("Show less")).toBeInTheDocument();
    expect(screen.queryByText("Show more")).not.toBeInTheDocument();
  });

  it("toggles back to 'Show more' when 'Show less' is clicked", async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 100 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 50 });

    render(<ExpandableText text="Long text" />);

    await waitFor(() => {
      expect(screen.getByText("Show more")).toBeInTheDocument();
    });

    const button = screen.getByText("Show more");
    fireEvent.click(button);

    await waitFor(() => {
        expect(screen.getByText("Show less")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Show less"));

    await waitFor(() => {
        expect(screen.getByText("Show more")).toBeInTheDocument();
    });
  });
});
