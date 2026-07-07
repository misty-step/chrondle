import type { Metadata, Viewport } from "next";

/**
 * Single source of truth for site-wide identity and metadata.
 * Layouts import from here instead of redefining metadata inline.
 */
export const siteConfig = {
  name: "Chrondle",
  title: "Chrondle - The Daily History Game",
  description: "Guess the year of the historical event in this daily puzzle game.",
  url: "https://chrondle.app",
} as const;

export const siteViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

export const siteMetadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  manifest: "/site.webmanifest",
  metadataBase: new URL(siteConfig.url),
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteConfig.name,
  },
  openGraph: {
    url: siteConfig.url,
    siteName: siteConfig.name,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
};
