"use client";

import React, { useMemo } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Anchor, Scale, CalendarRange, Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GameCard } from "@/components/ui/GameCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ANIMATION_DURATIONS, useReducedMotion } from "@/lib/animationConstants";
import { formatYear } from "@/lib/displayFormatting";
import { formatRelativeHintText } from "@/lib/order/formatHints";
import { serializeHint } from "@/lib/order/hintMerging";
import { cn } from "@/lib/utils";
import type { OrderEvent, OrderHint } from "@/types/orderGameState";

type HintType = OrderHint["type"];

// Internal hint metadata - hidden from caller
const HINT_COPY: Record<
  HintType,
  {
    label: string;
    availableDescription: string;
    getUsedDescription: (hint: OrderHint, eventsById: Map<string, OrderEvent>) => React.ReactNode;
  }
> = {
  anchor: {
    label: "Anchor Hint",
    availableDescription: "Lock one event in the correct position",
    getUsedDescription: (hint, eventsById) => {
      if (hint.type !== "anchor") return null;
      const event = eventsById.get(hint.eventId);
      const eventName = event?.text ?? "Event";
      return (
        <>
          <span className="text-body-primary font-semibold">{eventName}</span>
          <span className="text-muted-foreground"> locked at position {hint.position + 1}</span>
        </>
      );
    },
  },
  relative: {
    label: "Relative Hint",
    availableDescription: "Compare timing of two events",
    getUsedDescription: (hint, eventsById) => {
      if (hint.type !== "relative") return null;
      return formatRelativeHintText(hint, eventsById);
    },
  },
  bracket: {
    label: "Bracket Hint",
    availableDescription: "Narrow the year range for one event",
    getUsedDescription: (hint, eventsById) => {
      if (hint.type !== "bracket") return null;
      const event = eventsById.get(hint.eventId);
      const eventName = event?.text ?? "Event";
      const startYear = formatYear(hint.yearRange[0]);
      const endYear = formatYear(hint.yearRange[1]);
      return (
        <>
          <span className="text-body-primary font-semibold">{eventName}</span>
          <span className="text-muted-foreground">
            : {startYear} – {endYear}
          </span>
        </>
      );
    },
  },
};

// Internal icon mapper - hidden from caller
function getHintIcon(type: HintType, className?: string) {
  const iconProps = { className: className || "h-4 w-4", "aria-hidden": true };
  switch (type) {
    case "anchor":
      return <Anchor {...iconProps} />;
    case "relative":
      return <Scale {...iconProps} />;
    case "bracket":
      return <CalendarRange {...iconProps} />;
  }
}

export interface HintPanelProps {
  events: OrderEvent[];
  hints: OrderHint[];
  onRequestHint: (type: HintType) => void;
  disabledTypes?: Partial<Record<HintType, boolean>>;
  pendingType?: HintType | null;
  error?: string | null;
  className?: string;
}

/**
 * Deep module for hint display in Order Mode.
 *
 * **Hides complexity:**
 * - GameCard wrapping and surface styling
 * - Responsive breakpoints (mobile compact grid vs desktop list)
 * - Accordion behavior for collapsible sections
 * - Animation logic (motion, AnimatePresence, LayoutGroup)
 * - Icon mapping and rendering
 * - Hint copy and descriptions
 * - Used hints formatting with animations
 * - Error display styling
 * - Loading states and spinners
 *
 * **Simple interface:**
 * Just specify events, hints, callback, and states. Responsive behavior,
 * animations, and styling are guaranteed.
 *
 * **Ousterhout Deep Module:**
 * - Interface complexity: 3 required props (events, hints, onRequestHint) + 4 optional state props
 * - Implementation complexity: Responsive layouts + Accordion + animations + GameCard + icons
 * - Value = Consistent hint UI across mobile/desktop + guaranteed styling
 *
 * **Architectural Guarantees:**
 * 1. Responsive behavior is automatic (no breakpoint management needed)
 * 2. Used hints always animate in/out smoothly
 * 3. GameCard styling always consistent
 * 4. Accessibility built-in (ARIA labels, live regions)
 *
 * This eliminates responsive layout bugs and styling inconsistencies.
 *
 * @example
 * // Simple usage - all complexity hidden
 * <HintPanel
 *   events={puzzle.events}
 *   hints={hints}
 *   onRequestHint={requestHint}
 *   disabledTypes={disabledHintTypes}
 *   pendingType={pendingHintType}
 *   error={hintError}
 * />
 */
export function HintPanel({
  events,
  hints,
  onRequestHint,
  disabledTypes = {},
  pendingType = null,
  error = null,
  className,
}: HintPanelProps) {
  return (
    <div className={cn(className)}>
      {/* Mobile: Compact inline panel */}
      <div className="md:hidden">
        <MobileHintPanel
          events={events}
          hints={hints}
          onRequestHint={onRequestHint}
          disabledTypes={disabledTypes}
          pendingType={pendingType}
          error={error}
        />
      </div>

      {/* Desktop: Full panel with accordion */}
      <div className="hidden md:block">
        <DesktopHintPanel
          events={events}
          hints={hints}
          onRequestHint={onRequestHint}
          disabledTypes={disabledTypes}
          pendingType={pendingType}
          error={error}
        />
      </div>
    </div>
  );
}

// Internal component - Desktop layout with accordion
interface InternalPanelProps {
  events: OrderEvent[];
  hints: OrderHint[];
  onRequestHint: (type: HintType) => void;
  disabledTypes: Partial<Record<HintType, boolean>>;
  pendingType: HintType | null;
  error: string | null;
}

function DesktopHintPanel(props: InternalPanelProps) {
  const hintsRemaining = 3 - props.hints.length;

  return (
    <GameCard as="section" padding="default" aria-labelledby="order-hints-heading">
      <Accordion.Root type="single" defaultValue="order-hints" collapsible>
        <Accordion.Item value="order-hints">
          <Accordion.Header>
            <Accordion.Trigger className="flex w-full items-center justify-between gap-2 text-left text-base font-semibold">
              <div className="flex flex-col">
                <span id="order-hints-heading" className="text-body-primary">
                  Hints
                </span>
                <span className="text-muted-foreground text-xs font-medium">
                  {hintsRemaining} of 3 remaining
                </span>
              </div>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="pt-4">
            <HintPanelContent {...props} />
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </GameCard>
  );
}

function MobileHintPanel(props: InternalPanelProps) {
  const hintsRemaining = 3 - props.hints.length;

  return (
    <GameCard as="section" padding="compact" aria-labelledby="compact-hints-heading">
      {/* Header - Museum placard style */}
      <div className="border-border/50 mb-4 flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded">
            <Lightbulb className="text-body-primary h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h3 id="compact-hints-heading" className="text-body-primary text-base font-semibold">
              {hintsRemaining} Hints Left
            </h3>
            <p className="text-muted-foreground text-sm">{props.hints.length} of 3 used</p>
          </div>
        </div>
      </div>

      {/* Hint Buttons - Single column with generous touch targets */}
      <div className="mb-4 flex flex-col gap-3">
        {(Object.keys(HINT_COPY) as HintType[]).map((type) => {
          const isUsed = props.disabledTypes?.[type];
          const isPending = props.pendingType === type;
          return (
            <button
              key={type}
              type="button"
              className={cn(
                "border-border bg-background flex min-h-[56px] w-full items-center gap-4 rounded border-2 px-4 py-3 text-left transition-all",
                "focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                isUsed
                  ? "cursor-not-allowed opacity-50"
                  : "hover:border-primary/30 hover:bg-muted/30 cursor-pointer",
              )}
              onClick={() => props.onRequestHint(type)}
              disabled={isUsed || isPending}
              aria-label={`Take ${HINT_COPY[type].label}`}
            >
              {/* Icon container */}
              <div
                className={cn(
                  "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded",
                  isUsed ? "bg-muted" : "bg-primary/10",
                )}
              >
                {isPending ? (
                  <LoadingSpinner className="size-5" />
                ) : (
                  <div className={isUsed ? "text-muted-foreground" : "text-body-primary"}>
                    {getHintIcon(type, "h-5 w-5")}
                  </div>
                )}
              </div>

              {/* Label + Description */}
              <div className="min-w-0 flex-1 overflow-hidden">
                <span
                  className={cn(
                    "block truncate text-base leading-tight font-semibold",
                    isUsed ? "text-muted-foreground" : "text-body-primary",
                  )}
                >
                  {isUsed && "✓ "}
                  {HINT_COPY[type].label}
                </span>
                <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-sm leading-snug">
                  {isUsed ? "Used" : HINT_COPY[type].availableDescription}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Hints History - Collapsed accordion */}
      {props.hints.length > 0 && (
        <Accordion.Root type="single" collapsible>
          <Accordion.Item value="hints-history">
            <Accordion.Header>
              <Accordion.Trigger className="text-muted-foreground hover:text-body-primary flex w-full items-center justify-between py-2 text-sm font-medium transition-colors">
                <span>View hints used ({props.hints.length})</span>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="pt-2">
              <UsedHintsList events={props.events} hints={props.hints} />
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      )}

      {props.error && (
        <p role="status" className="text-destructive mt-3 text-sm font-medium">
          {props.error}
        </p>
      )}
    </GameCard>
  );
}

// Internal component - Shared content for desktop
function HintPanelContent({
  events,
  hints,
  onRequestHint,
  disabledTypes,
  pendingType,
  error,
}: InternalPanelProps) {
  const availableTypes = (Object.keys(HINT_COPY) as HintType[]).filter(
    (type) => !disabledTypes[type],
  );
  const usedTypes = (Object.keys(HINT_COPY) as HintType[]).filter((type) => disabledTypes[type]);

  return (
    <div className="space-y-4">
      {/* Available Hints Section */}
      {availableTypes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Available
          </h4>
          <div className="space-y-2">
            {availableTypes.map((type) => (
              <AvailableHintButton
                key={type}
                type={type}
                pending={pendingType === type}
                onSelect={onRequestHint}
              />
            ))}
          </div>
        </div>
      )}

      {/* Used Hints Section */}
      {usedTypes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Used
          </h4>
          <UsedHintsList events={events} hints={hints} />
        </div>
      )}

      {error && (
        <p role="status" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

// Internal component - Available hint button
interface AvailableHintButtonProps {
  type: HintType;
  pending: boolean;
  onSelect: (type: HintType) => void;
}

function AvailableHintButton({ type, pending, onSelect }: AvailableHintButtonProps) {
  const copy = HINT_COPY[type];
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "flex h-auto w-full flex-col items-start gap-2 rounded px-4 py-3 text-left",
        !pending && "hover:border-timeline-spine/30 transition-shadow",
      )}
      onClick={() => onSelect(type)}
      disabled={pending}
      aria-label={`Take ${copy.label}`}
    >
      {/* Icon + Title on same row */}
      <div className="flex w-full min-w-0 items-center gap-3">
        <div className="text-body-primary flex-shrink-0">{getHintIcon(type, "h-5 w-5")}</div>
        <p className="text-body-primary min-w-0 truncate text-sm font-semibold">{copy.label}</p>
      </div>

      {/* Description below */}
      <div className="w-full min-w-0 overflow-hidden">
        <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed normal-case">
          {copy.availableDescription}
        </p>
        {pending && (
          <span className="text-body-primary mt-2 flex items-center gap-2 text-xs font-medium">
            <LoadingSpinner className="size-3" />
            Preparing hint…
          </span>
        )}
      </div>
    </Button>
  );
}

// Internal component - Used hints list with animations
interface UsedHintsListProps {
  events: OrderEvent[];
  hints: OrderHint[];
}

function UsedHintsList({ events, hints }: UsedHintsListProps) {
  const shouldReduceMotion = useReducedMotion();
  const eventsById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);

  if (!hints.length) {
    return null;
  }

  return (
    <ul className="space-y-2" aria-live="polite">
      <LayoutGroup>
        <AnimatePresence initial={false}>
          {hints.map((hint) => {
            const description = HINT_COPY[hint.type].getUsedDescription(hint, eventsById);
            return (
              <motion.li
                key={serializeHint(hint)}
                layout={!shouldReduceMotion}
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
                animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
                transition={{
                  duration: ANIMATION_DURATIONS.HINT_TRANSITION / 1000,
                  layout: {
                    duration: shouldReduceMotion ? 0 : ANIMATION_DURATIONS.HINT_TRANSITION / 1000,
                  },
                }}
                className="border-border bg-muted/30 flex items-start gap-3 rounded border px-3 py-2.5 shadow-sm"
              >
                <div className="flex-shrink-0 pt-0.5" style={{ color: "var(--timeline-marker)" }}>
                  {getHintIcon(hint.type, "h-4 w-4")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body-primary text-sm leading-relaxed">{description}</p>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </LayoutGroup>
    </ul>
  );
}
