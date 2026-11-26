"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LiquidMorph } from "@/lib/liquid-morph";
import { LiquidSurface } from "@/lib/liquid-surface";
import { frameOf, type Frame } from "@/lib/morph";
import { HapticTap } from "./haptic-tap";
import { ChevronRight } from "./icons";
import s from "./home-nav.module.css";

const HINT_SEEN = "nav-hint-seen";
const HINT_TIME = 5000;
const CONTENT_BLUR = 4;
// space above the sheet for overshoot and shadow
const SURFACE_HEADROOM = 160;
// keep in sync with --clear in the css
const CLEAR = 8;
// how far the veil runs past the page end
const OVERHANG = 200;

// marks the home page before first paint so the nav is never sticky on phones,
// otherwise ios safari keeps its status bar a solid colour
export function HomeMark() {
  return (
    <script
      // inert on the client to avoid a react warning
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: 'document.documentElement.dataset.home=""' }}
    />
  );
}

// floating button that morphs into a bottom sheet on phones
export function HomeNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [shown, setShown] = useState(false);
  const [hint, setHint] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const glyphRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sheet = useRef<{ open: () => void; close: (scrolling?: boolean) => void; reset: () => void } | null>(null);

  // unmarks when the route gets hidden
  useLayoutEffect(() => {
    document.documentElement.dataset.home = "";
    return () => {
      delete document.documentElement.dataset.home;
    };
  }, []);

  useEffect(() => {
    const bar = document.querySelector("[data-site-nav]");
    if (!bar) return;
    const observer = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting));
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shown) return;
    try {
      if (localStorage.getItem(HINT_SEEN)) return;
    } catch {}
    let hide = 0;
    const show = window.setTimeout(() => {
      try {
        localStorage.setItem(HINT_SEEN, "1");
      } catch {}
      setHint(true);
      hide = window.setTimeout(() => setHint(false), HINT_TIME);
    }, 350);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
      setHint(false);
    };
  }, [shown]);

  // other pages have a sticky nav
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>("[data-site-nav]");
    if (shown && bar) return releaseStatusBar(bar);
  }, [shown]);

  useEffect(() => {
    const button = buttonRef.current;
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    const content = contentRef.current;
    const ghost = ghostRef.current;
    const glyph = glyphRef.current;
    const canvas = canvasRef.current;
    if (!button || !dialog || !panel || !content || !ghost || !glyph || !canvas) return;

    const root = document.documentElement;
    const morph = new LiquidMorph();
    const squircles = CSS.supports("corner-shape", "superellipse(2)");
    // null without webgl2
    let surface: LiquidSurface | null | undefined;
    let frame = 0;
    let closing = false;
    let rest: Frame;
    let source: Frame;

    const setVeil = (v: number) => {
      dialog.style.setProperty("--veil", String(v));
    };

    let pageHeight = 0;
    const setVeilHeight = (px: number) => dialog.style.setProperty("--page-height", `${px}px`);
    // stretch the veil past the end of the page
    const cover = () => {
      dialog.style.removeProperty("--page-height"); // measure without it
      pageHeight = root.scrollHeight;
      setVeilHeight(pageHeight + OVERHANG);
    };
    // not while closing, could be mid scroll
    const recover = () => dialog.open && !closing && cover();
    addEventListener("resize", recover);

    const measure = () => {
      const styles = [panel.style.cssText, content.style.cssText];
      panel.style.cssText = content.style.cssText = "";
      const ps = getComputedStyle(panel);
      rest = frameOf(panel.getBoundingClientRect(), parseFloat(ps.getPropertyValue("--r")));
      const color = ps.backgroundColor;
      [panel.style.cssText, content.style.cssText] = styles;
      // use the layout box, ignores transforms
      const { width, right, bottom } = getComputedStyle(button);
      const size = parseFloat(width);
      source = {
        cx: root.clientWidth - parseFloat(right) - size / 2,
        cy: innerHeight - parseFloat(bottom) - size / 2,
        w: size,
        h: size,
        r: size / 2,
      };
      morph.setEnds(source, rest);

      if (surface === undefined) surface = LiquidSurface.create(canvas);
      if (surface?.lost) surface = null;
      if (surface) {
        // room for overshoot and shadow
        const top = Math.max(CLEAR, Math.min(rest.cy - rest.h / 2, source.cy - source.h / 2) - SURFACE_HEADROOM);
        surface.layout(0, top, root.clientWidth, innerHeight - CLEAR - top, color);
        dialog.dataset.surface = "";
      } else delete dialog.dataset.surface;
    };

    const blur = (px: number) => (px < 0.3 ? "none" : `blur(${px}px)`);
    // squircle exponent, q = progress from circle
    const corner = (r: number, f: Frame, q: number) =>
      squircles ? { r: Math.min(r * (1 + 0.53 * q), Math.min(f.w, f.h) / 2), k: 1 + 0.7 * q } : { r, k: 1 };

    const draw = () => {
      const b = morph.bodyFrame;
      const g = morph.ghostFrame;
      const c = corner(b.r, b, morph.cornerProgress);
      const p = morph.contentProgress;
      const pc = Math.min(1, Math.max(0, p));
      const lift = Math.min(1, Math.max(0, morph.progress));

      // both blobs as one surface
      surface?.draw(
        [
          { ...g, r: Math.min(g.w, g.h) / 2, k: 1 },
          { ...b, r: c.r, k: c.k },
        ],
        morph.gaussSigma,
        lift,
      );

      // body clips and fades in the menu
      panel.style.cssText =
        `position:fixed;left:0;top:0;margin:0;width:${b.w}px;height:${b.h}px;` +
        `transform:translate3d(${b.cx - b.w / 2}px,${b.cy - b.h / 2}px,0);--lift:${lift};` +
        `border-radius:${c.r}px;${squircles ? `corner-shape:superellipse(${c.k});` : ""}`;
      const s = Math.min(b.w / rest.w, b.h / rest.h);
      content.style.cssText =
        `position:absolute;left:0;top:0;width:${rest.w}px;height:${rest.h}px;` +
        `transform:translate3d(${(b.w - rest.w) / 2}px,${(b.h - rest.h) / 2}px,0) scale(${s});` +
        `opacity:${pc};filter:${blur(Math.hypot(CONTENT_BLUR * (1 - pc), morph.lensBlur))}`;
      // ghost carries the icon out
      ghost.style.cssText =
        `width:${g.w}px;height:${g.h}px;transform:translate3d(${g.cx - g.w / 2}px,${g.cy - g.h / 2}px,0)`;
      glyph.style.cssText =
        `left:${(g.w - source.w) / 2}px;top:${(g.h - source.h) / 2}px;width:${source.w}px;height:${source.h}px;` +
        `transform:scale(${Math.max(g.w / source.w, g.h / source.h)});` +
        `opacity:${1 - pc};filter:${blur(CONTENT_BLUR * pc)}`;
      setVeil(lift);
    };

    const settle = () => {
      panel.style.cssText = content.style.cssText = ghost.style.cssText = glyph.style.cssText = "";
      delete dialog.dataset.morphing;
      surface?.clear();
    };

    const finish = () => {
      cancelAnimationFrame(frame);
      closing = false;
      delete button.dataset.away; // before closing so focus can return
      if (dialog.open) dialog.close();
      settle();
      dialog.style.removeProperty("--veil");
      dialog.style.removeProperty("--page-height");
    };

    // hand over early, the springs take ages to fully settle
    const home = () => {
      const g = morph.ghostFrame;
      const b = morph.bodyFrame;
      const near = (a: number, b: number) => Math.abs(a - b) < 0.25;
      const inside = Math.hypot(b.cx - source.cx, b.cy - source.cy) + Math.max(b.w, b.h) / 2 <= source.w / 2;
      return near(g.cx, source.cx) && near(g.cy, source.cy) && near(g.w, source.w) && near(g.h, source.h) && inside && morph.contentProgress < 0.005;
    };

    const run = () => {
      cancelAnimationFrame(frame);
      dialog.dataset.morphing = "";
      draw();
      let last = 0;
      const tick = (now: number) => {
        const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
        last = now;
        morph.update(dt);
        if (!morph.animating || (closing && home())) return closing ? finish() : settle();
        draw();
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

    sheet.current = {
      reset: finish,
      open() {
        if (dialog.open) return;
        closing = false;
        setHint(false);
        setVeil(0);
        cover();
        dialog.showModal();
        // focus the sheet so no button gets a ring
        panel.focus({ preventScroll: true });
        button.dataset.away = "";
        if (still()) return setVeil(1);
        measure();
        morph.snap(false);
        morph.expand();
        run();
      },
      close(scrolling) {
        if (!dialog.open || closing) return;
        if (still()) return finish();
        closing = true;
        // don't scroll into the overhang
        if (scrolling) setVeilHeight(pageHeight);
        // remeasure in case the window changed
        if (!morph.animating) measure();
        morph.collapse();
        run();
      },
    };

    // don't leave an invisible modal behind
    return () => {
      sheet.current = null;
      removeEventListener("resize", recover);
      finish();
    };
  }, []);

  const go = (e: React.MouseEvent, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    sheet.current?.close(true);
    const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    document.getElementById(id)?.scrollIntoView({ behavior });
  };

  if (sections.length === 0) return null;

  return (
    <>
      <p className={s.hint} data-shown={hint || undefined}>
        Use this to navigate the site
      </p>
      <button
        ref={buttonRef}
        type="button"
        className={s.button}
        data-shown={shown || undefined}
        onClick={() => sheet.current?.open()}
        aria-label="Navigate"
        aria-haspopup="dialog"
      >
        <MenuGlyph />
        <HapticTap />
      </button>
      <dialog
        ref={dialogRef}
        data-home-nav=""
        className={s.dialog}
        aria-label="Navigate"
        onCancel={(e) => {
          e.preventDefault(); // morph closed on esc or android back
          sheet.current?.close();
        }}
        // browser can force close on a second back
        onClose={(e) => !e.currentTarget.open && sheet.current?.reset()}
        onClick={(e) => e.target === e.currentTarget && sheet.current?.close()}
      >
        <canvas ref={canvasRef} className={s.surface} aria-hidden />
        <div ref={ghostRef} className={s.ghost} aria-hidden>
          <div ref={glyphRef} className={s.glyph}>
            <MenuGlyph />
          </div>
        </div>
        <div ref={panelRef} className={`${s.panel} sq`} tabIndex={-1}>
          <div ref={contentRef} className={s.content}>
            <nav aria-label="Sections">
              <ul className={`${s.list} sq`}>
                {sections.map(({ id, label }) => (
                  <li key={id} className={s.item}>
                    <a href={`#${id}`} className={s.link} onClick={(e) => go(e, id)}>
                      {label}
                      <ChevronRight className={s.chevron} />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <button type="button" className={`${s.done} sq`} onClick={() => sheet.current?.close()}>
              Close
              <HapticTap />
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

// ios safari keeps the status bar tinted after a sticky nav,
// so pull it out of layout for two frames
function releaseStatusBar(bar: HTMLElement) {
  const { body, documentElement: root } = document;
  let timer = 0;
  let frame = 0;
  const restore = () => {
    bar.style.display = body.style.paddingTop = "";
  };
  const release = () => {
    // wait for any page slide
    if (root.dataset.nav) {
      timer = window.setTimeout(release, 100);
      return;
    }
    body.style.paddingTop = `${bar.offsetHeight}px`;
    bar.style.display = "none";
    frame = requestAnimationFrame(() => (frame = requestAnimationFrame(restore)));
  };
  release();
  return () => {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    restore();
  };
}

function MenuGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <path d="M5 7.5h14M5 12h14M5 16.5h14" />
    </svg>
  );
}
