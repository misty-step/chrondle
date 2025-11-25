"use client";

import React, { useRef } from "react";
import { motion } from "motion/react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/SessionThemeProvider";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Animated theme toggle button with smooth transitions
 * Switches between light and dark mode with delightful animations
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "", size = "md" }) => {
  const { currentTheme, override, systemTheme, toggle, isMounted } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Icon size based on the size prop
  const iconSize = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5";

  // Button size based on the size prop
  const buttonSize = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";

  // Generate tooltip that shows current state and what clicking will do
  const getTooltip = () => {
    if (override) {
      return `Theme: ${currentTheme} (overriding system ${systemTheme})`;
    } else {
      return `Theme: ${currentTheme} (following system)`;
    }
  };

  // Handle click: toggle theme and remove focus
  const handleClick = () => {
    toggle();
    buttonRef.current?.blur(); // Remove focus ring after click
  };

  return (
    <motion.button
      ref={buttonRef}
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.05 }}
      onClick={handleClick}
      className={cn(
        // Base button styles - angular archival aesthetic
        buttonSize,
        "rounded-sm",
        "focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none",
        "transition-colors duration-200",
        "flex items-center justify-center",
        "group relative overflow-hidden",
        "hover:bg-accent/50",
        "cursor-pointer",
        className,
      )}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      aria-label={getTooltip()}
      title={getTooltip()}
      type="button"
    >
      <motion.div
        initial={false}
        animate={{
          rotate: isMounted && currentTheme === "dark" ? 0 : 45,
          scale: isMounted && currentTheme === "dark" ? 0.9 : 1,
        }}
        transition={{
          duration: 0.3,
          ease: "easeInOut",
          type: "spring",
          stiffness: 200,
          damping: 20,
        }}
        className="flex items-center justify-center"
      >
        {/* Always render Sun icon initially to prevent hydration mismatch */}
        {/* The animation and appearance will update after mount */}
        {!isMounted ? (
          <Sun className={cn(iconSize, "text-body-primary")} />
        ) : currentTheme === "dark" ? (
          <Moon className={cn(iconSize, "text-body-primary")} />
        ) : (
          <Sun className={cn(iconSize, "text-body-primary")} />
        )}
      </motion.div>

      {/* Subtle hover effect overlay - angular archival */}
      <motion.div
        className="bg-primary/10 absolute inset-0 rounded-sm opacity-0"
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        aria-hidden="true"
      />
    </motion.button>
  );
};
