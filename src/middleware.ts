import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define which routes should be protected
const isProtectedRoute = createRouteMatcher([
  "/api/user(.*)", // User API routes
  "/api/subscription(.*)", // Subscription management
]);

// Define routes that should always be public
const isPublicRoute = createRouteMatcher([
  "/", // Home page (today's puzzle)
  "/archive(.*)", // Archive browsing (puzzles gated by subscription)
  "/pricing(.*)", // Pricing page
  "/api/historical-context(.*)", // Historical context API
  "/api/stripe/checkout(.*)", // Stripe checkout (auth checked in handler)
  "/api/webhooks/stripe(.*)", // Stripe webhooks
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes without authentication
  if (isPublicRoute(req)) {
    return;
  }

  // Protect specific routes
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
