/**
 * Platform Detection Utilities
 * Determines the appropriate sharing strategy based on device and browser capabilities
 */

/**
 * Detects if the current device is a mobile device
 * Uses user agent detection to identify mobile platforms
 */
export const isMobileDevice = (): boolean => {
  // Return false during SSR
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Checks if the Web Share API is supported and available
 */
export const supportsWebShare = (): boolean => {
  return (
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    typeof navigator.share === "function"
  );
};

/**
 * Determines the optimal sharing strategy for the current platform
 * Returns the recommended approach for sharing content
 */
export type ShareStrategy = "native" | "clipboard" | "fallback";

export const getShareStrategy = (): ShareStrategy => {
  // Use native Web Share API only on mobile devices
  // Desktop Chrome has Web Share but provides poor UX
  if (isMobileDevice() && supportsWebShare()) {
    return "native";
  }

  // Use clipboard on desktop with modern browsers
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    return "clipboard";
  }

  // Legacy fallback for older browsers
  return "fallback";
};
