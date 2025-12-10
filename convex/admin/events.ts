/**
 * Admin Events API
 *
 * Deep module for event pool management:
 * - Search with text, year range, era, and usage filters
 * - Inline text editing for typo fixes
 * - Safe deletion (only unused events)
 *
 * Principle: Simple query interface hides filter composition complexity.
 */

import { query, mutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { requireAdmin } from "../lib/auth";

/**
 * Usage filter types for event queries.
 * Maps directly to schema fields classicPuzzleId and orderPuzzleId.
 */
const usageFilterValidator = v.union(
  v.literal("unused_classic"),
  v.literal("unused_order"),
  v.literal("unused_both"),
  v.literal("used_classic"),
  v.literal("used_order"),
);

const eraValidator = v.union(v.literal("ancient"), v.literal("medieval"), v.literal("modern"));

/**
 * Search events with comprehensive filtering.
 *
 * Filter priority: Year range (index-optimized) → Era → Usage → Text search (in-memory).
 * Text search uses case-insensitive substring match on event text.
 */
export const searchEvents = query({
  args: {
    search: v.optional(v.string()),
    yearMin: v.optional(v.number()),
    yearMax: v.optional(v.number()),
    era: v.optional(eraValidator),
    usageFilter: v.optional(usageFilterValidator),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.max(1, Math.min(args.limit ?? 50, 200)); // Cap at 200
    const cursorIndex = args.cursor ? parseInt(args.cursor, 10) : 0;

    // Fetch events using indexed year range query if possible, otherwise use index for sorting
    // Note: switching to "by_year" index changes default sort order from creation time to year
    let events = await ctx.db
      .query("events")
      .withIndex("by_year", (q) => {
        let builder = q;
        if (args.yearMin !== undefined) {
          builder = builder.gte("year", args.yearMin);
        }
        if (args.yearMax !== undefined) {
          builder = builder.lte("year", args.yearMax);
        }
        return builder;
      })
      .order("asc")
      .collect();

    // 2. Era filter (uses metadata.era)
    if (args.era !== undefined) {
      events = events.filter((e) => e.metadata?.era === args.era);
    }

    // 3. Usage filter (per-mode puzzle links)
    if (args.usageFilter !== undefined) {
      events = events.filter((e) => matchesUsageFilter(e, args.usageFilter!));
    }

    // 4. Text search (case-insensitive substring)
    if (args.search && args.search.trim().length > 0) {
      const searchLower = args.search.toLowerCase().trim();
      events = events.filter((e) => e.event.toLowerCase().includes(searchLower));
    }

    // Total count before pagination
    const totalCount = events.length;

    // Cursor-based pagination (simple offset approach for admin use)
    const paginatedEvents = events.slice(cursorIndex, cursorIndex + limit);
    const nextCursor = cursorIndex + limit < totalCount ? String(cursorIndex + limit) : null;

    return {
      events: paginatedEvents,
      nextCursor,
      totalCount,
    };
  },
});

/**
 * Get event statistics for header summary.
 * Counts events by usage status across both modes.
 */
export const getEventStats = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const events = await ctx.db.query("events").collect();

    const total = events.length;
    const unusedClassic = events.filter((e) => e.classicPuzzleId === undefined).length;
    const unusedOrder = events.filter((e) => e.orderPuzzleId === undefined).length;
    const unusedBoth = events.filter(
      (e) => e.classicPuzzleId === undefined && e.orderPuzzleId === undefined,
    ).length;
    const usedClassic = total - unusedClassic;
    const usedOrder = total - unusedOrder;

    // Year coverage stats
    const years = new Set(events.map((e) => e.year));
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    return {
      total,
      unusedClassic,
      unusedOrder,
      unusedBoth,
      usedClassic,
      usedOrder,
      yearCoverage: {
        count: years.size,
        min: minYear,
        max: maxYear,
      },
    };
  },
});

/**
 * Update event text.
 * For fixing typos and improving clarity without affecting puzzle associations.
 */
export const updateEventText = mutation({
  args: {
    eventId: v.id("events"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { eventId, text } = args;

    // Validate text
    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      throw new ConvexError("Event text cannot be empty");
    }
    if (trimmedText.length > 500) {
      throw new ConvexError("Event text is too long (max 500 chars)");
    }

    // Get current event
    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new ConvexError("Event not found");
    }

    // Check if text changed
    if (event.event === trimmedText) {
      throw new ConvexError("New text is identical to current text");
    }

    // Update event
    await ctx.db.patch(eventId, {
      event: trimmedText,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Delete an unused event.
 * Safety: Only events not used in any puzzle can be deleted.
 */
export const deleteEvent = mutation({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { eventId } = args;

    // Get event
    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new ConvexError("Event not found");
    }

    // Safety check: Cannot delete used events
    if (event.classicPuzzleId !== undefined) {
      // Find puzzle number for helpful error
      const puzzle = await ctx.db.get(event.classicPuzzleId);
      throw new ConvexError(
        `Cannot delete: Event used in Classic puzzle #${puzzle?.puzzleNumber ?? "unknown"}`,
      );
    }

    if (event.orderPuzzleId !== undefined) {
      const puzzle = await ctx.db.get(event.orderPuzzleId);
      throw new ConvexError(
        `Cannot delete: Event used in Order puzzle #${puzzle?.puzzleNumber ?? "unknown"}`,
      );
    }

    // Safe to delete
    await ctx.db.delete(eventId);

    return { success: true };
  },
});

// Helper: Check if event matches usage filter
function matchesUsageFilter(
  event: Doc<"events">,
  filter: "unused_classic" | "unused_order" | "unused_both" | "used_classic" | "used_order",
): boolean {
  switch (filter) {
    case "unused_classic":
      return event.classicPuzzleId === undefined;
    case "unused_order":
      return event.orderPuzzleId === undefined;
    case "unused_both":
      return event.classicPuzzleId === undefined && event.orderPuzzleId === undefined;
    case "used_classic":
      return event.classicPuzzleId !== undefined;
    case "used_order":
      return event.orderPuzzleId !== undefined;
  }
}
