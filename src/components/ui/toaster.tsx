"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, XCircle } from "@phosphor-icons/react";
import { useToast } from "@/hooks/use-toast";

/**
 * The toast (aesthetic costume): news arrives at the edge and waits to
 * be read. A slip with the status on its glyph — the words stay ink.
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
      className="ae-toast pointer-events-auto w-full"
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      {variant === "destructive" && (
        <XCircle className="ae-icon is-fill ae-err shrink-0" aria-hidden="true" />
      )}
      <div className="flex-1">
        {title && <span className="ae-item">{title}</span>}
        {title && description && " "}
        {description && <span className="ae-dim">{description}</span>}
        {actionLabel && onAction && (
          <button
            onClick={() => {
              onAction();
              onDismiss();
            }}
            className="ae-button ae-button-quiet ae-button-compact mt-2 block"
          >
            {actionLabel}
          </button>
        )}
      </div>
      <button onClick={onDismiss} className="ae-toast-x" aria-label="Dismiss notification">
        <X className="ae-icon is-fill" aria-hidden="true" />
      </button>
    </motion.div>
  );
}

/**
 * Toast container that renders toasts via portal
 * The tray stacks bottom-right (aesthetic .ae-toasts).
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
    <div className="ae-toasts pointer-events-none" aria-label="Notifications" role="region">
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
