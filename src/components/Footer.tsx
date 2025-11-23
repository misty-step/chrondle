"use client";

import Link from "next/link";
import { Check, Mail } from "lucide-react";
import { useCopyEmail } from "@/hooks/useCopyEmail";
import { cn } from "@/lib/utils";

export function Footer() {
  const { hasCopied, copy, email } = useCopyEmail("hello@mistystep.io");

  return (
    <footer className="mt-auto w-full py-12">
      <div className="flex flex-col items-center justify-center gap-8 text-center">
        {/* Tier 1: The Action (Support) */}
        <div className="group relative">
          <button
            onClick={(e) => {
              e.preventDefault();
              copy();
            }}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 transition-all duration-300",
              "text-muted-foreground hover:text-foreground",
              "hover:bg-muted/50 bg-transparent",
              "text-sm font-medium",
            )}
            aria-label="Copy support email address"
          >
            {hasCopied ? (
              <>
                <Check className="animate-in zoom-in h-4 w-4 text-green-600 duration-300" />
                <span className="text-foreground">Email Copied!</span>
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
                <span>Feedback & Support</span>
              </>
            )}
          </button>
          {/* Accessible Fallback (hidden but readable/functional if JS fails or for right-click) */}
          <a href={`mailto:${email}`} className="sr-only">
            Send email to {email}
          </a>
        </div>

        {/* Tier 2: The Maker */}
        <div className="flex flex-col items-center gap-1">
          <p className="text-muted-foreground font-serif text-sm tracking-wide italic">
            A <MistyStepLink /> Production
          </p>
        </div>

        {/* Tier 3: The Foundation (Legal) */}
        <nav
          aria-label="Legal"
          className="text-muted-foreground/60 flex items-center gap-4 text-xs"
        >
          <span>© {new Date().getFullYear()}</span>
          <span aria-hidden="true">•</span>
          <Link href="/legal/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <span aria-hidden="true">•</span>
          <Link href="/legal/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}

function MistyStepLink() {
  return (
    <a
      href="https://mistystep.io"
      target="_blank"
      rel="noopener noreferrer"
      className="group text-foreground hover:text-primary inline-flex items-center font-semibold not-italic transition-colors"
    >
      Misty Step
      {/* Subtle dot pulse animation */}
      <span className="relative -mt-2 ml-0.5 flex h-1.5 w-1.5">
        <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 duration-1000 group-hover:opacity-100"></span>
        <span className="bg-primary/80 relative inline-flex h-1.5 w-1.5 rounded-full"></span>
      </span>
    </a>
  );
}
