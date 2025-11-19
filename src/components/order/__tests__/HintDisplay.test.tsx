import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { HintDisplay } from "@/components/order/HintDisplay";
import type { OrderEvent, OrderHint } from "@/types/orderGameState";

vi.stubGlobal("React", React);

vi.mock("motion/react", () => ({
  motion: {
    li: ({
      children,
      layout: _layout,
      ...props
    }: React.HTMLAttributes<HTMLLIElement> & { layout?: boolean }) => (
      <li {...props}>{children}</li>
    ),
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  LayoutGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

vi.mock("@/components/ui/LoadingSpinner", () => ({
  LoadingSpinner: () => <span data-testid="spinner" />,
}));

const events: OrderEvent[] = [
  { id: "a", text: "Event A", year: 1200 },
  { id: "b", text: "Event B", year: 1500 },
  { id: "c", text: "Event C", year: 1800 },
];

const defaultProps = {
  events,
  hints: [] as OrderHint[],
  onRequestHint: vi.fn(),
};

describe("Order HintDisplay", () => {
  it("renders hints remaining", () => {
    render(<HintDisplay {...defaultProps} />);

    // Component shows hints remaining count (mobile shows "3/3", desktop shows "3 hints remaining")
    // Using getAllByText since both mobile and desktop views render
    const hintsText = screen.getAllByText(/3|remaining/i);
    expect(hintsText.length).toBeGreaterThan(0);
  });

  it("invokes callback when selecting a hint", () => {
    const onRequestHint = vi.fn();
    render(<HintDisplay {...defaultProps} onRequestHint={onRequestHint} />);

    // Find the first button with anchor hint (there may be mobile and desktop versions)
    const buttons = screen.getAllByRole("button", { name: /anchor hint|take anchor hint/i });
    fireEvent.click(buttons[0]);

    expect(onRequestHint).toHaveBeenCalledWith("anchor");
  });

  it("disables hint option when marked", () => {
    render(<HintDisplay {...defaultProps} disabledTypes={{ anchor: true }} />);

    // Find the first anchor button (mobile or desktop version)
    const buttons = screen.getAllByRole("button", { name: /anchor hint|take anchor hint/i });
    const button = buttons[0] as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("shows hint history entries when hints exist", async () => {
    const hints: OrderHint[] = [{ type: "anchor", eventId: "b", position: 2 }];

    render(<HintDisplay {...defaultProps} hints={hints} />);

    // Check that hints history section exists
    expect(screen.getByText(/view hints used/i)).toBeInTheDocument();

    // For detailed validation, expand the accordion and check content
    // Note: Accordion content may be collapsed by default
    const accordion = screen.getByText(/view hints used/i);
    fireEvent.click(accordion);

    // Now check for hint details (they should be in the expanded accordion)
    await screen.findByText(/Event B/i, {}, { timeout: 1000 });
    expect(screen.getByText(/position 3/i)).toBeInTheDocument();
  });

  it("shows error message when provided", () => {
    render(<HintDisplay {...defaultProps} error="Unable to generate hint" />);

    // Error message appears (potentially in both mobile and desktop views)
    const errorMessages = screen.getAllByText("Unable to generate hint");
    expect(errorMessages.length).toBeGreaterThan(0);
  });
});
