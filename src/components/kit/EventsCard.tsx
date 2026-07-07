"use client";

import React from "react";
import { formatYear } from "@/lib/displayFormatting";

interface EventsCardProps {
  events: string[];
  targetYear: number;
}

export const EventsCard: React.FC<EventsCardProps> = ({ events, targetYear }) => {
  return (
    <div className="from-card via-card to-muted/50 border-border/50 rounded border bg-gradient-to-br p-4 shadow-lg">
      <div className="space-y-3">
        {/* Header */}
        <div className="text-center">
          <h3 className="text-foreground mb-1 text-xl font-bold">
            Events from {formatYear(targetYear)}
          </h3>
          <p className="text-muted-foreground text-sm">Here&apos;s what was happening in history</p>
        </div>

        {/* Events List */}
        <div className="space-y-3">
          {events.map((event, index) => (
            <div
              key={index}
              className="group bg-surface-elevated border-border/30 hover:bg-surface-elevated/80 rounded border p-4 transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                {/* Timeline dot */}
                <div className="mt-2 flex-shrink-0">
                  <div className="from-primary h-2 w-2 rounded-full bg-gradient-to-r to-blue-600 transition-transform duration-200 group-hover:scale-125" />
                </div>

                {/* Event text */}
                <p className="text-foreground group-hover:text-foreground/90 text-sm leading-relaxed transition-colors duration-200">
                  {event}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
