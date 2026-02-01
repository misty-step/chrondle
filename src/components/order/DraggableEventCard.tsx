"use client";

import { useEffect, useRef, useState } from "react";
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
  onCardClick?: () => void;
}

export function DraggableEventCard({
  event,
  index,
  feedback,
  showYear = false,
  onCardClick,
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
        onCardClick={onCardClick}
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
  onCardClick?: () => void;
}

function EventCardContent({
  event,
  index,
  feedback,
  showYear = false,
  listeners,
  attributes,
  mutedHandle = false,
  onCardClick,
}: EventCardContentProps) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const handleProps = { ...(listeners ?? {}), ...(attributes ?? {}) };
  const isInteractive = Boolean(onCardClick);

  // Truncation detection via ResizeObserver
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const checkTruncation = () => {
      setIsTruncated(el.scrollHeight > el.clientHeight);
    };

    checkTruncation();
    const observer = new ResizeObserver(checkTruncation);
    observer.observe(el);
    return () => observer.disconnect();
  }, [event.text]);

  return (
    <>
      {/* DRAG HANDLE */}
      <div
        className={[
          "flex touch-none items-center justify-center py-3",
          "cursor-grab active:cursor-grabbing",
          "bg-muted/30 border-border/30 rounded-t-sm border-b dark:border-white/10 dark:bg-[#1f1f23]",
        ].join(" ")}
        data-vaul-no-drag
        {...handleProps}
      >
        <div
          className={[
            "flex gap-1.5 transition-opacity",
            mutedHandle
              ? "opacity-20"
              : "opacity-60 hover:opacity-90 dark:opacity-70 dark:hover:opacity-100",
          ].join(" ")}
        >
          <div className="bg-foreground h-1.5 w-1.5 rounded-full" />
          <div className="bg-foreground h-1.5 w-1.5 rounded-full" />
          <div className="bg-foreground h-1.5 w-1.5 rounded-full" />
          <div className="bg-foreground h-1.5 w-1.5 rounded-full" />
        </div>
      </div>

      <div
        className={[
          "flex flex-1 items-start gap-4 px-4 py-4 sm:px-5",
          isInteractive && "cursor-pointer",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onCardClick}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onKeyDown={(e) => {
          if (!onCardClick) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onCardClick();
          }
        }}
        aria-describedby={isTruncated ? "truncation-hint" : undefined}
      >
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
          <p
            ref={textRef}
            className="font-event text-body-primary line-clamp-3 text-xl leading-relaxed"
          >
            {event.text}
          </p>
          {isTruncated && (
            <span id="truncation-hint" className="text-muted-foreground mt-1 block text-sm">
              Tap to read more
            </span>
          )}
        </div>
      </div>
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
      <div className="border-feedback-success/30 bg-feedback-success/10 flex h-9 w-9 items-center justify-center rounded border-2">
        <Check className="text-feedback-success h-5 w-5" aria-hidden="true" />
      </div>
    );
  }

  if (feedback === "incorrect") {
    return (
      <div className="border-destructive/30 bg-destructive/10 flex h-9 w-9 items-center justify-center rounded border-2">
        <X className="text-destructive h-5 w-5" aria-hidden="true" />
      </div>
    );
  }

  // No feedback yet - default badge
  return <div className="number-badge">{index + 1}</div>;
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
      ? "border-feedback-success/30"
      : feedback === "incorrect"
        ? "border-destructive/30"
        : "border-border";

  return [
    "relative flex min-h-[100px] flex-col rounded text-left will-change-transform transition-all duration-200",
    "bg-card dark:bg-[#27272a] border-2 dark:border-[#52525b]",
    feedbackBorder,
    isDragging ? "z-50 ring-2 ring-primary/20 scale-[1.02]" : "hover:-translate-y-0.5",
  ].join(" ");
}
