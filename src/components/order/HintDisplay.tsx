"use client";

import { useMemo } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Anchor, Scale, CalendarRange, Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ANIMATION_DURATIONS, useReducedMotion } from "@/lib/animationConstants";
import { formatYear } from "@/lib/displayFormatting";
import { formatRelativeHintText } from "@/lib/order/formatHints";
import { serializeHint } from "@/lib/order/hintMerging";
import { cn } from "@/lib/utils";
import type { OrderEvent, OrderHint } from "@/types/orderGameState";

type HintType = OrderHint["type"];

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
          <span className="text-primary font-semibold">{eventName}</span>
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
          <span className="text-primary font-semibold">{eventName}</span>
          <span className="text-muted-foreground">
            : {startYear} – {endYear}
          </span>
        </>
      );
    },
  },
};

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

interface HintDisplayProps {
  events: OrderEvent[];
  hints: OrderHint[];
  onRequestHint: (type: HintType) => void;
  disabledTypes?: Partial<Record<HintType, boolean>>;
  pendingType?: HintType | null;
  error?: string | null;
  className?: string;
}

export function HintDisplay({
  events,
  hints,
  onRequestHint,
  disabledTypes = {},
  pendingType = null,
  error = null,
  className,
}: HintDisplayProps) {
  const panelProps: HintPanelProps = {
    events,
    hints,
    onRequestHint,
    disabledTypes,
    pendingType,
    error,
  };

  return (
    <div className={cn(className)}>
      {/* Mobile: Compact inline panel */}
      <div className="md:hidden">
        <CompactHintPanel {...panelProps} />
      </div>

      {/* Desktop: Full panel */}
      <div className="hidden md:block">
        <InlineHintPanel {...panelProps} />
      </div>
    </div>
  );
}

interface HintPanelProps {
  events: OrderEvent[];
  hints: OrderHint[];
  onRequestHint: (type: HintType) => void;
  disabledTypes: Partial<Record<HintType, boolean>>;
  pendingType: HintType | null;
  error: string | null;
}

function InlineHintPanel(props: HintPanelProps) {
  const hintsRemaining = 3 - props.hints.length;

  return (
    <section
      aria-labelledby="order-hints-heading"
      className="bg-card/90 shadow-warm hidden rounded-xl border p-4 md:block"
    >
      <Accordion.Root type="single" defaultValue="order-hints" collapsible>
        <Accordion.Item value="order-hints">
          <Accordion.Header>
            <Accordion.Trigger className="flex w-full items-center justify-between gap-2 text-left text-base font-semibold">
              <div className="flex flex-col">
                <span id="order-hints-heading">Hints</span>
                <span className="text-muted-foreground text-xs font-medium">
                  {hintsRemaining} of 3 remaining
                </span>
              </div>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="pt-4">
            <UnifiedHintPanel {...props} />
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </section>
  );
}

function CompactHintPanel(props: HintPanelProps) {
  const hintsRemaining = 3 - props.hints.length;

  return (
    <section
      aria-labelledby="compact-hints-heading"
      className="bg-card/90 shadow-warm rounded-xl border p-3"
    >
      {/* Hints Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="text-primary h-4 w-4" aria-hidden="true" />
          <div>
            <h3 id="compact-hints-heading" className="text-sm font-semibold">
              {hintsRemaining} Hints Left
            </h3>
            <p className="text-muted-foreground text-xs">{props.hints.length} of 3 used</p>
          </div>
        </div>
      </div>

      {/* Hint Buttons - Compact grid with editorial layout */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        {(Object.keys(HINT_COPY) as HintType[]).map((type) => {
          const isUsed = props.disabledTypes?.[type];
          return (
            <button
              key={type}
              type="button"
              className={cn(
                "border-border bg-background flex flex-col items-start rounded-xl border p-2 text-left text-xs transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                isUsed ? "cursor-not-allowed opacity-40" : "cursor-pointer",
              )}
              onClick={() => props.onRequestHint(type)}
              disabled={isUsed || props.pendingType === type}
              aria-label={`Take ${HINT_COPY[type].label}`}
            >
              {/* Icon + Title on same row */}
              <div className="mb-1 flex w-full items-center gap-1.5">
                <div className="text-primary flex-shrink-0">{getHintIcon(type, "h-4 w-4")}</div>
                <span className="text-foreground text-xs leading-tight font-semibold">
                  {isUsed ? "✓ " : ""}
                  {HINT_COPY[type].label.split(" ")[0]}
                </span>
              </div>
              {/* Description indented below */}
              <span className="text-muted-foreground pl-5 text-[10px] leading-tight">
                {isUsed ? "Used" : HINT_COPY[type].availableDescription}
              </span>
              {props.pendingType === type && <LoadingSpinner className="mt-1 ml-5 size-3" />}
            </button>
          );
        })}
      </div>

      {/* Hints History - Collapsed */}
      {props.hints.length > 0 && (
        <Accordion.Root type="single" collapsible>
          <Accordion.Item value="hints-history">
            <Accordion.Header>
              <Accordion.Trigger className="flex w-full items-center justify-between text-xs font-medium">
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
        <p role="status" className="text-destructive mt-2 text-xs">
          {props.error}
        </p>
      )}
    </section>
  );
}

function UnifiedHintPanel({
  events,
  hints,
  onRequestHint,
  disabledTypes,
  pendingType,
  error,
}: HintPanelProps) {
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
        "shadow-warm flex h-auto w-full flex-col items-start gap-2 rounded-lg px-4 py-3 text-left",
        !pending && "hover:border-timeline-spine/30 hover:shadow-warm-lg transition-shadow",
      )}
      onClick={() => onSelect(type)}
      disabled={pending}
      aria-label={`Take ${copy.label}`}
    >
      {/* Icon + Title on same row */}
      <div className="flex w-full items-center gap-3">
        <div className="text-primary flex-shrink-0">{getHintIcon(type, "h-5 w-5")}</div>
        <p className="text-foreground text-sm font-semibold">{copy.label}</p>
      </div>

      {/* Description below with indent */}
      <div className="pl-8">
        <p className="text-muted-foreground text-xs leading-relaxed">{copy.availableDescription}</p>
        {pending && (
          <span className="text-primary mt-2 flex items-center gap-2 text-xs font-medium">
            <LoadingSpinner className="size-3" />
            Preparing hint…
          </span>
        )}
      </div>
    </Button>
  );
}

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
                className="border-border bg-muted/30 flex items-start gap-3 rounded-lg border px-3 py-2.5 shadow-sm"
              >
                <div className="flex-shrink-0 pt-0.5" style={{ color: "var(--timeline-marker)" }}>
                  {getHintIcon(hint.type, "h-4 w-4")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm leading-relaxed">{description}</p>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </LayoutGroup>
    </ul>
  );
}
