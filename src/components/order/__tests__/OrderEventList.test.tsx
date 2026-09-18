import React from "react";
import { describe, expect, it, vi, beforeAll } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { OrderEventList } from "@/components/order/OrderEventList";
import type { OrderEvent } from "@/types/orderGameState";

vi.stubGlobal("React", React);

vi.mock("motion/react", () => ({
  motion: {
    li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
      <li {...props}>{children}</li>
    ),
  },
  useReducedMotion: () => false,
}));

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

const events: OrderEvent[] = [
  { id: "a", text: "Event A happens first", year: 1200 },
  { id: "b", text: "Event B happens second", year: 1500 },
  { id: "c", text: "Event C happens third", year: 1800 },
];

describe("Order OrderEventList — discrete Move up/down control (design lab R2 winner)", () => {
  it("moves an event down and reports the new ordering with the moved id", () => {
    const onOrderingChange = vi.fn();
    render(
      <OrderEventList
        events={events}
        ordering={["a", "b", "c"]}
        onOrderingChange={onOrderingChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: `Move “${events[0].text}” down` }));

    expect(onOrderingChange).toHaveBeenCalledWith(["b", "a", "c"], "a");
  });

  it("moves an event up and reports the new ordering with the moved id", () => {
    const onOrderingChange = vi.fn();
    render(
      <OrderEventList
        events={events}
        ordering={["a", "b", "c"]}
        onOrderingChange={onOrderingChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: `Move “${events[2].text}” up` }));

    expect(onOrderingChange).toHaveBeenCalledWith(["a", "c", "b"], "c");
  });

  it("announces the stepper-triggered move via a polite live region", () => {
    render(
      <OrderEventList events={events} ordering={["a", "b", "c"]} onOrderingChange={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: `Move “${events[0].text}” down` }));

    expect(screen.getByText(/Event A happens first moved to position 2 of 3/i)).toBeInTheDocument();
  });

  it("disables Move up for the first item and Move down for the last (buttons stay visible, boundary is disabled)", () => {
    render(
      <OrderEventList events={events} ordering={["a", "b", "c"]} onOrderingChange={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: `Move “${events[0].text}” up` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Move “${events[2].text}” down` })).toBeDisabled();
    // Middle item can move both directions.
    expect(screen.getByRole("button", { name: `Move “${events[1].text}” up` })).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: `Move “${events[1].text}” down` }),
    ).not.toBeDisabled();
  });

  it("wires dnd-kit's own accessible live region with custom pickup/move/drop instructions", () => {
    render(
      <OrderEventList events={events} ordering={["a", "b", "c"]} onOrderingChange={vi.fn()} />,
    );

    // dnd-kit's Accessibility component renders a hidden instructions node plus a role="status"
    // live region once mounted; our screenReaderInstructions.draggable text should be present.
    expect(screen.getByText(/Move up and Move down buttons/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
