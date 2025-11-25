"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  onClick: () => void;
  status: "idle" | "success" | "error";
  isLoading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  onClick,
  status,
  isLoading = false,
  className,
  children,
}) => {
  const getButtonContent = () => {
    switch (status) {
      case "success":
        return (
          <>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>Copied!</span>
          </>
        );
      case "error":
        return (
          <>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <span>Failed!</span>
          </>
        );
      default:
        return (
          children || (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                />
              </svg>
              <span>Share Results</span>
            </>
          )
        );
    }
  };

  const getButtonStyles = () => {
    const baseStyles =
      "font-semibold py-3 px-6 rounded-sm transition-all duration-200 flex items-center justify-center gap-2";

    switch (status) {
      case "success":
        return cn(baseStyles, "bg-green-500 hover:bg-green-600 text-white");
      case "error":
        return cn(baseStyles, "bg-red-500 hover:bg-red-600 text-white");
      default:
        return cn(baseStyles, "bg-blue-500 hover:bg-blue-600 text-white");
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        getButtonStyles(),
        "relative overflow-hidden",
        isLoading && "cursor-not-allowed opacity-50",
        className,
      )}
      aria-label={status === "success" ? "Results copied to clipboard" : "Share your results"}
    >
      <div
        className={cn(
          "flex items-center gap-2 transition-transform duration-200",
          status === "success" && "scale-110",
        )}
      >
        {getButtonContent()}
      </div>

      {/* Success ripple effect */}
      {status === "success" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="absolute inline-flex h-full w-full animate-ping rounded-sm bg-white opacity-20" />
        </div>
      )}
    </button>
  );
};
