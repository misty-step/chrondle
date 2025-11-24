"use client";

import Link from "next/link";
import { Check, Mail } from "lucide-react";
import { useCopyEmail } from "@/hooks/useCopyEmail";
import { LayoutContainer } from "@/components/LayoutContainer";
import { cn } from "@/lib/utils";

export function Footer() {
  const { hasCopied, copy } = useCopyEmail("hello@mistystep.io");

  return (
    <footer className="material-paper border-border/40 mt-auto w-full border-t py-8">
      <LayoutContainer>
        <div className="flex flex-row flex-wrap items-center justify-center gap-4 text-center">
          {/* Attribution - Archival subtlety */}
          <a
            href="https://mistystep.io"
            target="_blank"
            rel="noopener noreferrer"
            className="group text-muted-foreground/70 hover:text-primary inline-flex items-baseline gap-1 font-serif text-xs transition-colors"
          >
            <span>A Misty Step project</span>
          </a>

          {/* Separator */}
          <span className="text-muted-foreground/20 hidden md:inline">•</span>

          {/* Feedback - Functional with archival styling */}
          <button
            onClick={(e) => {
              e.preventDefault();
              copy();
            }}
            className={cn(
              "group flex items-center gap-1.5 font-serif text-xs font-medium transition-colors",
              hasCopied
                ? "text-feedback-success"
                : "text-muted-foreground/70 hover:text-foreground",
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

          {/* Separator */}
          <span className="text-muted-foreground/20 hidden md:inline">•</span>

          {/* Legal - Unified opacity */}
          <nav
            aria-label="Legal"
            className="text-muted-foreground/70 flex items-center gap-4 font-serif text-xs"
          >
            <Link
              href="/legal/terms"
              className="decoration-primary/50 hover:text-foreground underline-offset-4 transition-all hover:underline"
            >
              Terms
            </Link>
            <Link
              href="/legal/privacy"
              className="decoration-primary/50 hover:text-foreground underline-offset-4 transition-all hover:underline"
            >
              Privacy
            </Link>
            <span>© {new Date().getFullYear()}</span>
          </nav>
        </div>
      </LayoutContainer>
    </footer>
  );
}
