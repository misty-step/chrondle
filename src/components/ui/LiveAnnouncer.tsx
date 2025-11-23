"use client";

import React, { useEffect, useState } from "react";

interface LiveAnnouncerProps {
  /** Message to announce to screen readers */
  message: string;
  /** Politeness level for announcements */
  priority?: "polite" | "assertive";
  /** Clear message after delay (ms) */
  clearAfter?: number;
}

export const LiveAnnouncer: React.FC<LiveAnnouncerProps> = ({
  message,
  priority = "polite",
  clearAfter = 3000,
}) => {
  const [currentMessage, setCurrentMessage] = useState("");

  useEffect(() => {
    if (message && message !== currentMessage) {
      setCurrentMessage(message);

      if (clearAfter > 0) {
        const timer = setTimeout(() => {
          setCurrentMessage("");
        }, clearAfter);

        return () => clearTimeout(timer);
      }
    }
  }, [message, currentMessage, clearAfter]);

  return (
    <div aria-live={priority} aria-atomic="true" className="sr-only" role="status">
      {currentMessage}
    </div>
  );
};
