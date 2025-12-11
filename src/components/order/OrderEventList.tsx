"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

  useEffect(() => {
    if (activeId) {
      return;
    }
    setLocalOrder((prev) => (ordersMatch(prev, ordering) ? prev : ordering));
  }, [ordering, activeId]);

  const eventMap = useMemo(() => {
    const map = new Map<string, OrderEvent>();
    for (const event of events) {
      map.set(event.id, event);
    }
    return map;
  }, [events]);

  const handleDragStart = (event: DragStartEvent) => {
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

    const movedEvent = eventMap.get(movedId);
    const newIndex = finalOrder.indexOf(movedId);
    if (movedEvent && newIndex !== -1) {
      setAnnouncement(`${movedEvent.text} moved to position ${newIndex + 1}`);
    } else if (newIndex !== -1) {
      setAnnouncement(`Item moved to position ${newIndex + 1}`);
    }

    setLocalOrder(finalOrder);
  };

  const activeEvent = activeId ? eventMap.get(activeId) : null;
  const activeIndex = activeId ? localOrder.indexOf(activeId) : -1;

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
      >
        <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
          <ol className="space-y-4">
            {localOrder.map((eventId, index) => {
              const event = eventMap.get(eventId);
              if (!event) return null;
              return (
                <DraggableEventCard
                  key={event.id}
                  event={event}
                  index={index}
                  feedback={feedback?.[index]}
                  onCardClick={() => handleCardClick(event)}
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

function ordersMatch(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
