"use client";

import Link from "next/link";
import { Check, Mail } from "lucide-react";
import { useCopyEmail } from "@/hooks/useCopyEmail";
import { cn } from "@/lib/utils";

export function Footer() {
  const { hasCopied, copy } = useCopyEmail("hello@mistystep.io");

  return (
    <footer className="border-border/40 bg-muted/5 mt-auto w-full border-t py-8">
      <div className="flex flex-col items-center justify-center gap-4 text-center md:flex-row md:gap-8">
        {/* Tier 1: The Maker */}
        <p className="text-muted-foreground font-serif text-sm tracking-wide">
          <span className="italic">Crafted by</span> <MistyStepLink />
        </p>

        {/* Separator (Desktop) */}
        <span className="text-muted-foreground/20 hidden md:inline">•</span>

        {/* Tier 2: The Action (Support) - Text Link style now */}
        <button
          onClick={(e) => {
            e.preventDefault();
            copy();
          }}
          className={cn(
            "group flex items-center gap-1.5 text-xs font-medium transition-colors",
            hasCopied ? "text-green-600" : "text-muted-foreground hover:text-foreground",
          )}
          aria-label="Copy support email address"
        >
          {hasCopied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Email Copied</span>
            </>
          ) : (
            <>
              <Mail className="h-3.5 w-3.5 opacity-70 transition-opacity group-hover:opacity-100" />
              <span>Feedback</span>
            </>
          )}
        </button>

        {/* Separator (Desktop) */}
        <span className="text-muted-foreground/20 hidden md:inline">•</span>

        {/* Tier 3: Legal */}
        <nav
          aria-label="Legal"
          className="text-muted-foreground/60 flex items-center gap-4 text-xs"
        >
          <Link href="/legal/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <span className="opacity-50">© {new Date().getFullYear()}</span>
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
