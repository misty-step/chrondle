import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false, // Prevent automatic browser opening
});

const nextConfig: NextConfig = {
  // Server Actions are enabled by default in Next.js 15
  // No experimental configuration needed

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

  // Security headers configuration
  async headers() {
    return [
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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://healthy-doe-23.clerk.accounts.dev https://clerk.chrondle.app https://va.vercel-scripts.com", // Required for Next.js, Clerk, and Vercel Analytics
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Required for Tailwind CSS and Google Fonts
              "img-src 'self' data: blob: https://img.clerk.com https://www.gravatar.com", // Clerk avatar CDN and Gravatar fallback
              "font-src 'self' data: https://fonts.gstatic.com", // Required for Google Fonts
              "worker-src 'self' blob:", // Required for Clerk and canvas-confetti web workers
              "connect-src 'self' wss://fleet-goldfish-183.convex.cloud https://fleet-goldfish-183.convex.cloud https://openrouter.ai https://query.wikidata.org https://api.wikimedia.org https://healthy-doe-23.clerk.accounts.dev https://clerk.chrondle.app https://clerk-telemetry.com https://vitals.vercel-insights.com https://vercel-insights.com", // Convex production URL and Vercel analytics
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

  // Enable source maps for Sentry
  productionBrowserSourceMaps: true,
};

export default withBundleAnalyzer(nextConfig);
