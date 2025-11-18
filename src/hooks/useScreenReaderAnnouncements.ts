import { useState, useEffect } from "react";
import { formatYear } from "@/lib/displayFormatting";
import type { RangeGuess } from "@/types/range";

interface UseScreenReaderAnnouncementsProps {
  ranges: RangeGuess[];
  lastRangeCount: number;
  setLastRangeCount: (count: number) => void;
}

/**
 * Announces range submissions for assistive technologies.
 * Focuses on the latest committed range and whether it contained the target.
 */
export function useScreenReaderAnnouncements({
  ranges,
  lastRangeCount,
  setLastRangeCount,
}: UseScreenReaderAnnouncementsProps) {
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const currentCount = ranges.length;

    if (currentCount > lastRangeCount && currentCount > 0) {
      const latestRange = ranges[currentCount - 1];
      const width = latestRange.end - latestRange.start + 1;
      const baseMessage = `Range ${formatYear(latestRange.start)} to ${formatYear(latestRange.end)} submitted.`;
      const scoreMessage =
        typeof latestRange.score === "number" && latestRange.score > 0
          ? `Contained the target for ${latestRange.score} points.`
          : `Missed the target. Width ${width} year${width === 1 ? "" : "s"}.`;

      setAnnouncement(`${baseMessage} ${scoreMessage}`.trim());
      setLastRangeCount(currentCount);
    }
  }, [ranges, lastRangeCount, setLastRangeCount]);

  return announcement;
}
