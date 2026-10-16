import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { readFileSync } from "fs";
import { parseChangelog } from "./src/lib/releases/changelog";

// Embed public notes in the bundle: Workers cannot read repository files at runtime.
const changelog = readFileSync("CHANGELOG.md", "utf8");
const appVersion = parseChangelog(changelog)[0].version;
const artifactBuildOnly = process.env.DAGGER_ARTIFACT_BUILD === "1";
// Existing project's public ingest address, not an API/deploy credential.
const sentryDsn =
  "https://dceed70dd694ac7d6b2ee24323e7c920@o4510313803677696.ingest.us.sentry.io/4510762044751872";
const convexOrigin = resolveExternalOrigin(process.env.NEXT_PUBLIC_CONVEX_URL, "");
const convexConnectSrc = convexOrigin
  ? `${convexOrigin} ${convexOrigin.replace(/^https:/, "wss:").replace(/^http:/, "ws:")}`
  : "";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false, // Prevent automatic browser opening
});

const nextConfig: NextConfig = {
  output: "standalone",
  generateBuildId: async () => process.env.CHRONDLE_REVISION || null,
  // Expose version to client
  env: {
    CHRONDLE_CHANGELOG: changelog,
    NEXT_PUBLIC_APP_VERSION: appVersion,
    CHRONDLE_REVISION: process.env.CHRONDLE_REVISION || "development",
    NEXT_PUBLIC_SENTRY_DSN: sentryDsn,
  },
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },

  // Cache configuration for better development experience
  ...(process.env.NODE_ENV === "development" && {
    webpack: (config, { dev }) => {
      if (dev) {
        // More aggressive cache invalidation in development
        config.cache = {
          type: "filesystem",
          maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days max
          compression: false, // Faster builds
        };
      }
      return config;
    },
  }),

  // PostHog proxy moved to Route Handler (src/app/(app)/ingest/[...path]/route.ts)
  // This ensures auth cookies are stripped before forwarding to PostHog

  // Security headers configuration
  async headers() {
    return [
      {
        source: "/deployment.json",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: [
          // Prevent clickjacking attacks
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Prevent MIME type sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Enable XSS protection
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // Prevent embedding in iframes
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://healthy-doe-23.clerk.accounts.dev https://clerk.chrondle.app", // Required for Next.js and Clerk
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Required for Tailwind CSS and Google Fonts
              "img-src 'self' data: blob: https://img.clerk.com https://www.gravatar.com", // Clerk avatar CDN and Gravatar fallback
              "font-src 'self' data: https://fonts.gstatic.com", // Required for Google Fonts
              "worker-src 'self' blob:", // Required for Clerk and canvas-confetti web workers
              `connect-src 'self' ${convexConnectSrc} ${new URL(sentryDsn).origin} https://openrouter.ai https://query.wikidata.org https://api.wikimedia.org https://healthy-doe-23.clerk.accounts.dev https://clerk.chrondle.app https://clerk-telemetry.com`, // Exact backend, Sentry and Clerk origins; PostHog uses /ingest (self)
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          // Enforce HTTPS in production
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // Control referrer information
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Control browser features and APIs
          {
            key: "Permissions-Policy",
            value: ["camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()"].join(
              ", ",
            ),
          },
        ],
      },
    ];
  },

  // Image configuration for Clerk avatars
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "www.gravatar.com" },
    ],
  },

  // Dagger runs type-check as a separate gate, so the artifact build can skip
  // Next.js' duplicate type validation pass to stay within container limits.
  ...(artifactBuildOnly && {
    typescript: {
      ignoreBuildErrors: true,
    },
  }),

  productionBrowserSourceMaps: false,
};

export default withBundleAnalyzer(nextConfig);

function resolveExternalOrigin(rawValue: string | undefined, fallback: string): string {
  const value = rawValue?.trim() || fallback;

  try {
    return new URL(value).origin;
  } catch {
    return fallback ? new URL(fallback).origin : "";
  }
}
