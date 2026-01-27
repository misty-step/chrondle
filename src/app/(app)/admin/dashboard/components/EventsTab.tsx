"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchIcon, TrashIcon, CheckIcon, XIcon, Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

type UsageFilter =
  | "unused_classic"
  | "unused_order"
  | "unused_both"
  | "used_classic"
  | "used_order";
type Era = "ancient" | "medieval" | "modern";

interface EventItem {
  _id: Id<"events">;
  year: number;
  event: string;
  classicPuzzleId?: Id<"puzzles">;
  orderPuzzleId?: Id<"orderPuzzles">;
  metadata?: {
    era?: string;
    difficulty?: number;
    category?: string[];
  };
}

/**
 * Events Browser Tab - Full Event Pool Management
 *
 * Features:
 * - Search by text (debounced)
 * - Filter by year range, era, usage status
 * - Inline text editing
 * - Safe deletion with confirmation
 * - Statistics header
 */
export default function EventsTab() {
  // Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [yearMin, setYearMin] = useState<string>("");
  const [yearMax, setYearMax] = useState<string>("");
  const [era, setEra] = useState<Era | "all">("all");
  const [usageFilter, setUsageFilter] = useState<UsageFilter | "all">("all");

  // Edit state
  const [editingId, setEditingId] = useState<Id<"events"> | null>(null);
  const [editText, setEditText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<EventItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Query args
  const queryArgs = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      yearMin: yearMin ? parseInt(yearMin, 10) : undefined,
      yearMax: yearMax ? parseInt(yearMax, 10) : undefined,
      era: era !== "all" ? era : undefined,
      usageFilter: usageFilter !== "all" ? usageFilter : undefined,
      limit: 50,
    }),
    [debouncedSearch, yearMin, yearMax, era, usageFilter],
  );

  // Queries
  const eventsResult = useQuery(api.admin.events.searchEvents, queryArgs);
  const stats = useQuery(api.admin.events.getEventStats);

  // Mutations
  const updateEventText = useMutation(api.admin.events.updateEventText);
  const deleteEvent = useMutation(api.admin.events.deleteEvent);

  // Edit handlers
  const startEditing = useCallback((event: EventItem) => {
    setEditingId(event._id);
    setEditText(event.event);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditText("");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editText.trim()) return;
    setIsSaving(true);
    try {
      await updateEventText({ eventId: editingId, text: editText.trim() });
      setEditingId(null);
      setEditText("");
    } catch (error) {
      logger.error("Failed to update event:", { error });
    } finally {
      setIsSaving(false);
    }
  }, [editingId, editText, updateEventText]);

  // Delete handlers
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteEvent({ eventId: deleteTarget._id });
      setDeleteTarget(null);
    } catch (error) {
      logger.error("Failed to delete event:", { error });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, deleteEvent]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearch("");
    setDebouncedSearch("");
    setYearMin("");
    setYearMax("");
    setEra("all");
    setUsageFilter("all");
  }, []);

  const hasActiveFilters = search || yearMin || yearMax || era !== "all" || usageFilter !== "all";

  return (
    <div className="space-y-6">
      {/* Statistics Header */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total Events" value={stats.total} />
          <StatCard label="Unused (Classic)" value={stats.unusedClassic} />
          <StatCard label="Unused (Order)" value={stats.unusedOrder} />
          <StatCard label="Unused (Both)" value={stats.unusedBoth} variant="highlight" />
          <StatCard label="Used (Classic)" value={stats.usedClassic} />
          <StatCard label="Used (Order)" value={stats.usedOrder} />
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Search */}
          <div className="min-w-[200px] flex-1">
            <label
              htmlFor="event-search"
              className="text-text-secondary mb-1 block text-xs font-medium"
            >
              Search Events
            </label>
            <div className="relative">
              <SearchIcon className="text-text-tertiary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                id="event-search"
                placeholder="Search event text..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Year Range */}
          <div className="flex items-end gap-2">
            <div>
              <label
                htmlFor="year-min"
                className="text-text-secondary mb-1 block text-xs font-medium"
              >
                Year Min
              </label>
              <Input
                id="year-min"
                type="number"
                placeholder="-3000"
                value={yearMin}
                onChange={(e) => setYearMin(e.target.value)}
                className="w-24"
              />
            </div>
            <span className="text-text-tertiary pb-2">–</span>
            <div>
              <label
                htmlFor="year-max"
                className="text-text-secondary mb-1 block text-xs font-medium"
              >
                Year Max
              </label>
              <Input
                id="year-max"
                type="number"
                placeholder="2024"
                value={yearMax}
                onChange={(e) => setYearMax(e.target.value)}
                className="w-24"
              />
            </div>
          </div>

          {/* Era Filter */}
          <div>
            <span className="text-text-secondary mb-1 block text-xs font-medium">Era</span>
            <Select value={era} onValueChange={(v) => setEra(v as Era | "all")}>
              <SelectTrigger className="w-32" aria-label="Era filter">
                <SelectValue placeholder="All Eras" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Eras</SelectItem>
                <SelectItem value="ancient">Ancient</SelectItem>
                <SelectItem value="medieval">Medieval</SelectItem>
                <SelectItem value="modern">Modern</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Usage Filter */}
          <div>
            <span className="text-text-secondary mb-1 block text-xs font-medium">Usage Status</span>
            <Select
              value={usageFilter}
              onValueChange={(v) => setUsageFilter(v as UsageFilter | "all")}
            >
              <SelectTrigger className="w-40" aria-label="Usage status filter">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="unused_classic">Unused (Classic)</SelectItem>
                <SelectItem value="unused_order">Unused (Order)</SelectItem>
                <SelectItem value="unused_both">Unused (Both)</SelectItem>
                <SelectItem value="used_classic">Used (Classic)</SelectItem>
                <SelectItem value="used_order">Used (Order)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      </Card>

      {/* Events Table */}
      <Card className="p-6">
        {!eventsResult ? (
          <div className="text-text-secondary flex items-center gap-2">
            <Loader2Icon className="h-4 w-4 animate-spin" />
            Loading events...
          </div>
        ) : eventsResult.events.length === 0 ? (
          <div className="text-text-secondary py-8 text-center">
            {hasActiveFilters ? "No events match your filters" : "No events in the database"}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-surface-secondary border-b text-left">
                    <th className="text-text-secondary w-20 pb-2 font-medium">Year</th>
                    <th className="text-text-secondary pb-2 font-medium">Event</th>
                    <th className="text-text-secondary w-20 pb-2 font-medium">Era</th>
                    <th className="text-text-secondary w-24 pb-2 font-medium">Classic</th>
                    <th className="text-text-secondary w-24 pb-2 font-medium">Order</th>
                    <th className="text-text-secondary w-20 pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {eventsResult.events.map((event: EventItem) => (
                    <tr key={event._id} className="border-surface-secondary border-b">
                      {/* Year */}
                      <td className="text-text-primary py-3 font-mono">{formatYear(event.year)}</td>

                      {/* Event Text (with inline editing) */}
                      <td className="py-3">
                        {editingId === event._id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="flex-1"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit();
                                if (e.key === "Escape") cancelEditing();
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={saveEdit}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <Loader2Icon className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckIcon className="h-4 w-4 text-green-500" />
                              )}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={cancelEditing}>
                              <XIcon className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            className="text-text-primary hover:bg-surface-secondary w-full cursor-pointer rounded px-2 py-1 text-left transition-colors"
                            onClick={() => startEditing(event)}
                            title="Click to edit"
                          >
                            {event.event}
                          </button>
                        )}
                      </td>

                      {/* Era */}
                      <td className="text-text-secondary py-3 capitalize">
                        {event.metadata?.era || "—"}
                      </td>

                      {/* Classic Status */}
                      <td className="py-3">
                        <Badge variant={event.classicPuzzleId ? "default" : "outline"}>
                          {event.classicPuzzleId ? "Used" : "Unused"}
                        </Badge>
                      </td>

                      {/* Order Status */}
                      <td className="py-3">
                        <Badge variant={event.orderPuzzleId ? "default" : "outline"}>
                          {event.orderPuzzleId ? "Used" : "Unused"}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(event)}
                          disabled={
                            event.classicPuzzleId !== undefined || event.orderPuzzleId !== undefined
                          }
                          title={
                            event.classicPuzzleId || event.orderPuzzleId
                              ? "Cannot delete: event used in puzzle"
                              : "Delete event"
                          }
                        >
                          <TrashIcon
                            className={cn(
                              "h-4 w-4",
                              event.classicPuzzleId || event.orderPuzzleId
                                ? "text-text-tertiary"
                                : "text-red-500",
                            )}
                          />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Info */}
            <div className="text-text-secondary mt-4 flex items-center justify-between text-xs">
              <span>
                Showing {eventsResult.events.length} of {eventsResult.totalCount} events
              </span>
              {eventsResult.nextCursor && (
                <span className="text-text-tertiary">More results available</span>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="bg-surface-secondary rounded p-3 text-sm">
              <div className="text-text-tertiary mb-1 font-mono">
                {formatYear(deleteTarget.year)}
              </div>
              <div className="text-text-primary">{deleteTarget.event}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Event"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper: Format year with BC/AD
function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`;
  return `${year} AD`;
}

// Helper: Statistics card
function StatCard({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: number;
  variant?: "default" | "highlight";
}) {
  return (
    <div
      className={cn(
        "rounded-lg p-3",
        variant === "highlight"
          ? "bg-accent-primary/10 border-accent-primary/20 border"
          : "bg-surface-secondary",
      )}
    >
      <div className="text-text-tertiary text-xs">{label}</div>
      <div
        className={cn(
          "font-heading text-xl font-semibold",
          variant === "highlight" ? "text-accent-primary" : "text-text-primary",
        )}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}
