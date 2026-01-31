"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Individual toast item component
 */
function ToastItem({
  title,
  description,
  variant = "default",
  actionLabel,
  onAction,
  onDismiss,
}: {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "pointer-events-auto relative flex w-full max-w-md items-start gap-3 overflow-hidden rounded border p-4 shadow-lg",
        variant === "destructive"
          ? "border-destructive bg-destructive/10 text-destructive"
          : "border-border bg-card text-card-foreground",
      )}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex-1 space-y-1">
        {title && <div className="text-sm leading-tight font-semibold">{title}</div>}
        {description && <div className="text-sm leading-snug opacity-90">{description}</div>}
        {actionLabel && onAction && (
          <button
            onClick={() => {
              onAction();
              onDismiss();
            }}
            className={cn(
              "mt-2 inline-flex items-center rounded px-3 py-1.5 text-xs font-medium transition-colors",
              variant === "destructive"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-body-primary-foreground hover:bg-primary/90",
            )}
          >
            {actionLabel}
          </button>
        )}
      </div>
      <button
        onClick={onDismiss}
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded transition-opacity hover:opacity-70",
          variant === "destructive" ? "text-destructive" : "text-muted-foreground",
        )}
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

/**
 * Toast container that renders toasts via portal
 * Positioned at bottom-right with aria-live region
 */
export function Toaster() {
  const { toasts, removeToast } = useToast();
  const [mounted, setMounted] = React.useState(false);

  // Only render portal client-side to avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const toastContainer = (
    <div
      className="pointer-events-none fixed right-0 bottom-0 z-50 flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:right-4 sm:bottom-4 sm:max-w-md"
      aria-label="Notifications"
      role="region"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            actionLabel={toast.actionLabel}
            onAction={toast.onAction}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );

  return createPortal(toastContainer, document.body);
}
