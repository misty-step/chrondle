"use client";

import { Drawer } from "vaul";
import { useReducedMotion } from "motion/react";
import type { OrderEvent } from "@/types/orderGameState";

interface EventDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: OrderEvent | null;
}

export function EventDetailDrawer({ open, onOpenChange, event }: EventDetailDrawerProps) {
  const prefersReducedMotion = useReducedMotion();

  if (!event) return null;

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground={!prefersReducedMotion}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Drawer.Content
          className="bg-background fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85vh] flex-col rounded-t-lg border-t"
          aria-describedby="drawer-description"
        >
          {/* Drag Handle */}
          <div className="bg-muted mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full" />

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <Drawer.Title className="font-display mb-4 text-lg font-semibold">
              Event Details
            </Drawer.Title>
            <p
              id="drawer-description"
              className="font-event text-body-primary text-xl leading-relaxed"
            >
              {event.text}
            </p>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
