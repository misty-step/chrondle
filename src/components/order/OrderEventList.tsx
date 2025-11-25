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
import type { OrderEvent, OrderHint } from "@/types/orderGameState";
import { DraggableEventCard, OrderEventCardOverlay } from "@/components/order/DraggableEventCard";

interface OrderEventListProps {
  events: OrderEvent[];
  ordering: string[];
  onOrderingChange: (ordering: string[], movedId?: string) => void;
  lockedPositions?: Map<string, number>;
  hintsByEvent?: Record<string, OrderHint[]>;
}

export function OrderEventList({
  events,
  ordering,
  onOrderingChange,
  lockedPositions = new Map(),
  hintsByEvent = {},
}: OrderEventListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Increased from 4px - requires more deliberate movement
        distance: 8,
        // 150ms delay prevents accidental drag when scrolling on mobile
        delay: 150,
        // Allow small movements during delay without canceling
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

    setLocalOrder((prev) => reorder(prev, String(active.id), String(over.id), lockedPositions));
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
  const activeHints = activeEvent ? (hintsByEvent[activeEvent.id] ?? []) : [];
  const activeLocked = activeEvent ? lockedPositions.has(activeEvent.id) : false;

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
                  isLocked={lockedPositions.has(event.id)}
                  activeHints={hintsByEvent[event.id] ?? []}
                  allEvents={events}
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
              activeHints={activeHints}
              allEvents={events}
              isLocked={activeLocked}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function reorder(
  items: string[],
  activeId: string,
  overId: string,
  lockedPositions?: Map<string, number>,
): string[] {
  const oldIndex = items.indexOf(activeId);
  const newIndex = items.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return items;
  }

  // Prevent dragging locked events (defensive check - already disabled in UI)
  if (lockedPositions && lockedPositions.has(activeId)) {
    return items;
  }

  // Perform the move
  let result = arrayMove(items, oldIndex, newIndex);

  // Restore all locked items to their locked positions
  if (lockedPositions && lockedPositions.size > 0) {
    result = restoreLockedPositions(result, lockedPositions);
  }

  return result;
}

function restoreLockedPositions(items: string[], lockedPositions: Map<string, number>): string[] {
  // eslint-disable-next-line prefer-const -- mutated via splice operations
  let result = [...items];

  // Sort locked positions to process them in order (prevents cascading shifts)
  const locks = Array.from(lockedPositions.entries()).sort(([, posA], [, posB]) => posA - posB);

  for (const [eventId, lockedPosition] of locks) {
    const currentIndex = result.indexOf(eventId);
    if (currentIndex !== -1 && currentIndex !== lockedPosition) {
      // Remove from current position
      const [movedEvent] = result.splice(currentIndex, 1);
      // Insert at locked position
      result.splice(lockedPosition, 0, movedEvent);
    }
  }

  return result;
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
