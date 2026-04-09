import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useUserCreation } from "@/components/UserCreationProvider";
import { anyPublicApi } from "@/lib/convexAnyApi";

export function useUserData() {
  const { isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { isUserReady, userCreationLoading, currentUser } = useUserCreation();

  // Only fetch user stats when user is ready (signed in + user record exists + not creating)
  const userStats = useQuery(
    anyPublicApi.users.getUserStats,
    isUserReady && currentUser ? {} : undefined,
  );

  // Comprehensive loading state that accounts for:
  // 1. Clerk authentication loading
  // 2. User creation in progress
  // 3. User stats query loading (when user is ready)
  const isLoading =
    !clerkLoaded ||
    userCreationLoading ||
    (isSignedIn && !currentUser) || // Waiting for user record
    (isUserReady && userStats === undefined); // User ready but stats loading

  return {
    isLoading,
    isSignedIn,
    userStats,
    isPremium: false, // Premium feature removed
    subscriptionEnd: undefined,
    // Additional state for debugging user creation issues
    userCreationLoading,
    isUserReady,
  };
}
