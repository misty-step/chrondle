import { MetadataRoute } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { logger } from "@/lib/logger";

const BASE_URL = "https://chrondle.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/classic`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/order`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/archive`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/archive/order`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/legal/privacy`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/terms`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // Fetch dynamic puzzle routes from Convex
  const puzzleRoutes = await fetchPuzzleRoutes();

  return [...staticRoutes, ...puzzleRoutes];
}

async function fetchPuzzleRoutes(): Promise<MetadataRoute.Sitemap> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    logger.warn("NEXT_PUBLIC_CONVEX_URL not set, skipping dynamic puzzle routes in sitemap");
    return [];
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const { count } = await client.query(api.puzzles.getTotalPuzzles);

    // Generate routes for all archive puzzles
    return Array.from({ length: count }, (_, i) => i + 1).flatMap((puzzleNumber) => [
      {
        url: `${BASE_URL}/archive/puzzle/${puzzleNumber}`,
        changeFrequency: "never" as const,
        priority: 0.6,
      },
      {
        url: `${BASE_URL}/archive/order/${puzzleNumber}`,
        changeFrequency: "never" as const,
        priority: 0.6,
      },
    ]);
  } catch (error) {
    logger.error("Failed to fetch puzzle count for sitemap:", error);
    return [];
  }
}
