import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { api } from "convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { getEnvVar, isProduction } from "@/lib/env";
import { logger } from "@/lib/logger";

type ClerkEventType = "user.created" | "user.updated";

export async function POST(req: Request) {
  // Validate Convex URL configuration with graceful error handling
  const convexUrl = getEnvVar("NEXT_PUBLIC_CONVEX_URL");
  if (!convexUrl) {
    logger.error("NEXT_PUBLIC_CONVEX_URL is not configured for webhook");
    const errorMessage = isProduction()
      ? "Service temporarily unavailable"
      : "Error: NEXT_PUBLIC_CONVEX_URL is not configured";
    return new Response(errorMessage, {
      status: 503, // Service Unavailable is more appropriate than 500
    });
  }

  // Create Convex client inside the function to avoid build-time initialization
  const convexClient = new ConvexHttpClient(convexUrl);
  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error: Missing Svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Validate webhook secret configuration
  const webhookSecret = getEnvVar("CLERK_WEBHOOK_SECRET");
  if (!webhookSecret) {
    logger.warn("CLERK_WEBHOOK_SECRET is not configured - webhook verification may fail");
  }

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(webhookSecret || "");

  let evt: WebhookEvent;

  // Verify the webhook
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    logger.error("Error verifying webhook:", err);
    return new Response("Error: Webhook verification failed", {
      status: 400,
    });
  }

  // Validate sync secret
  const syncSecret = getEnvVar("CLERK_SYNC_SECRET");
  if (!syncSecret) {
    logger.error("CLERK_SYNC_SECRET is not configured");
    return new Response("Error: Sync secret not configured", { status: 500 });
  }

  // Handle the webhook
  const eventType = evt.type;

  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, email_addresses, primary_email_address_id } = evt.data;

    // Find the primary email
    const primaryEmail = email_addresses.find((email) => email.id === primary_email_address_id);

    if (!primaryEmail) {
      return new Response("Error: No primary email found", {
        status: 400,
      });
    }

    try {
      // Create or update user via internal action (not public mutation)
      await convexClient.action(api.clerk.webhookAction.processWebhookEvent, {
        secret: syncSecret,
        eventType: eventType as ClerkEventType,
        payload: {
          clerkId: id,
          email: primaryEmail.email_address,
        },
      });

      return new Response("User synced successfully", { status: 200 });
    } catch (error) {
      logger.error("Error syncing user to Convex:", error);
      return new Response("Error: Failed to sync user", {
        status: 500,
      });
    }
  }

  return new Response("Webhook processed", { status: 200 });
}
