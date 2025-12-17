import { query } from "./_generated/server";

export const systemCheck = query({
  handler: async (ctx) => {
    // Test actual database connectivity, not just HTTP reachability
    await ctx.db.query("puzzles").first();
    return "ok";
  },
});
