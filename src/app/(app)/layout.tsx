import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import { Toaster } from "@/components/ui/toaster";
import { siteMetadata, siteViewport } from "@/lib/site";
import "../globals.css";

export const viewport: Viewport = siteViewport;

export const metadata: Metadata = siteMetadata;

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PostHogProvider>
      <Providers>{children}</Providers>
      <Toaster />
    </PostHogProvider>
  );
}
