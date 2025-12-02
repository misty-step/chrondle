"use client";

import { useState } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, X, Archive, Heart, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/SessionThemeProvider";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

import { cn } from "@/lib/utils";
import { NavbarButton } from "@/components/ui/NavbarButton";

interface MobileNavMenuProps {
  archiveHref: string;
  onSupportClick: () => void;
}

export function MobileNavMenu({ archiveHref, onSupportClick }: MobileNavMenuProps) {
  const [open, setOpen] = useState(false);
  const { currentTheme, toggle } = useTheme();

  const handleNavigation = () => {
    setOpen(false);
  };

  const handleSupportClick = () => {
    setOpen(false);
    onSupportClick();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <NavbarButton
          title="Open menu"
          aria-label="Open navigation menu"
          overlayColor="primary"
          className="flex sm:hidden"
        >
          <Menu className="h-5 w-5" />
        </NavbarButton>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/50",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />

        {/* Slide-in panel from right */}
        <DialogPrimitive.Content
          className={cn(
            "bg-background fixed top-0 right-0 z-50 h-full w-72 border-l shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            "duration-200",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b p-4">
            <span className="text-muted-foreground text-sm font-medium">Menu</span>
            <DialogPrimitive.Close className="text-muted-foreground hover:text-foreground rounded-sm p-1 transition-colors">
              <X className="h-5 w-5" />
              <span className="sr-only">Close menu</span>
            </DialogPrimitive.Close>
          </div>

          {/* Menu items */}
          <nav className="flex flex-col gap-1 p-4">
            {/* Archive */}
            <Link
              href={archiveHref}
              onClick={handleNavigation}
              className="hover:bg-muted flex items-center gap-3 rounded-sm px-3 py-3 transition-colors"
            >
              <Archive className="text-muted-foreground h-5 w-5" />
              <span className="text-foreground">Archive</span>
            </Link>

            {/* Support */}
            <button
              type="button"
              onClick={handleSupportClick}
              className="hover:bg-muted flex w-full items-center gap-3 rounded-sm px-3 py-3 text-left transition-colors"
            >
              <Heart className="text-muted-foreground h-5 w-5" />
              <span className="text-foreground">Support Chrondle</span>
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggle}
              className="hover:bg-muted flex w-full items-center gap-3 rounded-sm px-3 py-3 text-left transition-colors"
            >
              {currentTheme === "dark" ? (
                <Sun className="text-muted-foreground h-5 w-5" />
              ) : (
                <Moon className="text-muted-foreground h-5 w-5" />
              )}
              <span className="text-foreground">
                {currentTheme === "dark" ? "Light mode" : "Dark mode"}
              </span>
            </button>

            {/* Divider */}
            <div className="bg-border my-2 h-px" />

            {/* Auth */}
            <SignedOut>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-sm px-4 py-3 font-medium transition-colors"
                >
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <div className="flex items-center gap-3 px-3 py-2">
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "h-8 w-8",
                    },
                  }}
                />
                <span className="text-muted-foreground text-sm">Your profile</span>
              </div>
            </SignedIn>
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
