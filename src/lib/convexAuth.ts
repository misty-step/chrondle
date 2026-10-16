import { auth } from "@clerk/nextjs/server";
import type { ConvexHttpClient } from "convex/browser";

/** Bind only the current request's verified Clerk session to a fresh client. */
export async function authenticateConvexClient(client: ConvexHttpClient): Promise<void> {
  const token = await (await auth()).getToken({ template: "convex" });
  if (!token) throw new Error("Authenticated backend token unavailable");
  client.setAuth(token);
}
