import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export function useCopyEmail(email: string = "hello@mistystep.io") {
  const [hasCopied, setHasCopied] = useState(false);
  const { addToast } = useToast();

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(email);
      setHasCopied(true);

      // Reset after 2 seconds
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      // Fallback or silent fail - the mailto link is the backup
      addToast({
        title: "Could not copy email",
        description: "Please try manually or use the mail link.",
        variant: "destructive",
      });
    }
  }, [email, addToast]);

  return { hasCopied, copy, email };
}
