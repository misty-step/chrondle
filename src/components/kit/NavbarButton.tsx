"use client";

import React from "react";
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
  className,
  as = "button",
  size = "md",
  onClick,
  title,
  "aria-label": ariaLabel,
}) => {
  const sizeClasses = {
    sm: "h-11 w-11 text-sm",
    md: "h-11 w-11 text-base",
    lg: "h-12 w-12 text-lg",
  };

  const buttonClasses = cn(
    sizeClasses[size],
    "relative flex shrink-0 cursor-pointer items-center justify-center rounded-lg",
    "text-muted-foreground hover:bg-surface-inset hover:text-foreground transition-colors duration-150",
    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        className={buttonClasses}
        onClick={onClick}
        title={title}
        aria-label={ariaLabel || title}
      >
        {children}
      </Link>
    );
  }

  const Component = as === "div" ? "div" : "button";

  return (
    <Component
      type={as === "div" ? undefined : "button"}
      role={as === "div" ? "button" : undefined}
      tabIndex={as === "div" ? 0 : undefined}
      onKeyDown={(event) => {
        if (as !== "div") return;
        if (event.key === " ") event.preventDefault();
        if (event.key === "Enter") event.currentTarget.click();
      }}
      onKeyUp={(event) => {
        if (as === "div" && event.key === " ") {
          event.preventDefault();
          event.currentTarget.click();
        }
      }}
      onClick={onClick}
      className={buttonClasses}
      title={title}
      aria-label={ariaLabel || title}
    >
      {children}
    </Component>
  );
};

NavbarButton.displayName = "NavbarButton";
