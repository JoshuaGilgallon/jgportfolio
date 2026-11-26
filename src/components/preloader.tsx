"use client";

import type { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { pageUrl, parentOf, PHONE } from "@/lib/pages";

/** How many pages to fetch ahead from one screen, so a long list isn't fetched at once. */
const PER_LOOK = 6;

/**
 * Has pages ready before they're tapped, on phones. next/link on its own only
 * fetches each route's empty shell ahead of time; this fetches whole pages,
 * guided by what the reader is doing:
 *
 * 1. A finger landing on a link fetches that page at once, ahead of the click.
 * 2. Once a page has settled, so does the page its back link leads to.
 * 3. So do the links on screen, again each time scrolling comes to rest.
 *
 * On Data Saver or a 2G connection only the first applies. Asking again is
 * cheap: the router keeps what it has fetched until it goes stale, and only
 * then goes back to the server.
 */
export function Preloader() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const phone = matchMedia(PHONE);
    const connection = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const frugal = () => !!connection && (!!connection.saveData || !!connection.effectiveType?.includes("2g"));

    const load = (path: string) => {
      // The whole page, as <Link prefetch> would.
      if (path !== location.pathname) router.prefetch(path, { kind: "full" as PrefetchKind });
    };

    const look = () => {
      if (!phone.matches || frugal() || document.hidden) return;
      const wanted = new Set<string>();
      for (const link of document.querySelectorAll("a")) {
        if (wanted.size === PER_LOOK) break;
        const url = pageUrl(link);
        if (!url || url.pathname === location.pathname) continue;
        const rect = link.getBoundingClientRect();
        // Hidden pages kept by the router measure as nothing.
        if (rect.height === 0 || rect.bottom < 0 || rect.top > innerHeight) continue;
        wanted.add(url.pathname);
      }
      wanted.add(parentOf(location.pathname));
      wanted.forEach(load);
    };

    // Waits for a lull, so fetching never competes with scrolling or a slide.
    let timer = 0;
    let idle = 0;
    const later = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        if ("requestIdleCallback" in window) idle = requestIdleCallback(look, { timeout: 1000 });
        else look();
      }, 600);
    };

    const onTouch = (e: Event) => {
      if (!phone.matches) return;
      const link = e.target instanceof Element ? e.target.closest("a") : null;
      const url = link && pageUrl(link);
      if (url) load(url.pathname);
    };

    later();
    addEventListener("pointerdown", onTouch, { passive: true, capture: true });
    addEventListener("scroll", later, { passive: true });
    document.addEventListener("visibilitychange", later);
    return () => {
      clearTimeout(timer);
      if (idle) cancelIdleCallback(idle);
      removeEventListener("pointerdown", onTouch, true);
      removeEventListener("scroll", later);
      document.removeEventListener("visibilitychange", later);
    };
  }, [router, pathname]);

  return null;
}
