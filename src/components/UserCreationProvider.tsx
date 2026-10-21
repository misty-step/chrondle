"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useMemo,
  ReactNode,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useConvex } from "convex/react";
import { useMutationWithRetry } from "@/hooks/useMutationWithRetry";
import { Doc } from "../../convex/_generated/dataModel";
import { anyPublicApi } from "@/lib/convexAnyApi";
import { reconcileLocalGameStates } from "@/lib/gameDataStore";
import { assertConvexId } from "@/lib/validation";
import { z } from "zod";
import { rangeGuessSchema } from "@/lib/secureStorage";
import { logger } from "@/lib/logger";

// Auth state machine states
type AuthState =
  | "INIT" // Initial state
  | "CLERK_LOADING" // Waiting for Clerk auth
  | "AUTHENTICATED" // User signed in, checking Convex user
  | "CREATING_USER" // Creating Convex user
  | "READY" // User exists and ready
  | "ERROR"; // Error occurred

// State machine state type
interface StateMachineState {
  state: AuthState;
  userCreated: boolean;
  userCreationError: string | null;
  currentUser: Doc<"users"> | null | undefined;
}

// State machine actions
type StateMachineAction =
  | { type: "CLERK_LOADING" }
  | { type: "AUTHENTICATED"; currentUser: Doc<"users"> | null | undefined }
  | { type: "START_USER_CREATION" }
  | { type: "USER_CREATION_SUCCESS"; user: Doc<"users"> }
  | { type: "USER_CREATION_ERROR"; error: string }
  | { type: "USER_READY"; user: Doc<"users"> }
  | { type: "SIGN_OUT" }
  | { type: "RESET" };

// State machine reducer
function authStateReducer(state: StateMachineState, action: StateMachineAction): StateMachineState {
  // Log state transitions in development

  switch (action.type) {
    case "CLERK_LOADING":
      return {
        ...state,
        state: "CLERK_LOADING",
        userCreated: false,
        userCreationError: null,
      };

    case "AUTHENTICATED":
      // If user exists, go directly to READY, otherwise stay in AUTHENTICATED
      if (action.currentUser) {
        return {
          ...state,
          state: "READY",
          currentUser: action.currentUser,
          userCreated: true,
          userCreationError: null,
        };
      }
      return {
        ...state,
        state: "AUTHENTICATED",
        currentUser: action.currentUser,
        userCreationError: null,
      };

    case "START_USER_CREATION":
      // Only transition if we're in AUTHENTICATED state
      if (state.state !== "AUTHENTICATED") {
        return state;
      }
      return {
        ...state,
        state: "CREATING_USER",
        userCreationError: null,
      };

    case "USER_CREATION_SUCCESS":
      return {
        ...state,
        state: "READY",
        userCreated: true,
        currentUser: action.user,
        userCreationError: null,
      };

    case "USER_CREATION_ERROR":
      return {
        ...state,
        state: "ERROR",
        userCreationError: action.error,
      };

    case "USER_READY":
      return {
        ...state,
        state: "READY",
        currentUser: action.user,
        userCreated: true,
        userCreationError: null,
      };

    case "SIGN_OUT":
    case "RESET":
      return {
        state: "INIT",
        userCreated: false,
        userCreationError: null,
        currentUser: null,
      };

    default:
      return state;
  }
}

// Initial state
const initialState: StateMachineState = {
  state: "INIT",
  userCreated: false,
  userCreationError: null,
  currentUser: null,
};

interface UserCreationContextType {
  userCreated: boolean;
  userCreationLoading: boolean;
  userCreationError: string | null;
  currentUser: Doc<"users"> | null | undefined; // User from Convex query
  isUserReady: boolean; // True when user exists and creation is complete
}

const UserCreationContext = createContext<UserCreationContextType | undefined>(undefined);

export function useUserCreation() {
  const context = useContext(UserCreationContext);

  // During SSR/prerendering or when context is not yet available,
  // return a safe default state instead of throwing
  if (typeof window === "undefined" || context === undefined) {
    return {
      userCreated: false,
      userCreationLoading: false,
      userCreationError: null,
      currentUser: null,
      isUserReady: false,
    };
  }

  return context;
}

interface UserCreationProviderProps {
  children: ReactNode;
}

export function UserCreationProvider({ children }: UserCreationProviderProps) {
  const { isSignedIn } = useAuth();

  // Use state machine for managing auth state
  const [machineState, dispatch] = useReducer(authStateReducer, initialState);

  // Get current user for existence check
  const currentUserFromQuery = useQuery(anyPublicApi.users.getCurrentUser) as
    Doc<"users"> | null | undefined;

  // JIT user creation mutation with retry logic for transient errors
  const getOrCreateUser = useMutationWithRetry(anyPublicApi.users.getOrCreateCurrentUser, {
    maxRetries: 3,
    baseDelayMs: 1000,
    onRetry: (attempt, error) => {
      logger.error(
        `[UserCreationProvider] Retrying user creation (attempt ${attempt}/3):`,
        error.message,
      );
    },
  });

  // Anonymous state migration mutation
  const mergeAnonymousState = useMutationWithRetry(
    anyPublicApi.users.mergeAnonymousState,
    useMemo(
      () => ({
        maxRetries: 2,
        baseDelayMs: 500,
        onRetry: (attempt: number, error: Error) => {
          logger.warn(
            `[UserCreationProvider] Retrying anonymous state migration (attempt ${attempt}/2):`,
            error.message,
          );
        },
      }),
      [],
    ),
  );

  // Effect 1: Monitor auth state changes (Clerk loading and authentication)
  useEffect(() => {
    if (isSignedIn === undefined) {
      // Clerk is still loading
      dispatch({ type: "CLERK_LOADING" });
    } else if (isSignedIn) {
      // User is signed in, check if Convex user exists
      dispatch({ type: "AUTHENTICATED", currentUser: currentUserFromQuery });
    } else {
      // User is signed out
      dispatch({ type: "SIGN_OUT" });
    }
  }, [isSignedIn, currentUserFromQuery]);

  // Effect 2: Trigger user creation when needed (separate from monitoring)
  useEffect(() => {
    async function createUserIfNeeded() {
      // Only create user if:
      // 1. We're in AUTHENTICATED state
      // 2. Query has completed (currentUserFromQuery is not undefined)
      // 3. No user exists (!currentUserFromQuery)
      const needsUserCreation =
        machineState.state === "AUTHENTICATED" &&
        currentUserFromQuery !== undefined &&
        !currentUserFromQuery;

      if (needsUserCreation) {
        dispatch({ type: "START_USER_CREATION" });

        try {
          const newUser = await getOrCreateUser({});

          if (newUser) {
            dispatch({ type: "USER_CREATION_SUCCESS", user: newUser });
          } else {
            // This shouldn't happen but handle gracefully
            dispatch({
              type: "USER_CREATION_ERROR",
              error: "User creation returned no user",
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error("[UserCreationProvider] User creation failed:", {
            error: errorMessage,
            timestamp: new Date().toISOString(),
          });

          dispatch({ type: "USER_CREATION_ERROR", error: errorMessage });
          // Don't block the app if user creation fails - graceful degradation
        }
      }
    }

    createUserIfNeeded();
  }, [machineState.state, currentUserFromQuery, getOrCreateUser]);

  const convex = useConvex();

  const reconciliationRunning = useRef(false);
  const reconciliationUserId = machineState.currentUser?._id;

  // Reconcile on every sign-in, including existing accounts and a previous failed attempt.
  useEffect(() => {
    if (machineState.state !== "READY" || reconciliationRunning.current) return;
    reconciliationRunning.current = true;
    void reconcileLocalGameStates(async (state) => {
      const result = await mergeAnonymousState({
        ...state,
        puzzleId: assertConvexId(state.puzzleId, "puzzles"),
      });
      if (result?.success !== true || !reconciliationUserId) return { success: false };
      const play = await convex.query(anyPublicApi.puzzles.getUserPlay, {
        userId: reconciliationUserId,
        puzzleId: assertConvexId(state.puzzleId, "puzzles"),
      });
      const parsed = z
        .object({
          guesses: z.array(z.number()).optional(),
          ranges: z.array(rangeGuessSchema).optional(),
        })
        .safeParse(play);
      const acknowledged =
        parsed.success &&
        state.guesses.every((guess) => parsed.data.guesses?.includes(guess)) &&
        state.ranges.every((range) =>
          parsed.data.ranges?.some(
            (saved) =>
              saved.start === range.start &&
              saved.end === range.end &&
              saved.hintsUsed === range.hintsUsed &&
              saved.score === range.score &&
              saved.timestamp === range.timestamp,
          ),
        );
      return { success: acknowledged };
    }).finally(() => {
      reconciliationRunning.current = false;
    });
  }, [machineState.state, reconciliationUserId, mergeAnonymousState, convex]);

  // Derive loading state from state machine
  const userCreationLoading = machineState.state === "CREATING_USER";

  // Determine if user is ready for operations
  const isUserReady = machineState.state === "READY";

  const contextValue: UserCreationContextType = {
    userCreated: machineState.userCreated,
    userCreationLoading,
    userCreationError: machineState.userCreationError,
    currentUser: machineState.currentUser || currentUserFromQuery,
    isUserReady,
  };

  return (
    <UserCreationContext.Provider value={contextValue}>{children}</UserCreationContext.Provider>
  );
}
