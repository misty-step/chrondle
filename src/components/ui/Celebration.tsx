"use client";

import React, { useEffect, useMemo, useState } from "react";

interface CelebrationProps {
  trigger?: boolean;
  duration?: number;
}

const seededRandom = (seed: number) => {
  const normalized = Math.sin(seed) * 10000;
  return normalized - Math.floor(normalized);
};

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

  const particleStyles = useMemo(() => {
    const colors = [
      "var(--primary)",
      "var(--feedback-success)",
      "var(--feedback-correct)",
      "#FFD700",
    ];

    return Array.from({ length: 50 }, (_, index) => {
      const baseSeed = 1337 + index * 97;
      return {
        "--delay": `${seededRandom(baseSeed) * 0.5}s`,
        "--duration": `${1 + seededRandom(baseSeed + 1) * 2}s`,
        "--x": `${seededRandom(baseSeed + 2) * 100 - 50}vw`,
        "--y": `${seededRandom(baseSeed + 3) * -100}vh`,
        "--rotation": `${seededRandom(baseSeed + 4) * 720 - 360}deg`,
        "--color": colors[Math.floor(seededRandom(baseSeed + 5) * colors.length)],
      } as React.CSSProperties;
    });
  }, []);

  if (!isActive) return null;

  return (
    <div className="celebration-container" aria-hidden="true">
      {/* Confetti particles */}
      {particleStyles.map((style, i) => (
        <div key={i} className="confetti" style={style} />
      ))}
    </div>
  );
};
