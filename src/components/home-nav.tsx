"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LiquidMorph } from "@/lib/liquid-morph";
import { LiquidSurface } from "@/lib/liquid-surface";
import { frameOf, type Frame } from "@/lib/morph";
import { ChevronRight } from "./icons";
import s from "./home-nav.module.css";

/** Remembers that the hint has been shown, so it only ever appears once. */
const HINT_SEEN = "nav-hint-seen";
const HINT_TIME = 5000;
/** The content's blur at the far end of its cross-fade, px (measured on iOS: 4 pt). */
const CONTENT_BLUR = 4;
/** Room above the sheet for the morph's overshoot and shadow, px. */
const SURFACE_HEADROOM = 160;

/**
 * The home page's navigation on phones once you've scrolled. There the top bar
 * isn't sticky: it leaves with the page, and a round button blurs in at the
 * bottom right. Tapping it morphs the button into a sheet along the bottom of
 * the screen with iOS's button → menu morph (src/lib/liquid-morph.ts): the
 * sheet wells up out of the button as a second blob, the two fused into one
 * surface (src/lib/liquid-surface.ts), while the button shrinks away into it.
 */
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
  const sheet = useRef<{ open: () => void; close: () => void; reset: () => void } | null>(null);

  // Marks the home page while it's on screen (the router keeps it mounted but
  // hidden elsewhere, which runs this cleanup). On phones the stylesheets unstick
  // the bar.
  useLayoutEffect(() => {
    document.documentElement.dataset.home = "";
    return () => {
      delete document.documentElement.dataset.home;
    };
  }, []);

  // The button takes over once the bar has scrolled out of sight.
  useEffect(() => {
    const bar = document.querySelector("[data-site-nav]");
    if (!bar) return;
    const observer = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting));
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  // The first time the button appears, say what it's for.
  useEffect(() => {
    if (!shown) return;
    try {
      if (localStorage.getItem(HINT_SEEN)) return;
    } catch {}
    let hide = 0;
    // A beat after the button, so the eye finds that first.
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
    // Made on the first open; null where there's no WebGL 2, and the blobs draw themselves instead.
    let surface: LiquidSurface | null | undefined;
    let frame = 0;
    let closing = false;
    let rest: Frame;
    let source: Frame;

    // The page behind fades under its blur in step with the morph (see modal.tsx).
    let veil: Animation | null = null;
    const setVeil = (v: number) => {
      if (veil) veil.currentTime = v * 1000;
      else dialog.style.setProperty("--veil", String(v));
      root.style.setProperty("--veil", String(v));
    };

    const measure = () => {
      const styles = [panel.style.cssText, content.style.cssText];
      panel.style.cssText = content.style.cssText = "";
      const ps = getComputedStyle(panel);
      rest = frameOf(panel.getBoundingClientRect(), parseFloat(ps.getPropertyValue("--r")));
      const color = ps.backgroundColor;
      [panel.style.cssText, content.style.cssText] = styles;
      // The button is a circle, whatever its transition is doing: measure its layout box.
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
        // Room for the blobs' overshoot and the shadow, from the top of the sheet to the bottom of the screen.
        const top = Math.max(0, Math.min(rest.cy - rest.h / 2, source.cy - source.h / 2) - SURFACE_HEADROOM);
        surface.layout(0, top, root.clientWidth, innerHeight - top, color);
        dialog.dataset.surface = "";
      } else delete dialog.dataset.surface;
    };

    const blur = (px: number) => (px < 0.3 ? "none" : `blur(${px}px)`);
    /** The site's squircle corner (.sq, globals.css), `q` of the way from a circle. */
    const corner = (r: number, f: Frame, q: number) =>
      squircles ? { r: Math.min(r * (1 + 0.53 * q), Math.min(f.w, f.h) / 2), k: 1 + 0.7 * q } : { r, k: 1 };

    const draw = () => {
      const b = morph.bodyFrame;
      const g = morph.ghostFrame;
      const c = corner(b.r, b, morph.cornerProgress);
      const p = morph.contentProgress;
      const pc = Math.min(1, Math.max(0, p));
      const lift = Math.min(1, Math.max(0, morph.progress));

      // The surface: both blobs as one shape, fused while the field is blurred.
      surface?.draw(
        [
          { ...g, r: Math.min(g.w, g.h) / 2, k: 1 },
          { ...b, r: c.r, k: c.k },
        ],
        morph.gaussSigma,
        lift,
      );

      // The body clips the menu, scaled to fit it, fading and sharpening in…
      panel.style.cssText =
        `position:fixed;left:0;top:0;margin:0;width:${b.w}px;height:${b.h}px;` +
        `transform:translate3d(${b.cx - b.w / 2}px,${b.cy - b.h / 2}px,0);--lift:${lift};` +
        `border-radius:${c.r}px;${squircles ? `corner-shape:superellipse(${c.k});` : ""}`;
      const s = Math.min(b.w / rest.w, b.h / rest.h);
      content.style.cssText =
        `position:absolute;left:0;top:0;width:${rest.w}px;height:${rest.h}px;` +
        `transform:translate3d(${(b.w - rest.w) / 2}px,${(b.h - rest.h) / 2}px,0) scale(${s});` +
        `opacity:${pc};filter:${blur(Math.hypot(CONTENT_BLUR * (1 - pc), morph.lensBlur))}`;
      // …while the ghost carries the button's icon away, blurring out.
      ghost.style.cssText =
        `width:${g.w}px;height:${g.h}px;transform:translate3d(${g.cx - g.w / 2}px,${g.cy - g.h / 2}px,0)`;
      glyph.style.cssText =
        `left:${(g.w - source.w) / 2}px;top:${(g.h - source.h) / 2}px;width:${source.w}px;height:${source.h}px;` +
        `transform:scale(${Math.max(g.w / source.w, g.h / source.h)});` +
        `opacity:${1 - pc};filter:${blur(CONTENT_BLUR * pc)}`;
      setVeil(lift);
    };

    /** Hands the sheet back to its stylesheet. */
    const settle = () => {
      panel.style.cssText = content.style.cssText = ghost.style.cssText = glyph.style.cssText = "";
      delete dialog.dataset.morphing;
      surface?.clear();
    };

    const finish = () => {
      cancelAnimationFrame(frame);
      closing = false;
      delete button.dataset.away; // before closing, so focus can return to it
      if (dialog.open) dialog.close();
      settle();
      veil?.cancel();
      veil = null;
      dialog.style.removeProperty("--veil");
      root.style.removeProperty("--veil");
    };

    /**
     * Closing, the springs take another second to settle to a hundredth of a
     * pixel after the button looks back: hand over to the button (and the page)
     * once nothing visible is left to move.
     */
    const home = () => {
      const g = morph.ghostFrame;
      const b = morph.bodyFrame;
      const near = (a: number, b: number) => Math.abs(a - b) < 0.25;
      const inside = Math.hypot(b.cx - source.cx, b.cy - source.cy) + Math.max(b.w, b.h) / 2 <= source.w / 2;
      return near(g.cx, source.cx) && near(g.cy, source.cy) && near(g.w, source.w) && near(g.h, source.h) && inside && morph.contentProgress < 0.005;
    };

    /** Steps the morph until its springs come to rest. */
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
        dialog.showModal();
        // Focus the sheet itself: a ring on its first button would look selected.
        panel.focus({ preventScroll: true });
        try {
          veil = dialog.animate({ opacity: [0, 1] }, { pseudoElement: "::backdrop", duration: 1000, fill: "both" });
          veil.pause();
        } catch {}
        button.dataset.away = "";
        if (still()) return setVeil(1);
        measure();
        morph.snap(false);
        morph.expand();
        run();
      },
      close() {
        if (!dialog.open || closing) return;
        if (still()) return finish();
        closing = true;
        // At rest the morph already sits on the sheet; measure afresh in case the window changed.
        if (!morph.animating) measure();
        morph.collapse();
        run();
      },
    };

    // Leaving the page (the router hides it) must not leave an invisible modal behind.
    return () => {
      sheet.current = null;
      finish();
    };
  }, []);

  /** Scrolls to a section while the sheet folds back into its button. */
  const go = (e: React.MouseEvent, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    sheet.current?.close();
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
      </button>
      <dialog
        ref={dialogRef}
        className={s.dialog}
        aria-label="Navigate"
        onCancel={(e) => {
          e.preventDefault(); // Esc or Android's Back: morph away instead of vanishing.
          sheet.current?.close();
        }}
        // A browser may close it regardless on a second Back; tidy up after it.
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
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

function MenuGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <path d="M5 7.5h14M5 12h14M5 16.5h14" />
    </svg>
  );
}
