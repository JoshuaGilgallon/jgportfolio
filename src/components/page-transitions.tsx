"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { depthOf, pageUrl, PHONE } from "@/lib/pages";
import { interceptPopState } from "@/lib/popstate";

/** If the next page hasn't rendered by now, show it without a slide rather than hold a frozen screen. */
const MAX_WAIT = 700;

type Waiting = { path: string; arrive?: () => void; done: () => void };

const keyOf = (url: { pathname: string; hash: string }) => url.pathname + url.hash;

/**
 * Page changes on phones, as in an iOS or One UI app: going deeper, the new
 * page slides in from the right over the old one; going back, the top page
 * slides away to uncover the one beneath. Desktop is left alone.
 *
 * It uses the browser's View Transitions: the old and new screens become two
 * snapshots that the compositor moves (globals.css, "Page slides"), so nothing
 * is laid out or painted while they move, however busy the page is.
 *
 * - Links: the click is taken over before next/link sees it, so the old screen
 *   can be captured before the router renders the new one.
 * - Back and forward: the popstate event is held back for the same reason,
 *   then replayed to the router. Where the browser has already animated the
 *   change itself (an iOS edge swipe), nothing more is played.
 * - Scroll: going back returns to where you were, so restoration is ours on
 *   phones; the browser's would move the old screen before it's captured.
 */
export function PageTransitions() {
  const router = useRouter();
  const pathname = usePathname();
  const waiting = useRef<Waiting | null>(null);
  /** The URL on screen, which `location` runs ahead of during a traversal. */
  const shown = useRef("");

  // The router has rendered the page a transition is waiting for.
  useLayoutEffect(() => {
    shown.current = pathname + location.hash;
    const next = waiting.current;
    if (!next || next.path !== pathname) return;
    waiting.current = null;
    // A task later, so the router's own scrolling and effects have run.
    setTimeout(() => {
      next.arrive?.();
      next.done();
    });
  }, [pathname]);

  useEffect(() => {
    if (!("startViewTransition" in document)) return;

    const phone = matchMedia(PHONE);
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    /** Scroll position of each URL (for Back and Forward), and of each page (for back links). */
    const entries = new Map<string, number>();
    const pages = new Map<string, number>();
    const remember = (key: string, leaving: boolean) => {
      entries.set(key, scrollY);
      if (leaving) pages.set(key.split("#")[0], scrollY);
    };
    /** Projects opened in the pane over the home page; the pane animates those itself. */
    const panes = new Set<string>();
    const replayed = new WeakSet<Event>();
    let active: ViewTransition | null = null;
    /** Counts navigations, so one that's overtaken while waiting its turn is dropped. */
    let latest = 0;

    const restoration = () => {
      history.scrollRestoration = phone.matches ? "manual" : "auto";
    };
    // A reload should still come back to the same spot.
    const release = () => {
      history.scrollRestoration = "auto";
    };

    /** Captures the screen, lets `update` change the page, then slides between the two. */
    const slide = (from: string, path: string, update: () => void, arrive?: () => void) => {
      const turn = latest;
      const root = document.documentElement;
      root.dataset.nav = depthOf(path) < depthOf(from) ? "pop" : "push";
      // The home page's bar isn't sticky, so there it moves with its page.
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
            // Registered first: the page may render synchronously.
            waiting.current = { path, arrive, done };
            update();
          }),
      );
      active = transition;
      // Skipping (a second tap, a hidden tab) is expected, not an error.
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
        shown.current = keyOf(url); // an in-page jump
        return;
      }
      if (still.matches) return;

      e.preventDefault(); // next/link leaves prevented clicks alone
      // A back link returns you to your place; the bar's links start at the top.
      const back = depthOf(url.pathname) < depthOf(location.pathname);
      const saved = back && link.closest("main") ? pages.get(url.pathname) : 0;
      slide(
        location.pathname,
        url.pathname,
        // With a #target the router scrolls to it; otherwise we place the page.
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

      // Opening or closing the project pane: the page underneath stays put.
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

      e.stopImmediatePropagation(); // the router hears it once the screen is captured
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
    // Capture on window: ahead of React's click handlers.
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
