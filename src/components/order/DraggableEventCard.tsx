"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { DraggableSyntheticListeners } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useReducedMotion } from "motion/react";
import { CaretDown, CaretUp, Check, DotsSixVertical, X } from "@/components/kit/icons";
import { formatYear } from "@/lib/displayFormatting";
import type { OrderEvent, PositionFeedback } from "@/types/orderGameState";

export interface DraggableEventCardProps {
  event: OrderEvent;
  index: number;
  /** Total number of events in the list — needed to label position and disable steppers at the boundaries. */
  total?: number;
  feedback?: PositionFeedback;
  showYear?: boolean;
  onCardClick?: () => void;
  /** Discrete move control; omit to hide the stepper column on the drag overlay. */
  onMoveUp?: () => void;
  /** Discrete move control; omit to disable moving down at the end of the list. */
  onMoveDown?: () => void;
}

export function DraggableEventCard({
  event,
  index,
  total = 1,
  feedback,
  showYear = false,
  onCardClick,
  onMoveUp,
  onMoveDown,
}: DraggableEventCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: event.id,
    animateLayoutChanges: () => !prefersReducedMotion,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: prefersReducedMotion ? "none" : transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className={cardClasses({ isDragging, feedback })}>
      <EventCardContent
        event={event}
        index={index}
        total={total}
        feedback={feedback}
        showYear={showYear}
        listeners={listeners}
        attributes={attributes}
        onCardClick={onCardClick}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    </li>
  );
}

export function OrderEventCardOverlay({
  event,
  index,
  total = 1,
  feedback,
  showYear = false,
}: DraggableEventCardProps) {
  return (
    <div className={cardClasses({ isDragging: true, feedback })}>
      <EventCardContent
        event={event}
        index={index}
        total={total}
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
  total: number;
  feedback?: PositionFeedback;
  showYear?: boolean;
  listeners?: DraggableSyntheticListeners;
  attributes?: React.HTMLAttributes<HTMLElement>;
  mutedHandle?: boolean;
  onCardClick?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function EventCardContent({
  event,
  index,
  total,
  feedback,
  showYear = false,
  listeners,
  attributes,
  mutedHandle = false,
  onCardClick,
  onMoveUp,
  onMoveDown,
}: EventCardContentProps) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const truncationHintId = useId();
  const handleProps = { ...(listeners ?? {}), ...(attributes ?? {}) };
  const isInteractive = Boolean(onCardClick);

  // Truncation detection via ResizeObserver
  useEffect(() => {
    const el = textRef.current;
    if (!el || !isInteractive) return;

    const checkTruncation = () => {
      setIsTruncated(el.scrollHeight > el.clientHeight);
    };

    checkTruncation();
    const observer = new ResizeObserver(checkTruncation);
    observer.observe(el);
    return () => observer.disconnect();
  }, [event.text, isInteractive]);

  const canMoveUp = Boolean(onMoveUp);
  const canMoveDown = Boolean(onMoveDown);
  const showSteppers = !mutedHandle && (canMoveUp || canMoveDown);

  return (
    <>
      {/* Keep drag, expand, and step controls as separate 44px targets. */}
      <div
        className={[
          "flex h-11 touch-none items-center justify-center",
          "focus-visible:ring-ring cursor-grab focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset active:cursor-grabbing",
          "border-border text-muted-foreground rounded-t-xl border-b",
        ].join(" ")}
        data-vaul-no-drag
        {...handleProps}
        aria-label={
          mutedHandle
            ? undefined
            : `Reorder “${event.text}”. Currently position ${index + 1} of ${total}.`
        }
      >
        <DotsSixVertical
          weight="bold"
          aria-hidden="true"
          className={[
            "size-5",
            mutedHandle ? "text-feedback-success" : "text-muted-foreground",
          ].join(" ")}
        />
      </div>

      <div className="flex flex-1 items-start gap-3 px-4 py-4 sm:px-5">
        {/* Year Tab - Only shown in results view */}
        {showYear && (
          <div className="absolute top-3 -left-3 flex items-center">
            <div className="border-border bg-surface-elevated text-foreground rounded-md border px-2 py-1">
              <span className="font-year text-xs whitespace-nowrap">{formatYear(event.year)}</span>
            </div>
          </div>
        )}

        {/* Position and the last submitted placement feedback. */}
        <div className="flex min-w-[36px] flex-shrink-0 items-center justify-center sm:min-w-[32px]">
          <PositionBadge index={index} feedback={feedback} />
        </div>

        {/* Event Text — distinct target #2: tap-to-expand. Never nests inside the stepper/handle targets. */}
        {isInteractive ? (
          <button
            type="button"
            className="focus-visible:ring-ring min-h-11 min-w-0 flex-1 cursor-pointer rounded text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={onCardClick}
            aria-describedby={isTruncated ? truncationHintId : undefined}
          >
            <p
              ref={textRef}
              className="font-event text-foreground line-clamp-3 text-lg leading-relaxed sm:text-xl"
            >
              {event.text}
            </p>
            {isTruncated && (
              <span id={truncationHintId} className="text-muted-foreground mt-1 block text-sm">
                Tap to read more
              </span>
            )}
          </button>
        ) : (
          <div className="min-w-0 flex-1">
            <p
              ref={textRef}
              className="font-event text-foreground text-lg leading-relaxed sm:text-xl"
            >
              {event.text}
            </p>
          </div>
        )}

        {/* Native buttons provide discrete and keyboard-accessible reordering. */}
        {showSteppers && (
          <div className="flex flex-shrink-0 flex-col gap-1.5">
            <button
              type="button"
              className="border-border hover:bg-surface-inset focus-visible:ring-ring flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
              onClick={() => {
                onMoveUp?.();
              }}
              disabled={!canMoveUp}
              aria-label={`Move “${event.text}” up`}
            >
              <CaretUp className="text-foreground size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="border-border hover:bg-surface-inset focus-visible:ring-ring flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
              onClick={() => {
                onMoveDown?.();
              }}
              disabled={!canMoveDown}
              aria-label={`Move “${event.text}” down`}
            >
              <CaretDown className="text-foreground size-5" aria-hidden="true" />
            </button>
          </div>
        )}
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
      <div className="bg-feedback-success/10 flex h-9 w-9 items-center justify-center rounded-lg">
        <Check className="text-feedback-success h-5 w-5 stroke-[3]" aria-hidden="true" />
        <span className="sr-only">Correct position</span>
      </div>
    );
  }

  if (feedback === "incorrect") {
    return (
      <div className="bg-destructive/10 flex h-9 w-9 items-center justify-center rounded-lg">
        <X className="text-destructive h-5 w-5 stroke-[3]" aria-hidden="true" />
        <span className="sr-only">Incorrect position</span>
      </div>
    );
  }

  // No feedback yet - default badge
  return (
    <div className="text-foreground flex h-9 w-9 items-center justify-center text-lg font-semibold tabular-nums">
      {index + 1}
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
      ? "border-feedback-success/60"
      : feedback === "incorrect"
        ? "border-destructive/60"
        : "border-border";

  return [
    "relative flex min-h-[100px] flex-col rounded-xl text-left",
    "bg-surface-elevated border",
    feedbackBorder,
    isDragging ? "z-50 ring-2 ring-feedback-success/40 shadow-lg" : "",
  ].join(" ");
}
