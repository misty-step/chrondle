/**
 * LoadingScreen - Centralized loading/error state component
 *
 * Replaces duplicate `renderShell` functions across the codebase.
 * Uses semantic tokens for theme-adaptive rendering.
 */

interface LoadingScreenProps {
  message: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center">
      <p className="text-foreground text-base">{message}</p>
    </main>
  );
}
