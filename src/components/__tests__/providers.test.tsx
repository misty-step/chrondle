import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({
    children,
    publishableKey,
  }: {
    children: React.ReactNode;
    publishableKey: string;
  }) => (
    <div data-testid="clerk-provider" data-publishable-key={publishableKey}>
      {children}
    </div>
  ),
  useAuth: () => ({ isSignedIn: false }),
}));

vi.mock("convex/react", () => ({
  ConvexReactClient: class MockConvexReactClient {
    constructor(_url: string) {}
  },
}));

vi.mock("convex/react-clerk", () => ({
  ConvexProviderWithClerk: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="convex-provider">{children}</div>
  ),
}));

vi.mock("@/components/SessionThemeProvider", () => ({
  SessionThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/UserCreationProvider", () => ({
  UserCreationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/providers/MigrationProvider", () => ({
  MigrationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/use-toast", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/observability/sentry.client", () => ({
  initSentryClient: vi.fn(),
}));

const ORIGINAL_CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const ORIGINAL_CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

async function loadProviders() {
  vi.resetModules();
  return await import("@/components/providers");
}

describe("Providers", () => {
  afterEach(() => {
    cleanup();

    if (ORIGINAL_CONVEX_URL === undefined) {
      delete process.env.NEXT_PUBLIC_CONVEX_URL;
    } else {
      process.env.NEXT_PUBLIC_CONVEX_URL = ORIGINAL_CONVEX_URL;
    }

    if (ORIGINAL_CLERK_KEY === undefined) {
      delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    } else {
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = ORIGINAL_CLERK_KEY;
    }
  });

  it("renders configuration error when required public env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    const { Providers } = await loadProviders();

    render(
      <Providers>
        <div>app-shell</div>
      </Providers>,
    );

    expect(screen.getByText("Configuration Error")).toBeInTheDocument();
    expect(screen.getByText("NEXT_PUBLIC_CONVEX_URL")).toBeInTheDocument();
    expect(screen.getByText("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")).toBeInTheDocument();
    expect(screen.queryByText("app-shell")).not.toBeInTheDocument();
  });

  it("renders the application tree when required public env vars exist", async () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_example";

    const { Providers } = await loadProviders();

    render(
      <Providers>
        <div>app-shell</div>
      </Providers>,
    );

    expect(screen.getByTestId("clerk-provider")).toHaveAttribute(
      "data-publishable-key",
      "pk_test_example",
    );
    expect(screen.getByTestId("convex-provider")).toBeInTheDocument();
    expect(screen.getByText("app-shell")).toBeInTheDocument();
  });

  it("reads env vars at render time instead of import time", async () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_example";

    const { Providers } = await loadProviders();

    const { rerender } = render(
      <Providers>
        <div>app-shell</div>
      </Providers>,
    );

    expect(screen.getByText("app-shell")).toBeInTheDocument();

    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    rerender(
      <Providers>
        <div>app-shell</div>
      </Providers>,
    );

    expect(screen.getByText("Configuration Error")).toBeInTheDocument();
    expect(screen.queryByText("app-shell")).not.toBeInTheDocument();
  });

  it("treats blank public env vars as missing configuration", async () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "   ";
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "\n";

    const { Providers } = await loadProviders();

    render(
      <Providers>
        <div>app-shell</div>
      </Providers>,
    );

    expect(screen.getByText("Configuration Error")).toBeInTheDocument();
    expect(screen.getByText("NEXT_PUBLIC_CONVEX_URL")).toBeInTheDocument();
    expect(screen.getByText("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")).toBeInTheDocument();
    expect(screen.queryByText("app-shell")).not.toBeInTheDocument();
  });
});
