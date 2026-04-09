import { MetadataRoute } from "next";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { logger } from "@/lib/logger";

const BASE_URL = "https://chrondle.app";
const serverApi = anyApi as any;

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
      url: `${BASE_URL}/groups`,
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
      url: `${BASE_URL}/archive/groups`,
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
    const [{ count: classicCount }, orderArchive, groupsArchive] = await Promise.all([
      client.query(serverApi.puzzles.getTotalPuzzles),
      client.query(serverApi.orderPuzzles.getArchiveOrderPuzzles, {
        page: 1,
        pageSize: 1,
      }),
      client.query(serverApi.groupsPuzzles.getArchiveGroupsPuzzles, {
        page: 1,
        pageSize: 1,
      }),
    ]);

    const classicRoutes = Array.from({ length: classicCount }, (_, i) => i + 1).map(
      (puzzleNumber) => ({
        url: `${BASE_URL}/archive/puzzle/${puzzleNumber}`,
        changeFrequency: "never" as const,
        priority: 0.6,
      }),
    );

    const orderRoutes = Array.from({ length: orderArchive.totalCount }, (_, i) => i + 1).map(
      (puzzleNumber) => ({
        url: `${BASE_URL}/archive/order/${puzzleNumber}`,
        changeFrequency: "never" as const,
        priority: 0.6,
      }),
    );

    const groupsRoutes = Array.from({ length: groupsArchive.totalCount }, (_, i) => i + 1).map(
      (puzzleNumber) => ({
        url: `${BASE_URL}/archive/groups/${puzzleNumber}`,
        changeFrequency: "never" as const,
        priority: 0.6,
      }),
    );

    return [...classicRoutes, ...orderRoutes, ...groupsRoutes];
  } catch (error) {
    logger.error("Failed to fetch puzzle count for sitemap:", error);
    return [];
  }
}
