// Re-export query functions for backward compatibility
export {
  getCurrentUser,
  getUserByClerkId,
  userExists,
  getUserStats,
  hasArchiveAccess,
} from "./users/queries";

// Re-export mutation functions for backward compatibility
// Note: createUser is internal-only, called via clerk/webhookAction
export { getOrCreateCurrentUser, updateUsername } from "./users/mutations";

// Re-export statistics functions for backward compatibility
export { updateUserStats } from "./users/statistics";

// Re-export subscription query (mutations are internal, accessed via stripe/webhookAction)
export { getSubscriptionStatus } from "./users/subscriptions";

// Re-export migration functions for backward compatibility
export { mergeAnonymousState, mergeAnonymousStreak } from "./migration/anonymous";
