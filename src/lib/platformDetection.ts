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

/**
 * Checks if the current environment is a touch device
 * Additional helper for mobile detection
 */
export const isTouchDevice = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
};

/**
 * Detects if the device is likely a tablet
 * Useful for determining intermediate sharing behavior
 */
export const isTabletDevice = (): boolean => {
  if (!isMobileDevice()) {
    return false;
  }

  // iPad detection
  if (/iPad/i.test(navigator.userAgent)) {
    return true;
  }

  // Android tablet detection (approximate)
  if (/Android/i.test(navigator.userAgent) && !/Mobile/i.test(navigator.userAgent)) {
    return true;
  }

  return false;
};

/**
 * Gets detailed platform information for debugging
 * Useful for troubleshooting share issues
 */
export interface PlatformInfo {
  isMobile: boolean;
  isTablet: boolean;
  isTouch: boolean;
  supportsWebShare: boolean;
  strategy: ShareStrategy;
  userAgent: string;
}

export const getPlatformInfo = (): PlatformInfo => {
  const isMobile = isMobileDevice();
  const isTablet = isTabletDevice();
  const isTouch = isTouchDevice();
  const webShareSupported = supportsWebShare();
  const strategy = getShareStrategy();

  return {
    isMobile,
    isTablet,
    isTouch,
    supportsWebShare: webShareSupported,
    strategy,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "SSR",
  };
};
