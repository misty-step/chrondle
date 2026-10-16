import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

/** The same verified Clerk admin identity used by the admin interface. */
export function getOperatorClient(): ConvexHttpClient {
  dotenv.config({ path: fileURLToPath(new URL("../../.env.local", import.meta.url)), quiet: true });
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const token = process.env.CONVEX_OPERATOR_TOKEN;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  if (!token)
    throw new Error("CONVEX_OPERATOR_TOKEN is not set (Clerk convex-template admin JWT required)");
  const client = new ConvexHttpClient(url);
  client.setAuth(token);
  return client;
}
