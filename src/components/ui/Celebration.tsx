"use client";

import React, { useEffect, useState } from "react";

interface CelebrationProps {
  trigger?: boolean;
  duration?: number;
}

export const Celebration: React.FC<CelebrationProps> = ({ trigger = false, duration = 3000 }) => {
  const [isActive, setIsActive] = useState(false);

  // Listen for celebration events
  useEffect(() => {
    const handleCelebrate = () => {
      setIsActive(true);
      setTimeout(() => setIsActive(false), duration);
    };

    window.addEventListener("chrondle:celebrate", handleCelebrate);
    return () => window.removeEventListener("chrondle:celebrate", handleCelebrate);
  }, [duration]);

  // Handle trigger prop
  useEffect(() => {
    if (trigger) {
      setIsActive(true);
      setTimeout(() => setIsActive(false), duration);
    }
  }, [trigger, duration]);

  if (!isActive) return null;

  return (
    <div className="celebration-container" aria-hidden="true">
      {/* Confetti particles */}
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="confetti"
          style={
            {
              "--delay": `${Math.random() * 0.5}s`,
              "--duration": `${1 + Math.random() * 2}s`,
              "--x": `${Math.random() * 100 - 50}vw`,
              "--y": `${Math.random() * -100}vh`,
              "--rotation": `${Math.random() * 720 - 360}deg`,
              "--color": [
                "var(--primary)",
                "var(--feedback-success)",
                "var(--feedback-correct)",
                "#FFD700",
              ][Math.floor(Math.random() * 4)],
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
};
