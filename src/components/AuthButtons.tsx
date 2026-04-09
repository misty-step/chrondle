"use client";

import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { NavbarButton } from "@/components/ui/NavbarButton";
import { SignIn } from "@phosphor-icons/react";
import { AuthSkeleton } from "@/components/skeletons/AuthSkeleton";
import { isMobileDevice } from "@/lib/platformDetection";
import { useClientSnapshot } from "@/hooks/useClientSnapshot";

interface AuthButtonsProps {
  className?: string;
}

export function AuthButtons({ className }: AuthButtonsProps) {
  const { isLoaded, isSignedIn } = useUser();
  const isMobile = useClientSnapshot(isMobileDevice, () => false);

  // Show skeleton while auth is loading to prevent flash
  if (!isLoaded) {
    return (
      <div className={className}>
        <AuthSkeleton />
      </div>
    );
  }

  // User is signed in - show user button
  if (isSignedIn) {
    return (
      <div className={`flex h-10 w-10 items-center justify-center ${className ?? ""}`}>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
              userButtonPopoverCard: "shadow-lg",
              userButtonTrigger: "focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-full",
            },
          }}
        />
      </div>
    );
  }

  // Show sign in button with conditional mode based on device
  return (
    <SignInButton mode={isMobile ? "redirect" : "modal"}>
      <NavbarButton
        as="div"
        title="Sign in to save progress across devices"
        aria-label="Sign in to your account"
        overlayColor="primary"
        className={className}
      >
        <SignIn className="h-5 w-5" />
      </NavbarButton>
    </SignInButton>
  );
}
