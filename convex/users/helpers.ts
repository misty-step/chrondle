import { Doc } from "../_generated/dataModel";

/**
 * User Helpers - Shared logic for subscription/entitlement checks
 *
 * Centralizes access control logic to ensure consistency between
 * queries and subscriptions modules.
 */

/**
 * Check if a user has archive access based on subscription state
 *
 * Access granted when:
 * - subscriptionStatus is "active" or "trialing"
 * - subscription hasn't expired (no end date or end date in future)
 */
export function checkArchiveAccess(user: Doc<"users">): boolean {
  // Check subscription status (active or trialing grants access)
  if (user.subscriptionStatus !== "active" && user.subscriptionStatus !== "trialing") {
    return false;
  }

  // Check if subscription has expired
  if (user.subscriptionEndDate && user.subscriptionEndDate < Date.now()) {
    return false;
  }

  return true;
}
