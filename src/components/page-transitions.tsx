"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { depthOf, pageUrl, PHONE } from "@/lib/pages";
import { interceptPopState } from "@/lib/popstate";

// give up on the slide if rendering takes too long
const MAX_WAIT = 700;

type Waiting = { path: string; arrive?: () => void; done: () => void };

const keyOf = (url: { pathname: string; hash: string }) => url.pathname + url.hash;

// slide transitions on phones using view transitions.
// clicks and popstate are held back so the old screen gets captured first
export function PageTransitions() {
  const router = useRouter();
  const pathname = usePathname();
  const waiting = useRef<Waiting | null>(null);
  // current url, location updates early on back/forward
  const shown = useRef("");

  // next page has rendered
  useLayoutEffect(() => {
    shown.current = pathname + location.hash;
    const next = waiting.current;
    if (!next || next.path !== pathname) return;
    waiting.current = null;
    // wait a task for router scroll and effects
    setTimeout(() => {
      next.arrive?.();
      next.done();
    });
  }, [pathname]);

  useEffect(() => {
    if (!("startViewTransition" in document)) return;

    const phone = matchMedia(PHONE);
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    const entries = new Map<string, number>();
    const pages = new Map<string, number>();
    const remember = (key: string, leaving: boolean) => {
      entries.set(key, scrollY);
      if (leaving) pages.set(key.split("#")[0], scrollY);
    };
    // these are animated by the modal
    const panes = new Set<string>();
    const replayed = new WeakSet<Event>();
    let active: ViewTransition | null = null;
    // drops overtaken navigations
    let latest = 0;

    const restoration = () => {
      history.scrollRestoration = phone.matches ? "manual" : "auto";
    };
    // restore position on reload
    const release = () => {
      history.scrollRestoration = "auto";
    };

    const slide = (from: string, path: string, update: () => void, arrive?: () => void) => {
      const turn = latest;
      const root = document.documentElement;
      root.dataset.nav = depthOf(path) < depthOf(from) ? "pop" : "push";
      // this nav scrolls with its page
      root.dataset.bar = from === "/" || path === "/" ? "slides" : "stays";
      const transition = document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            if (turn !== latest) {
              transition.skipTransition();
              return resolve();
            }
            waiting.current?.done();
            const timer = setTimeout(() => {
              transition.skipTransition();
              done();
            }, MAX_WAIT);
            const done = () => {
              clearTimeout(timer);
              resolve();
            };
            // register first, rendering can be synchronous
            waiting.current = { path, arrive, done };
            update();
          }),
      );
      active = transition;
      // skipping is expected
      transition.ready.catch(() => {});
      transition.finished.finally(() => {
        if (active !== transition) return;
        delete root.dataset.nav;
        delete root.dataset.bar;
      });
    };

    const onClick = (e: MouseEvent) => {
      if (!phone.matches || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest("a") : null;
      const url = link && pageUrl(link);
      if (!link || !url) return;
      if (link.hasAttribute("data-morph-source")) {
        panes.add(url.pathname);
        return;
      }
      if (link.closest("dialog")) return;
      latest++;

      const samePage = url.pathname === location.pathname;
      remember(shown.current, !samePage);
      if (samePage) {
        shown.current = keyOf(url); // in page jump
        return;
      }
      if (still.matches) return;

      e.preventDefault(); // next/link ignores prevented clicks
      // back links restore scroll
      const back = depthOf(url.pathname) < depthOf(location.pathname);
      const saved = back && link.closest("main") ? pages.get(url.pathname) : 0;
      slide(
        location.pathname,
        url.pathname,
        // the router handles #targets
        () => router.push(url.pathname + url.search + url.hash, { scroll: !!url.hash }),
        url.hash ? undefined : () => scrollTo(0, saved ?? 0),
      );
    };

    const onPopState = (e: PopStateEvent) => {
      if (replayed.has(e) || !phone.matches) return;
      const from = shown.current;
      const to = keyOf(location);
      const fromPath = from.split("#")[0];
      const path = location.pathname;
      latest++;
      shown.current = to;

      // modal open/close, don't move the page
      if ((fromPath === "/" && panes.has(path)) || (path === "/" && panes.has(fromPath))) return;

      remember(from, path !== fromPath);
      const arrive = () => {
        const saved = entries.get(to);
        const target = location.hash && document.getElementById(location.hash.slice(1));
        if (saved === undefined && target) target.scrollIntoView();
        else scrollTo(0, saved ?? 0);
      };

      if (path === fromPath) {
        requestAnimationFrame(arrive);
        return;
      }
      if (still.matches || e.hasUAVisualTransition) {
        waiting.current?.done();
        waiting.current = { path, arrive, done: () => {} };
        return;
      }

      e.stopImmediatePropagation(); // replayed once captured
      slide(
        fromPath,
        path,
        () => {
          const replay = new PopStateEvent("popstate", { state: e.state });
          replayed.add(replay);
          dispatchEvent(replay);
        },
        arrive,
      );
    };

    restoration();
    phone.addEventListener("change", restoration);
    addEventListener("pagehide", release);
    addEventListener("pageshow", restoration);
    // capture so this runs before react
    addEventListener("click", onClick, true);
    const stopIntercepting = interceptPopState(onPopState);
    return () => {
      phone.removeEventListener("change", restoration);
      removeEventListener("pagehide", release);
      removeEventListener("pageshow", restoration);
      removeEventListener("click", onClick, true);
      stopIntercepting();
      release();
    };
  }, [router]);

  return null;
}
