"use client";

import Link from "next/link";
import { Check, Mail } from "lucide-react";
import { useCopyEmail } from "@/hooks/useCopyEmail";
import { LayoutContainer } from "@/components/LayoutContainer";
import { cn } from "@/lib/utils";

export function Footer() {
  const { hasCopied, copy } = useCopyEmail("hello@mistystep.io");

  return (
    <footer className="bg-surface-primary border-outline-default text-body-secondary relative z-10 w-full border-t-2 border-double py-8">
      {/* Texture Overlay */}
      <div className="bg-texture-noise pointer-events-none absolute inset-0 opacity-20 mix-blend-multiply" />

      <LayoutContainer className="relative">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Left: Brand, Version & Copyright */}
          <div className="flex items-baseline gap-3">
            <Link
              href="/"
              className="font-display text-primary text-xl font-medium tracking-tight transition-opacity hover:opacity-80"
            >
              Chrondle
            </Link>
            <Link
              href="/releases"
              className="text-muted-foreground/60 hover:text-muted-foreground font-serif text-xs transition-colors"
              title="View releases"
            >
              v{process.env.NEXT_PUBLIC_APP_VERSION}
            </Link>
            <span className="text-muted-foreground/60 font-serif text-xs">
              © {new Date().getFullYear()}
            </span>
          </div>

          {/* Right: Project, Feedback, Legal */}
          <nav className="text-muted-foreground flex flex-wrap items-center justify-center gap-6 font-serif text-sm">
            <a
              href="https://mistystep.io"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors hover:underline hover:underline-offset-4"
            >
              A Misty Step Project
            </a>

            <button
              onClick={(e) => {
                e.preventDefault();
                copy();
              }}
              className={cn(
                "group flex items-center gap-1.5 transition-colors",
                hasCopied
                  ? "text-feedback-success"
                  : "hover:text-primary hover:underline hover:underline-offset-4",
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

            <div className="bg-border hidden h-3 w-px md:block" />

            <div className="flex gap-4">
              <Link
                href="/legal/privacy"
                className="hover:text-primary transition-colors hover:underline hover:underline-offset-4"
              >
                Privacy
              </Link>
              <Link
                href="/legal/terms"
                className="hover:text-primary transition-colors hover:underline hover:underline-offset-4"
              >
                Terms
              </Link>
            </div>
          </nav>
        </div>
      </LayoutContainer>
    </footer>
  );
}
