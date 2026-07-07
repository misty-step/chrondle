import React from "react";
import { describe, expect, it, vi, beforeAll } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { DraggableEventCard } from "@/components/order/DraggableEventCard";
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

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: { role: "button", tabIndex: 0 },
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Translate: { toString: () => undefined } },
}));

beforeAll(() => {
  // jsdom has no ResizeObserver; DraggableEventCard uses it for truncation detection.
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

const event: OrderEvent = {
  id: "evt-1",
  text: "The Congress of Vienna convenes to redraw the map of Europe",
  year: 1815,
};

describe("Order DraggableEventCard — reorder interaction (design lab R2)", () => {
  it("labels the drag handle with the event and its position", () => {
    render(<DraggableEventCard event={event} index={1} total={4} />);

    expect(
      screen.getByLabelText(`Reorder “${event.text}”. Currently position 2 of 4.`),
    ).toBeInTheDocument();
  });

  it("meets the 44px minimum touch target on the drag handle", () => {
    render(<DraggableEventCard event={event} index={0} total={4} />);

    const handle = screen.getByLabelText(/Reorder/i);
    expect(handle.className).toContain("h-11");
  });

  it("renders Move up / Move down steppers at 44px each when handlers are supplied", () => {
    render(
      <DraggableEventCard
        event={event}
        index={1}
        total={4}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
      />,
    );

    const up = screen.getByRole("button", { name: `Move “${event.text}” up` });
    const down = screen.getByRole("button", { name: `Move “${event.text}” down` });
    expect(up.className).toContain("h-11");
    expect(up.className).toContain("w-11");
    expect(down.className).toContain("h-11");
    expect(down.className).toContain("w-11");
    expect(up).not.toBeDisabled();
    expect(down).not.toBeDisabled();
  });

  it("disables Move up at the top of the list and Move down at the bottom", () => {
    const { rerender } = render(
      <DraggableEventCard event={event} index={0} total={3} onMoveDown={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /up/i })).toBeDisabled();

    rerender(<DraggableEventCard event={event} index={2} total={3} onMoveUp={vi.fn()} />);
    expect(screen.getByRole("button", { name: /down/i })).toBeDisabled();
  });

  it("invokes onMoveUp / onMoveDown independently of the tap-to-expand target", () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    const onCardClick = vi.fn();

    render(
      <DraggableEventCard
        event={event}
        index={1}
        total={3}
        onCardClick={onCardClick}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: `Move “${event.text}” up` }));
    expect(onMoveUp).toHaveBeenCalledTimes(1);
    expect(onCardClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: `Move “${event.text}” down` }));
    expect(onMoveDown).toHaveBeenCalledTimes(1);
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it("keeps the tap-to-expand target a separate button from the steppers and handle", () => {
    const onCardClick = vi.fn();
    render(
      <DraggableEventCard
        event={event}
        index={0}
        total={3}
        onCardClick={onCardClick}
        onMoveDown={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText(event.text));
    expect(onCardClick).toHaveBeenCalledTimes(1);
  });

  it("hides the stepper column entirely when no move handlers are supplied (drag overlay ghost)", () => {
    render(<DraggableEventCard event={event} index={0} total={3} />);
    expect(screen.queryByRole("button", { name: /move/i })).not.toBeInTheDocument();
  });
});
