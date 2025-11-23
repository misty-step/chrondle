import { query } from "./_generated/server";

export const systemCheck = query({
  args: {},
  handler: async () => {
    return {
      ok: true,
      timestamp: Date.now(),
    };
  },
});
