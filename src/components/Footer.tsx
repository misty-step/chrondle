"use client";

import Link from "next/link";
import { Check, Envelope } from "@/components/kit/icons";
import { useCopyEmail } from "@/hooks/useCopyEmail";
import { LayoutContainer } from "@/components/LayoutContainer";
import { cn } from "@/lib/utils";

const footerLinkClasses =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm transition-colors hover:text-foreground focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

export function Footer() {
  const { hasCopied, copy } = useCopyEmail("hello@mistystep.io");

  return (
    <footer className="bg-background border-border text-muted-foreground relative z-10 w-full border-t py-6">
      <LayoutContainer>
        <div className="flex flex-col items-center justify-between gap-3 md:flex-row md:gap-6">
          <div className="flex flex-wrap items-center justify-center gap-x-3">
            <Link
              href="/"
              className={cn(footerLinkClasses, "font-display text-foreground text-xl")}
            >
              Chrondle
            </Link>
            <Link
              href="/releases"
              className={cn(footerLinkClasses, "font-mono text-xs")}
              title="View releases"
            >
              v{process.env.NEXT_PUBLIC_APP_VERSION}
            </Link>
            <span className="font-body text-xs">© {new Date().getFullYear()}</span>
          </div>

          <nav
            aria-label="Footer navigation"
            className="font-body flex flex-wrap items-center justify-center gap-x-5 text-sm"
          >
            <a
              href="https://mistystep.io"
              target="_blank"
              rel="noopener noreferrer"
              className={footerLinkClasses}
            >
              A Misty Step project
            </a>

            <button
              type="button"
              onClick={() => void copy()}
              className={cn(
                footerLinkClasses,
                "cursor-pointer gap-1.5",
                hasCopied ? "text-feedback-success" : "hover:text-foreground",
              )}
              aria-label={hasCopied ? "Support email copied" : "Copy support email address"}
            >
              {hasCopied ? (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  <span>Email copied</span>
                </>
              ) : (
                <>
                  <Envelope className="h-4 w-4" aria-hidden="true" />
                  <span>Feedback</span>
                </>
              )}
            </button>

            <Link href="/legal/privacy" className={footerLinkClasses}>
              Privacy
            </Link>
            <Link href="/legal/terms" className={footerLinkClasses}>
              Terms
            </Link>
          </nav>
        </div>
      </LayoutContainer>
    </footer>
  );
}
