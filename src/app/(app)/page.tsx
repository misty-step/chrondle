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
 * first-timers get the gallery pitch. A value-bearing `all` param (`/?all=1`)
 * forces the gallery, keeping the mode hub reachable — that's where the in-app
 * wordmark points. NOTE: the param must carry a value. Vercel edge query
 * normalization drops valueless params, so a bare `/?all` arrives here as
 * `undefined`, the redirect fires, and the wordmark becomes a production
 * dead-end (this shipped once — see chrondle-ux-mode-hub-escape-hatch).
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
