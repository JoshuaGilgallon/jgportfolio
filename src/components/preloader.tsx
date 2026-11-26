"use client";

import type { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { pageUrl, parentOf, PHONE } from "@/lib/pages";

// max prefetches per screen
const PER_LOOK = 6;

// prefetches full pages on phones: on touch, the back link, then visible links.
// touch only on slow or data saver connections
export function Preloader() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const phone = matchMedia(PHONE);
    const connection = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const frugal = () => !!connection && (!!connection.saveData || !!connection.effectiveType?.includes("2g"));

    const load = (path: string) => {
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
        // hidden pages measure as zero
        if (rect.height === 0 || rect.bottom < 0 || rect.top > innerHeight) continue;
        wanted.add(url.pathname);
      }
      wanted.add(parentOf(location.pathname));
      wanted.forEach(load);
    };

    // wait for idle
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
