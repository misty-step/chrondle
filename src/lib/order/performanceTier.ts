/**
 * Performance tier calculation for Order mode completion screen
 * Provides emotional context and celebration based on player accuracy
 */

export interface PerformanceTier {
  title: string;
  message: string;
  tier: "perfect" | "excellent" | "good" | "fair" | "challenging";
}

/**
 * Calculates performance tier based on chronological accuracy percentage
 * Uses natural breakpoints that feel intuitive to players
 */
export function getPerformanceTier(accuracyPercent: number): PerformanceTier {
  // Perfect score deserves special recognition
  if (accuracyPercent === 100) {
    return {
      title: "Perfect Timeline!",
      message: "Flawless chronological sense",
      tier: "perfect",
    };
  }

  // Excellent: 80-99% - Strong performance
  if (accuracyPercent >= 80) {
    return {
      title: "Excellent Work!",
      message: "Strong historical knowledge",
      tier: "excellent",
    };
  }

  // Good: 60-79% - Solid effort
  if (accuracyPercent >= 60) {
    return {
      title: "Good Effort!",
      message: "Solid attempt",
      tier: "good",
    };
  }

  // Fair: 40-59% - Room to improve
  if (accuracyPercent >= 40) {
    return {
      title: "Tricky One!",
      message: "Room to improve",
      tier: "fair",
    };
  }

  // Challenging: 0-39% - Tough puzzle
  return {
    title: "Challenging!",
    message: "These were tough events",
    tier: "challenging",
  };
}

/**
 * Get color theme for performance tier (for visual feedback)
 */
export function getTierColorClass(tier: PerformanceTier["tier"]): string {
  switch (tier) {
    case "perfect":
      return "text-feedback-success";
    case "excellent":
      return "text-primary";
    case "good":
      return "text-foreground";
    case "fair":
      return "text-muted-foreground";
    case "challenging":
      return "text-muted-foreground";
  }
}
