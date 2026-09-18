"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  DragCancelEvent,
  DragOverlay,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import type { OrderEvent, PositionFeedback } from "@/types/orderGameState";
import { DraggableEventCard, OrderEventCardOverlay } from "@/components/order/DraggableEventCard";
import { EventDetailDrawer } from "@/components/order/EventDetailDrawer";

interface OrderEventListProps {
  events: OrderEvent[];
  ordering: string[];
  onOrderingChange: (ordering: string[], movedId?: string) => void;
  /** Optional per-position feedback from last attempt */
  feedback?: PositionFeedback[];
}

export function OrderEventList({
  events,
  ordering,
  onOrderingChange,
  feedback,
}: OrderEventListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const [announcement, setAnnouncement] = useState<string>("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<string[]>(ordering);
  const latestOrderRef = useRef(localOrder);

  // Drawer state for viewing full event text
  const [drawerEvent, setDrawerEvent] = useState<OrderEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Block drawer during active drag
  const handleCardClick = (event: OrderEvent) => {
    if (activeId) return;
    setDrawerEvent(event);
    setDrawerOpen(true);
  };

  useEffect(() => {
    latestOrderRef.current = localOrder;
  }, [localOrder]);

  const eventMap = useMemo(() => {
    const map = new Map<string, OrderEvent>();
    for (const event of events) {
      map.set(event.id, event);
    }
    return map;
  }, [events]);

  const describe = useCallback(
    (id: string | number) => eventMap.get(String(id))?.text ?? "Event",
    [eventMap],
  );

  // Design-lab R2 winner (docs/labs/order-reorder-interaction-lab.html): drag pickup/move/drop/cancel
  // is announced through dnd-kit's own accessible live region, with event-specific text.
  const dndAnnouncements = useMemo<Announcements>(
    () => ({
      onDragStart({ active }) {
        const position = ordering.indexOf(String(active.id));
        return `${describe(active.id)} picked up. Position ${position + 1} of ${ordering.length}. Use the up and down arrow keys to move, space bar to drop, escape to cancel.`;
      },
      onDragOver({ active, over }) {
        if (!over) return `${describe(active.id)} is no longer over a droppable position.`;
        const position = latestOrderRef.current.indexOf(String(active.id));
        if (position === -1) return undefined;
        return `${describe(active.id)} moved to position ${position + 1} of ${ordering.length}.`;
      },
      onDragEnd({ active, over }) {
        if (!over) {
          return `${describe(active.id)} dropped. Order unchanged.`;
        }
        const position = latestOrderRef.current.indexOf(String(active.id));
        return `${describe(active.id)} dropped at position ${position === -1 ? 1 : position + 1} of ${ordering.length}.`;
      },
      onDragCancel({ active }) {
        const position = ordering.indexOf(String(active.id));
        return `Reorder cancelled. ${describe(active.id)} back at position ${position + 1} of ${ordering.length}.`;
      },
    }),
    [describe, ordering],
  );

  const screenReaderInstructions = useMemo(
    () => ({
      draggable:
        "To reorder this event: press space or enter to pick it up, use the up and down arrow keys to move it, then press space or enter again to drop it. Press escape to cancel. Alternatively, use the Move up and Move down buttons next to each event.",
    }),
    [],
  );

  // Discrete/keyboard control (design-lab R2 winner) — moves one position at a time via the same
  // onOrderingChange path drag already uses, and announces through our own live region since
  // stepper clicks are not part of the DnD lifecycle dnd-kit's own announcer covers.
  const moveItem = useCallback(
    (id: string, direction: "up" | "down") => {
      const from = ordering.indexOf(id);
      if (from === -1) return;
      const to = direction === "up" ? from - 1 : from + 1;
      if (to < 0 || to >= ordering.length) return;

      const next = arrayMove(ordering, from, to);
      onOrderingChange(next, id);
      setAnnouncement(`${describe(id)} moved to position ${to + 1} of ${ordering.length}.`);
    },
    [ordering, onOrderingChange, describe],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setLocalOrder(ordering);
    latestOrderRef.current = ordering;
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      return;
    }

    setLocalOrder((prev) => reorder(prev, String(active.id), String(over.id)));
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    setActiveId(null);
    setLocalOrder(ordering);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      setLocalOrder(ordering);
      return;
    }

    const movedId = String(active.id);
    const finalOrder = latestOrderRef.current;

    onOrderingChange(finalOrder, movedId);
    // Pickup/move/drop/cancel are announced by dnd-kit's own live region via `dndAnnouncements`
    // below — no separate announcement needed here.

    setLocalOrder(finalOrder);
  };

  const activeEvent = activeId ? eventMap.get(activeId) : null;
  const displayedOrder = activeId ? localOrder : ordering;
  const activeIndex = activeId ? displayedOrder.indexOf(activeId) : -1;

  return (
    <div className="relative">
      {/* Timeline Spine (Visual Connector) */}
      <div className="bg-timeline-spine/20 absolute top-4 bottom-4 left-[34px] w-[2px] rounded-full" />

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        accessibility={{ announcements: dndAnnouncements, screenReaderInstructions }}
      >
        <SortableContext items={displayedOrder} strategy={verticalListSortingStrategy}>
          <ol className="space-y-4">
            {displayedOrder.map((eventId, index) => {
              const event = eventMap.get(eventId);
              if (!event) return null;
              const committedIndex = ordering.indexOf(eventId);
              return (
                <DraggableEventCard
                  key={event.id}
                  event={event}
                  index={index}
                  total={displayedOrder.length}
                  feedback={feedback?.[index]}
                  onCardClick={() => handleCardClick(event)}
                  onMoveUp={committedIndex > 0 ? () => moveItem(eventId, "up") : undefined}
                  onMoveDown={
                    committedIndex !== -1 && committedIndex < ordering.length - 1
                      ? () => moveItem(eventId, "down")
                      : undefined
                  }
                />
              );
            })}
          </ol>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeEvent ? (
            <OrderEventCardOverlay
              event={activeEvent}
              index={activeIndex === -1 ? 0 : activeIndex}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <EventDetailDrawer open={drawerOpen} onOpenChange={setDrawerOpen} event={drawerEvent} />
    </div>
  );
}

function reorder(items: string[], activeId: string, overId: string): string[] {
  const oldIndex = items.indexOf(activeId);
  const newIndex = items.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return items;
  }
  return arrayMove(items, oldIndex, newIndex);
}
