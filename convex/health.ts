import { query } from "./_generated/server";

export const systemCheck = query({
  handler: async () => {
    return "ok";
  },
});
