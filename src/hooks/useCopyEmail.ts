import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

export function useCopyEmail(email: string = "hello@mistystep.io") {
  const [hasCopied, setHasCopied] = useState(false);
  const { addToast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const copy = useCallback(async () => {
    try {
      // Clear any existing timeout before setting a new one
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      await navigator.clipboard.writeText(email);
      setHasCopied(true);

      // Reset after 2 seconds
      timeoutRef.current = setTimeout(() => setHasCopied(false), 2000);
    } catch {
      // Fallback or silent fail - the mailto link is the backup
      addToast({
        title: "Could not copy email",
        description: "Please try manually or use the mail link.",
        variant: "destructive",
      });
    }
  }, [email, addToast]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { hasCopied, copy, email };
}
