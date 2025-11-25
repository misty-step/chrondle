"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import type { DraggableSyntheticListeners } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useReducedMotion } from "motion/react";
import { Lock, Anchor, ArrowRight, CalendarRange } from "lucide-react";
import { formatYear } from "@/lib/displayFormatting";
import type { OrderEvent, OrderHint } from "@/types/orderGameState";

export interface DraggableEventCardProps {
  event: OrderEvent;
  index: number;
  isLocked?: boolean;
  activeHints?: OrderHint[];
  showYear?: boolean;
  allEvents?: OrderEvent[];
}

export function DraggableEventCard({
  event,
  index,
  isLocked = false,
  activeHints = [],
  showYear = false,
  allEvents = [],
}: DraggableEventCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: event.id,
    disabled: isLocked,
    animateLayoutChanges: (args) => {
      if (prefersReducedMotion) return false;
      const { isSorting, wasDragging } = args;
      if (isSorting || wasDragging) return true;
      return true;
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: prefersReducedMotion
      ? undefined
      : transition || "transform 150ms cubic-bezier(0.2, 0, 0.38, 0.9)",
    opacity: isDragging ? 0 : 1,
  };

  const eventsById = useMemo(() => new Map(allEvents.map((e) => [e.id, e])), [allEvents]);
  const hintDescriptors = useMemo(
    () => describeHints(activeHints, event.id, eventsById),
    [activeHints, event.id, eventsById],
  );

  return (
    <motion.li
      ref={setNodeRef}
      style={style}
      className={cardClasses({ isDragging, isLocked })}
      {...attributes}
    >
      <EventCardContent
        event={event}
        index={index}
        hints={hintDescriptors}
        showYear={showYear}
        isLocked={isLocked}
        listeners={listeners}
      />
    </motion.li>
  );
}

export function OrderEventCardOverlay({
  event,
  index,
  activeHints = [],
  showYear = false,
  allEvents = [],
  isLocked = false,
}: DraggableEventCardProps) {
  const eventsById = useMemo(() => new Map(allEvents.map((e) => [e.id, e])), [allEvents]);
  const hintDescriptors = useMemo(
    () => describeHints(activeHints, event.id, eventsById),
    [activeHints, event.id, eventsById],
  );

  return (
    <div className={cardClasses({ isDragging: true, isLocked })}>
      <EventCardContent
        event={event}
        index={index}
        hints={hintDescriptors}
        showYear={showYear}
        isLocked={isLocked}
        mutedHandle
      />
    </div>
  );
}

type HintDescriptor = {
  icon: ReactNode;
  label: ReactNode;
};

interface EventCardContentProps {
  event: OrderEvent;
  index: number;
  hints: HintDescriptor[];
  showYear?: boolean;
  isLocked?: boolean;
  listeners?: DraggableSyntheticListeners;
  mutedHandle?: boolean;
}

function EventCardContent({
  event,
  index,
  hints,
  showYear = false,
  isLocked = false,
  listeners,
  mutedHandle = false,
}: EventCardContentProps) {
  const handleProps = listeners ?? {};

  return (
    <>
      <div
        className={[
          "flex touch-none items-center justify-center py-3",
          isLocked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
          "bg-muted/20 border-border/30 rounded-t-sm border-b", // Subtle separation
        ].join(" ")}
        {...handleProps}
      >
        <div
          className={[
            "flex gap-1.5 transition-opacity", // Horizontal dots - larger for mobile touch
            isLocked || mutedHandle ? "opacity-20" : "opacity-50 hover:opacity-80",
          ].join(" ")}
        >
          {/* Grip Dots - larger for mobile touch clarity */}
          <div className="bg-foreground h-1.5 w-1.5 rounded-full" />
          <div className="bg-foreground h-1.5 w-1.5 rounded-full" />
          <div className="bg-foreground h-1.5 w-1.5 rounded-full" />
          <div className="bg-foreground h-1.5 w-1.5 rounded-full" />
        </div>
      </div>

      <div className="flex flex-1 items-start gap-4 px-4 py-4 sm:px-5">
        {/* Year Tab - Only shown in results view */}
        {showYear && (
          <div className="absolute top-3 -left-3 flex items-center">
            <div className="bg-timeline-spine rounded px-2 py-1 text-white shadow-sm">
              <span className="font-year text-xs whitespace-nowrap">{formatYear(event.year)}</span>
            </div>
          </div>
        )}

        {/* Position Indicator - Vermilion badge, larger on mobile */}
        <div className="flex min-w-[36px] flex-shrink-0 items-center justify-center sm:min-w-[32px]">
          <div className="number-badge">{index + 1}</div>
        </div>

        <div className="min-w-0 flex-1">
          {/* Event Text - Larger, more readable serif typography */}
          <p className="font-event text-primary line-clamp-3 text-xl leading-relaxed">
            {event.text}
          </p>

          {hints.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {hints.map((hint, idx) => (
                <li
                  key={idx}
                  className="bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                >
                  <span>{hint.icon}</span>
                  <span className="text-muted-foreground">{hint.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {isLocked && <LockedBadge />}
    </>
  );
}

function LockedBadge() {
  return (
    <div
      className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full border px-2 py-1 shadow-sm"
      style={{
        backgroundColor: "var(--locked-badge-bg)",
        borderColor: "var(--locked-badge)",
      }}
    >
      <Lock className="h-3.5 w-3.5" style={{ color: "var(--locked-badge)" }} aria-hidden="true" />
      <span
        className="text-[10px] font-semibold tracking-wide uppercase"
        style={{ color: "var(--locked-badge)" }}
      >
        Locked
      </span>
    </div>
  );
}

function cardClasses({ isDragging, isLocked }: { isDragging: boolean; isLocked: boolean }) {
  return [
    "relative flex min-h-[100px] flex-col rounded-sm text-left will-change-transform transition-all duration-200",
    "bg-card border-2 border-border", // Angular archival border
    isDragging
      ? "z-50 shadow-hard-lg ring-2 ring-primary/20 scale-[1.02]"
      : "shadow-hard hover:shadow-hard-lg hover:-translate-y-0.5",
    isLocked ? "cursor-not-allowed bg-muted/30 opacity-90" : "cursor-grab active:cursor-grabbing",
  ].join(" ");
}

function describeHints(
  hints: OrderHint[],
  eventId: string,
  eventsById: Map<string, OrderEvent>,
): HintDescriptor[] {
  return hints
    .map((hint) => {
      switch (hint.type) {
        case "anchor":
          if (hint.eventId === eventId) {
            return {
              icon: <Anchor className="h-3 w-3" aria-hidden="true" />,
              label: `Locked at ${hint.position + 1}`,
            };
          }
          return null;

        case "bracket":
          if (hint.eventId === eventId) {
            return {
              icon: <CalendarRange className="h-3 w-3" aria-hidden="true" />,
              label: `${formatYear(hint.yearRange[0])}–${formatYear(hint.yearRange[1])}`,
            };
          }
          return null;

        case "relative": {
          if (hint.earlierEventId === eventId) {
            const laterEvent = eventsById.get(hint.laterEventId);
            const laterName = laterEvent?.text ?? "other event";
            return {
              icon: <ArrowRight className="h-3 w-3" aria-hidden="true" />,
              label: (
                <span className="inline-flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground italic">happens before</span>
                  <span className="text-primary font-semibold">{truncate(laterName, 25)}</span>
                </span>
              ),
            };
          }

          if (hint.laterEventId === eventId) {
            const earlierEvent = eventsById.get(hint.earlierEventId);
            const earlierName = earlierEvent?.text ?? "other event";
            return {
              icon: <ArrowRight className="h-3 w-3 rotate-180" aria-hidden="true" />,
              label: (
                <span className="inline-flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground italic">happens after</span>
                  <span className="text-primary font-semibold">{truncate(earlierName, 25)}</span>
                </span>
              ),
            };
          }
          return null;
        }

        default:
          return null;
      }
    })
    .filter((hint): hint is NonNullable<typeof hint> => hint !== null);
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}
