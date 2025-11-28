"use client";

import type { DraggableSyntheticListeners } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useReducedMotion } from "motion/react";
import { Check, X } from "lucide-react";
import { formatYear } from "@/lib/displayFormatting";
import type { OrderEvent, PositionFeedback } from "@/types/orderGameState";

export interface DraggableEventCardProps {
  event: OrderEvent;
  index: number;
  feedback?: PositionFeedback;
  showYear?: boolean;
}

export function DraggableEventCard({
  event,
  index,
  feedback,
  showYear = false,
}: DraggableEventCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: event.id,
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

  return (
    <motion.li ref={setNodeRef} style={style} className={cardClasses({ isDragging, feedback })}>
      <EventCardContent
        event={event}
        index={index}
        feedback={feedback}
        showYear={showYear}
        listeners={listeners}
        attributes={attributes}
      />
    </motion.li>
  );
}

export function OrderEventCardOverlay({
  event,
  index,
  feedback,
  showYear = false,
}: DraggableEventCardProps) {
  return (
    <div className={cardClasses({ isDragging: true, feedback })}>
      <EventCardContent
        event={event}
        index={index}
        feedback={feedback}
        showYear={showYear}
        mutedHandle
      />
    </div>
  );
}

interface EventCardContentProps {
  event: OrderEvent;
  index: number;
  feedback?: PositionFeedback;
  showYear?: boolean;
  listeners?: DraggableSyntheticListeners;
  attributes?: React.HTMLAttributes<HTMLElement>;
  mutedHandle?: boolean;
}

function EventCardContent({
  event,
  index,
  feedback,
  showYear = false,
  listeners,
  attributes,
  mutedHandle = false,
}: EventCardContentProps) {
  const handleProps = { ...(listeners ?? {}), ...(attributes ?? {}) };

  return (
    <>
      {/* DRAG HANDLE */}
      <div
        className={[
          "flex touch-none items-center justify-center py-3",
          "cursor-grab active:cursor-grabbing",
          "bg-muted/20 border-border/30 rounded-t-sm border-b",
        ].join(" ")}
        {...handleProps}
      >
        <div
          className={[
            "flex gap-1.5 transition-opacity",
            mutedHandle ? "opacity-20" : "opacity-50 hover:opacity-80",
          ].join(" ")}
        >
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

        {/* Position Indicator with Feedback */}
        <div className="flex min-w-[36px] flex-shrink-0 items-center justify-center sm:min-w-[32px]">
          <PositionBadge index={index} feedback={feedback} />
        </div>

        {/* Event Text */}
        <div className="min-w-0 flex-1">
          <p className="font-event text-body-primary line-clamp-3 text-xl leading-relaxed">
            {event.text}
          </p>
        </div>
      </div>

      {/* Feedback Badge */}
      {feedback && <FeedbackBadge feedback={feedback} />}
    </>
  );
}

interface PositionBadgeProps {
  index: number;
  feedback?: PositionFeedback;
}

function PositionBadge({ index, feedback }: PositionBadgeProps) {
  if (feedback === "correct") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-green-500/30 bg-green-500/10">
        <Check className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
      </div>
    );
  }

  if (feedback === "incorrect") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-red-500/30 bg-red-500/10">
        <span className="text-base font-semibold text-red-600 dark:text-red-400">{index + 1}</span>
      </div>
    );
  }

  // No feedback yet - default badge
  return <div className="number-badge">{index + 1}</div>;
}

interface FeedbackBadgeProps {
  feedback: PositionFeedback;
}

function FeedbackBadge({ feedback }: FeedbackBadgeProps) {
  if (feedback === "correct") {
    return (
      <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 shadow-sm">
        <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" aria-hidden="true" />
        <span className="text-[10px] font-semibold tracking-wide text-green-600 uppercase dark:text-green-400">
          Correct
        </span>
      </div>
    );
  }

  return (
    <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 shadow-sm">
      <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-hidden="true" />
      <span className="text-[10px] font-semibold tracking-wide text-red-600 uppercase dark:text-red-400">
        Wrong
      </span>
    </div>
  );
}

function cardClasses({
  isDragging,
  feedback,
}: {
  isDragging: boolean;
  feedback?: PositionFeedback;
}) {
  const feedbackBorder =
    feedback === "correct"
      ? "border-green-500/30"
      : feedback === "incorrect"
        ? "border-red-500/30"
        : "border-border";

  return [
    "relative flex min-h-[100px] flex-col rounded-sm text-left will-change-transform transition-all duration-200",
    "bg-card border-2",
    feedbackBorder,
    isDragging
      ? "z-50 shadow-hard-lg ring-2 ring-primary/20 scale-[1.02]"
      : "shadow-hard hover:shadow-hard-lg hover:-translate-y-0.5",
  ].join(" ");
}
