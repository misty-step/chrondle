"use client";

import * as React from "react";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

type ToastAction =
  | { type: "ADD_TOAST"; toast: Toast }
  | { type: "REMOVE_TOAST"; id: string }
  | { type: "DISMISS_ALL" };

function toastReducer(state: Toast[], action: ToastAction): Toast[] {
  switch (action.type) {
    case "ADD_TOAST":
      return [...state, action.toast];
    case "REMOVE_TOAST":
      return state.filter((toast) => toast.id !== action.id);
    case "DISMISS_ALL":
      return [];
    default:
      return state;
  }
}

let toastIdCounter = 0;

function generateToastId(): string {
  toastIdCounter += 1;
  return `toast-${toastIdCounter}-${Date.now()}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = React.useReducer(toastReducer, []);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = generateToastId();
    dispatch({ type: "ADD_TOAST", toast: { ...toast, id } });

    // Auto-dismiss after 6-8 seconds (use 7s average)
    const dismissTimeout = setTimeout(() => {
      dispatch({ type: "REMOVE_TOAST", id });
    }, 7000);

    return () => clearTimeout(dismissTimeout);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    dispatch({ type: "REMOVE_TOAST", id });
  }, []);

  const value = React.useMemo(
    () => ({ toasts, addToast, removeToast }),
    [toasts, addToast, removeToast],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

/**
 * Hook to access toast system
 * Returns context with toasts array and add/remove functions
 * Always returns a valid object (never undefined)
 */
export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) {
    // Return safe defaults if used outside provider
    return {
      toasts: [],
      addToast: () => {},
      removeToast: () => {},
    };
  }
  return context;
}
