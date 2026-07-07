import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { GamesGallery } from "@/components/GamesGallery";
import { MODE_COOKIE, resolveHomeRedirect } from "@/lib/modePreference";

interface HomepageProps {
  searchParams: Promise<{ all?: string | string[] }>;
}

/**
 * Home is a first-touch surface: returning visitors (mode-preference cookie)
 * are sent straight to their preferred mode — zero extra taps — while
 * first-timers get the gallery pitch. `/?all` always shows the gallery
 * (that's where the in-app wordmark points), so the mode hub stays reachable.
 */
export default async function Homepage({ searchParams }: HomepageProps) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);

  const destination = resolveHomeRedirect(
    cookieStore.get(MODE_COOKIE)?.value,
    params.all !== undefined,
  );

  if (destination) {
    redirect(destination);
  }

  return <GamesGallery />;
}
