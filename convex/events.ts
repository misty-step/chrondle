import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

// Import events into the pool (one event per row)
export const importEvent = internalMutation({
  args: {
    year: v.number(),
    event: v.string(),
  },
  handler: async (ctx, { year, event }) => {
    // Check if this exact event already exists
    const existing = await ctx.db
      .query("events")
      .withIndex("by_year", (q) => q.eq("year", year))
      .filter((q) => q.eq(q.field("event"), event))
      .first();

    if (existing) {
      // Event already exists, skip
      return { skipped: true, id: existing._id };
    }

    // Create new event (unassigned to any puzzle)
    const id = await ctx.db.insert("events", {
      year,
      event,
      updatedAt: Date.now(),
    });

    return { created: true, id };
  },
});

// Batch import events for a year
export const importYearEvents = internalMutation({
  args: {
    year: v.number(),
    events: v.array(v.string()),
  },
  handler: async (ctx, { year, events }) => {
    const results = [];

    for (const event of events) {
      // Check if this exact event already exists
      const existing = await ctx.db
        .query("events")
        .withIndex("by_year", (q) => q.eq("year", year))
        .filter((q) => q.eq(q.field("event"), event))
        .first();

      if (existing) {
        results.push({ event, skipped: true, id: existing._id });
        continue;
      }

      // Create new event
      const id = await ctx.db.insert("events", {
        year,
        event,
        updatedAt: Date.now(),
      });

      results.push({ event, created: true, id });
    }

    return {
      year,
      total: events.length,
      created: results.filter((r) => r.created).length,
      skipped: results.filter((r) => r.skipped).length,
      results,
    };
  },
});

// Get events for a specific year (public for admin scripts)
export const getYearEvents = query({
  args: { year: v.number() },
  handler: async (ctx, { year }) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_year", (q) => q.eq("year", year))
      .collect();

    return events;
  },
});

// Get available years (years with 6+ unused events for Classic mode)
export const getAvailableYears = internalQuery({
  handler: async (ctx) => {
    // Get all events that aren't assigned to a Classic puzzle
    const unusedEvents = await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("classicPuzzleId"), undefined))
      .collect();

    // Group by year and count
    const yearCounts = new Map<number, number>();
    for (const event of unusedEvents) {
      const count = yearCounts.get(event.year) || 0;
      yearCounts.set(event.year, count + 1);
    }

    // Filter years with 6+ events
    const availableYears = Array.from(yearCounts.entries())
      .filter(([, count]) => count >= 6)
      .map(([year, count]) => ({ year, availableEvents: count }))
      .sort((a, b) => a.year - b.year);

    return availableYears;
  },
});

// Fetch events missing metadata (internal use)
export const getEventsMissingMetadata = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit }) => {
    const max = Math.max(1, Math.min(limit ?? 500, 2000));
    const events = await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("metadata"), undefined))
      .take(max);

    return events.map((event) => ({
      _id: event._id,
      year: event.year,
      event: event.event,
      updatedAt: event.updatedAt,
    }));
  },
});

// Public query wrapper for external scripts
export const getEventsMissingMetadataPublic = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit }) => {
    const max = Math.max(1, Math.min(limit ?? 500, 2000));
    const events = await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("metadata"), undefined))
      .take(max);

    return events.map((event) => ({
      _id: event._id,
      year: event.year,
      event: event.event,
      updatedAt: event.updatedAt,
    }));
  },
});

// Mark events as used by a Classic puzzle
export const assignEventsToPuzzle = internalMutation({
  args: {
    eventIds: v.array(v.id("events")),
    puzzleId: v.id("puzzles"),
  },
  handler: async (ctx, { eventIds, puzzleId }) => {
    for (const eventId of eventIds) {
      await ctx.db.patch(eventId, {
        classicPuzzleId: puzzleId,
        updatedAt: Date.now(),
      });
    }

    return { assigned: eventIds.length };
  },
});

// Internal mutation for updating event metadata
export const updateEventMetadata = internalMutation({
  args: {
    eventId: v.id("events"),
    metadata: v.object({
      difficulty: v.optional(v.number()),
      category: v.optional(v.array(v.string())),
      era: v.optional(v.string()),
      fame_level: v.optional(v.number()),
      tags: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, { eventId, metadata }) => {
    await ctx.db.patch(eventId, {
      metadata,
      updatedAt: Date.now(),
    });

    return { eventId };
  },
});

// Public mutation wrapper for external scripts
export const updateEventMetadataPublic = mutation({
  args: {
    eventId: v.id("events"),
    metadata: v.object({
      difficulty: v.optional(v.number()),
      category: v.optional(v.array(v.string())),
      era: v.optional(v.string()),
      fame_level: v.optional(v.number()),
      tags: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, { eventId, metadata }) => {
    await ctx.db.patch(eventId, {
      metadata,
      updatedAt: Date.now(),
    });

    return { eventId };
  },
});

// Delete all events for a year (only if none are used in puzzles)
export const deleteYearEvents = internalMutation({
  args: {
    year: v.number(),
  },
  handler: async (ctx, { year }) => {
    // Get all events for the year
    const events = await ctx.db
      .query("events")
      .withIndex("by_year", (q) => q.eq("year", year))
      .collect();

    // Check if any events are used in puzzles (either mode)
    const usedEvents = events.filter(
      (e) => e.classicPuzzleId !== undefined || e.orderPuzzleId !== undefined,
    );
    if (usedEvents.length > 0) {
      throw new Error(
        `Cannot delete events for year ${year}: ${usedEvents.length} events are used in puzzles`,
      );
    }

    // Delete all events for the year
    let deletedCount = 0;
    for (const event of events) {
      await ctx.db.delete(event._id);
      deletedCount++;
    }

    return {
      year,
      deletedCount,
    };
  },
});

// Get all years with event counts (public for admin scripts)
export const getAllYearsWithStats = query({
  handler: async (ctx) => {
    const allEvents = await ctx.db.query("events").collect();

    // Group events by year
    const yearStats = new Map<number, { total: number; used: number }>();

    for (const event of allEvents) {
      const stats = yearStats.get(event.year) || { total: 0, used: 0 };
      stats.total++;
      // Count as used if assigned to Classic mode (primary mode)
      if (event.classicPuzzleId !== undefined) {
        stats.used++;
      }
      yearStats.set(event.year, stats);
    }

    // Convert to sorted array
    const result = Array.from(yearStats.entries())
      .map(([year, stats]) => ({
        year,
        total: stats.total,
        used: stats.used,
        available: stats.total - stats.used,
      }))
      .sort((a, b) => a.year - b.year); // Chronological order

    return result;
  },
});

// Get pool statistics (public for admin scripts)
export const getEventPoolStats = query({
  handler: async (ctx) => {
    const allEvents = await ctx.db.query("events").collect();
    // Count Classic mode assignments (primary mode for pool stats)
    const assignedEvents = allEvents.filter((e) => e.classicPuzzleId !== undefined);
    const unassignedEvents = allEvents.filter((e) => e.classicPuzzleId === undefined);

    // Count unique years
    const uniqueYears = new Set(allEvents.map((e) => e.year));

    // Count years with enough events
    const yearEventCounts = new Map<number, number>();
    for (const event of unassignedEvents) {
      const count = yearEventCounts.get(event.year) || 0;
      yearEventCounts.set(event.year, count + 1);
    }

    const yearsWithEnoughEvents = Array.from(yearEventCounts.values()).filter(
      (count) => count >= 6,
    ).length;

    return {
      totalEvents: allEvents.length,
      assignedEvents: assignedEvents.length,
      unassignedEvents: unassignedEvents.length,
      uniqueYears: uniqueYears.size,
      availableYearsForPuzzles: yearsWithEnoughEvents,
    };
  },
});

// Import event with full metadata from generation pipeline
export const importEventWithMetadata = internalMutation({
  args: {
    year: v.number(),
    event: v.string(),
    metadata: v.optional(
      v.object({
        difficulty: v.optional(v.number()),
        category: v.optional(v.array(v.string())),
        era: v.optional(v.string()),
        fame_level: v.optional(v.number()),
        tags: v.optional(v.array(v.string())),
      }),
    ),
  },
  handler: async (ctx, { year, event, metadata }) => {
    // Check if this exact event already exists
    const existing = await ctx.db
      .query("events")
      .withIndex("by_year", (q) => q.eq("year", year))
      .filter((q) => q.eq(q.field("event"), event))
      .first();

    if (existing) {
      // If metadata is provided and event exists without it, update the metadata
      if (metadata && !existing.metadata) {
        await ctx.db.patch(existing._id, {
          metadata,
          updatedAt: Date.now(),
        });
        return { updated: true, id: existing._id };
      }
      return { skipped: true, id: existing._id };
    }

    // Create new event with metadata
    const id = await ctx.db.insert("events", {
      year,
      event,
      metadata,
      updatedAt: Date.now(),
    });

    return { created: true, id };
  },
});

// Batch import events with metadata for a year
export const importYearEventsWithMetadata = internalMutation({
  args: {
    year: v.number(),
    events: v.array(
      v.object({
        event: v.string(),
        metadata: v.optional(
          v.object({
            difficulty: v.optional(v.number()),
            category: v.optional(v.array(v.string())),
            era: v.optional(v.string()),
            fame_level: v.optional(v.number()),
            tags: v.optional(v.array(v.string())),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, { year, events }) => {
    const results = [];

    for (const { event, metadata } of events) {
      // Check if this exact event already exists
      const existing = await ctx.db
        .query("events")
        .withIndex("by_year", (q) => q.eq("year", year))
        .filter((q) => q.eq(q.field("event"), event))
        .first();

      if (existing) {
        // Update metadata if provided and event lacks it
        if (metadata && !existing.metadata) {
          await ctx.db.patch(existing._id, {
            metadata,
            updatedAt: Date.now(),
          });
          results.push({ event, updated: true, id: existing._id });
        } else {
          results.push({ event, skipped: true, id: existing._id });
        }
        continue;
      }

      // Create new event with metadata
      const id = await ctx.db.insert("events", {
        year,
        event,
        metadata,
        updatedAt: Date.now(),
      });

      results.push({ event, created: true, id });
    }

    return {
      year,
      total: events.length,
      created: results.filter((r) => r.created).length,
      updated: results.filter((r) => r.updated).length,
      skipped: results.filter((r) => r.skipped).length,
      results,
    };
  },
});

// Delete a single event (if not used in a puzzle)
export const deleteEvent = internalMutation({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);

    if (!event) {
      throw new Error(`Event with ID ${eventId} not found.`);
    }

    // Check if used in either game mode
    if (event.classicPuzzleId !== undefined || event.orderPuzzleId !== undefined) {
      throw new Error("Cannot delete event: It is used in a puzzle.");
    }

    await ctx.db.delete(eventId);

    return { deleted: true, eventId };
  },
});

// Update a single event (if not used in a puzzle)
export const updateEvent = internalMutation({
  args: {
    eventId: v.id("events"),
    newEvent: v.string(),
  },
  handler: async (ctx, { eventId, newEvent }) => {
    const event = await ctx.db.get(eventId);

    if (!event) {
      throw new Error(`Event with ID ${eventId} not found.`);
    }

    // Check if used in either game mode
    if (event.classicPuzzleId !== undefined || event.orderPuzzleId !== undefined) {
      throw new Error("Cannot update event: It is used in a puzzle.");
    }

    // Check if the new event text already exists for that year
    const existing = await ctx.db
      .query("events")
      .withIndex("by_year", (q) => q.eq("year", event.year))
      .filter((q) => q.eq(q.field("event"), newEvent))
      .first();

    if (existing && existing._id !== eventId) {
      throw new Error(`An event with this text already exists for the year ${event.year}.`);
    }

    await ctx.db.patch(eventId, {
      event: newEvent,
      updatedAt: Date.now(),
    });

    return { updated: true, eventId };
  },
});
