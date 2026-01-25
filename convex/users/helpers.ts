import { Doc } from "../_generated/dataModel";

/**
 * User Helpers - Shared logic for subscription/entitlement checks
 *
 * Centralizes access control logic to ensure consistency between
 * queries and subscriptions modules.
 *
 * Ousterhout principle: Deep module with simple interface.
 * All access logic lives here - callers just ask "does user have access?"
 */

/**
 * Check if a user has archive access based on subscription state
 *
 * Access granted when ANY of these conditions are met:
 * 1. Active subscription (status = "active") within period
 * 2. Trialing subscription (status = "trialing") within period
 * 3. Canceled but within grace period (paid through end of billing cycle)
 * 4. Active trial (trialEndsAt in future, regardless of subscription status)
 *
 * Business model: Users keep access until their paid period ends.
 * Cancellation is immediate for new charges, not for access.
 */
export function checkArchiveAccess(user: Doc<"users">): boolean {
  const now = Date.now();

  // 1. Check for active trial (independent of subscription status)
  // This handles the "honor trial on upgrade" business requirement
  if (user.trialEndsAt && user.trialEndsAt > now) {
    return true;
  }

  // 2. Active or trialing subscription within period
  if (user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing") {
    // No end date means indefinite access (shouldn't happen, but safe default)
    if (!user.subscriptionEndDate) {
      return true;
    }
    // Within subscription period
    if (user.subscriptionEndDate > now) {
      return true;
    }
    // Period expired - no access
    return false;
  }

  // 3. Canceled subscription but within grace period
  // User canceled but already paid for current period - honor that
  if (user.subscriptionStatus === "canceled") {
    if (user.subscriptionEndDate && user.subscriptionEndDate > now) {
      return true;
    }
  }

  // 4. past_due, null, or expired - no access
  return false;
}
