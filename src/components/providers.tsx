"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { PostHogIdentify } from "@/components/providers/PostHogIdentify";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { SessionThemeProvider } from "@/components/SessionThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { UserCreationProvider } from "@/components/UserCreationProvider";
import { MigrationProvider } from "@/components/providers/MigrationProvider";
import { ToastProvider } from "@/hooks/use-toast";
import { validateEnvironment, getEnvErrorMessage, isProduction } from "@/lib/env";
import { initSentryClient } from "@/observability/sentry.client";

// Initialize Sentry at module scope (before React components render)
// This ensures Sentry is ready before any component can call captureClientException
initSentryClient();

// Validate environment variables using enhanced validation
const envValidation = validateEnvironment();
const missingEnvVars = envValidation.missingVars;

// Only initialize Convex client if we have the URL
const convex = process.env.NEXT_PUBLIC_CONVEX_URL
  ? new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL)
  : null;

// Component to display when environment variables are missing
function MissingEnvironmentVariables({ variables }: { variables: string[] }) {
  const isProd = isProduction();

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-destructive/10 border-destructive rounded-sm border-2 p-6">
          <h1 className="text-destructive mb-4 text-2xl font-bold">Configuration Error</h1>

          <p className="text-foreground mb-6">{getEnvErrorMessage(variables)}</p>

          {!isProd && (
            <>
              <div className="bg-background mb-6 rounded-sm p-4">
                <p className="mb-2 font-semibold">Missing variables:</p>
                <ul className="list-inside list-disc space-y-1">
                  {variables.map((varName) => (
                    <li key={varName} className="font-mono text-sm">
                      {varName}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <div>
                  <h2 className="mb-2 font-semibold">For Vercel deployments:</h2>
                  <ol className="text-muted-foreground list-inside list-decimal space-y-2 text-sm">
                    <li>Go to your Vercel dashboard</li>
                    <li>Navigate to Settings → Environment Variables</li>
                    <li>Add the missing variables for all environments</li>
                    <li>Trigger a new deployment</li>
                  </ol>
                </div>

                <div>
                  <h2 className="mb-2 font-semibold">For local development:</h2>
                  <ol className="text-muted-foreground list-inside list-decimal space-y-2 text-sm">
                    <li>
                      Copy <code className="bg-muted rounded px-1 py-0.5">.env.example</code> to{" "}
                      <code className="bg-muted rounded px-1 py-0.5">.env.local</code>
                    </li>
                    <li>Fill in the missing values</li>
                    <li>Restart your development server</li>
                  </ol>
                </div>
              </div>

              <div className="bg-muted mt-6 rounded-sm p-4">
                <p className="text-sm">
                  <strong>Note:</strong> Environment variables starting with{" "}
                  <code className="bg-background rounded px-1 py-0.5">NEXT_PUBLIC_</code> are
                  embedded at build time. You&apos;ll need to rebuild after adding them.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Show error UI if environment variables are missing
  if (missingEnvVars.length > 0) {
    return (
      <ErrorBoundary>
        <MissingEnvironmentVariables variables={missingEnvVars} />
      </ErrorBoundary>
    );
  }

  // TypeScript knows these are defined now due to the check above
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!;

  return (
    <ErrorBoundary>
      <ToastProvider>
        <MigrationProvider>
          <ClerkProvider publishableKey={clerkKey} dynamic>
            <PostHogIdentify />
            <ConvexProviderWithClerk client={convex!} useAuth={useAuth}>
              <UserCreationProvider>
                <SessionThemeProvider>{children}</SessionThemeProvider>
              </UserCreationProvider>
            </ConvexProviderWithClerk>
          </ClerkProvider>
        </MigrationProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
