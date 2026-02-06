"use client";

import React from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface NavbarButtonProps {
  children: React.ReactNode;
  href?: string;
  overlayColor?: "primary" | "rose" | "blue" | "green";
  showOverlay?: boolean;
  as?: "button" | "div" | "a";
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  title?: string;
  "aria-label"?: string;
}

export const NavbarButton: React.FC<NavbarButtonProps> = ({
  children,
  href,
  overlayColor = "primary",
  showOverlay = true,
  className,
  as = "button",
  size = "md",
  onClick,
  title,
  "aria-label": ariaLabel,
}) => {
  // Size classes
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  // Overlay color classes
  const overlayColors = {
    primary: "bg-primary/10",
    rose: "bg-rose-500/10",
    blue: "bg-blue-500/10",
    green: "bg-green-500/10",
  };

  const buttonClasses = cn(
    sizeClasses[size],
    "rounded relative overflow-hidden",
    "transition-all duration-200",
    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    "flex items-center justify-center group",
    "hover:bg-accent/50",
    "cursor-pointer",
    "text-body-primary",
    "border border-transparent hover:border-primary/20",
    className,
  );

  const content = (
    <>
      {children}
      {showOverlay && (
        <motion.div
          className={cn(
            "pointer-events-none absolute inset-0 rounded opacity-0",
            overlayColors[overlayColor],
          )}
          initial={false}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          aria-hidden="true"
        />
      )}
    </>
  );

  // If href is provided, render as Link
  if (href) {
    return (
      <Link href={href} className={buttonClasses}>
        <motion.div
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {content}
        </motion.div>
      </Link>
    );
  }

  // Render based on 'as' prop
  const Component = as === "div" ? motion.div : motion.button;

  return (
    <Component
      className={buttonClasses}
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
    >
      {content}
    </Component>
  );
};

NavbarButton.displayName = "NavbarButton";
