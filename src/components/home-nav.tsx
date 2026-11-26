"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { frameOf, MorphAnimation, type Frame } from "@/lib/morph";
import { ChevronRight } from "./icons";
import s from "./home-nav.module.css";

/** Remembers that the hint has been shown, so it only ever appears once. */
const HINT_SEEN = "nav-hint-seen";
const HINT_TIME = 5000;
/** As in the project pane (modal.tsx). */
const MAX_BLUR = 16;
const BLUR_OUT_SCALE = 1.65;

/**
 * The home page's navigation once you've scrolled. Here the top bar isn't
 * sticky: it leaves with the page, and a round button blurs in at the bottom
 * right. Tapping it morphs the button into a sheet along the bottom of the
 * screen, with the same liquid morph as the project pane (src/lib/morph.ts).
 */
export function HomeNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [shown, setShown] = useState(false);
  const [hint, setHint] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const sheet = useRef<{ open: () => void; close: () => void; reset: () => void } | null>(null);

  // Marks the home page while it's on screen (the router keeps it mounted but
  // hidden elsewhere, which runs this cleanup). The stylesheets unstick the bar.
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
    if (!button || !dialog || !panel || !content || !ghost) return;

    const root = document.documentElement;
    const morph = new MorphAnimation();
    const squircles = CSS.supports("corner-shape", "superellipse(2)");
    let frame = 0;
    let closing = false;
    let rest: Frame;

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
      rest = frameOf(panel.getBoundingClientRect(), parseFloat(getComputedStyle(panel).getPropertyValue("--r")));
      [panel.style.cssText, content.style.cssText] = styles;
      // The button is a circle, whatever its transition is doing: measure its layout box.
      const { width, right, bottom } = getComputedStyle(button);
      const size = parseFloat(width);
      const source: Frame = {
        cx: root.clientWidth - parseFloat(right) - size / 2,
        cy: innerHeight - parseFloat(bottom) - size / 2,
        w: size,
        h: size,
        r: size / 2,
      };
      morph.setEnds(source, rest);
      return source;
    };

    const blur = (amount: number) => (amount * MAX_BLUR < 0.3 ? "none" : `blur(${amount * MAX_BLUR}px)`);

    const draw = (source: Frame) => {
      const f = morph.shape;
      const p = Math.min(1, Math.max(0, morph.progress));
      // From a true circle into the site's squircle corner (.sq, globals.css).
      const corner = squircles
        ? `border-radius:${f.r * (1 + 0.53 * p)}px;corner-shape:superellipse(${1 + 0.7 * p});`
        : `border-radius:${f.r}px;`;
      panel.style.cssText =
        `position:fixed;left:0;top:0;margin:0;width:${f.w}px;height:${f.h}px;` +
        `transform:translate3d(${f.cx - f.w / 2}px,${f.cy - f.h / 2}px,0);--lift:${p};${corner}`;
      content.style.cssText =
        `position:absolute;right:0;bottom:0;width:${rest.w}px;height:${rest.h}px;` +
        `opacity:${morph.targetOpacity};filter:${blur(morph.targetBlur)}`;
      ghost.style.cssText =
        `opacity:${morph.sourceOpacity};filter:${blur(morph.sourceBlur)};` +
        `transform:scale(${Math.min(BLUR_OUT_SCALE, Math.max(1, f.w / source.w))})`;
      setVeil(p);
    };

    /** Hands the sheet back to its stylesheet. */
    const settle = () => {
      panel.style.cssText = content.style.cssText = ghost.style.cssText = "";
      delete dialog.dataset.morphing;
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

    /** Steps the morph until it's indistinguishable from where it's going. */
    const run = (source: Frame) => {
      cancelAnimationFrame(frame);
      dialog.dataset.morphing = "";
      draw(source);
      let last = 0;
      const tick = (now: number) => {
        const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
        last = now;
        morph.update(dt);
        draw(source);
        const f = morph.shape;
        const to = closing ? source : rest;
        const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
        const there =
          near(f.cx, to.cx) && near(f.cy, to.cy) && near(f.w, to.w) && near(f.h, to.h) &&
          morph.kickAmount * Math.max(to.w, to.h) < 0.5;
        if (closing && there && morph.sourceOpacity > 0.99) return finish();
        if (!closing && ((there && morph.targetOpacity > 0.999 && morph.sourceOpacity === 0) || !morph.animating))
          return settle();
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
        const source = measure();
        morph.snap(false);
        morph.expand();
        run(source);
      },
      close() {
        if (!dialog.open || closing) return;
        if (still()) return finish();
        closing = true;
        // At rest the morph already sits on the sheet; measure afresh in case the window changed.
        const source = measure();
        morph.collapse();
        run(source);
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
        <div ref={panelRef} className={`${s.panel} sq`} tabIndex={-1}>
          <div ref={ghostRef} className={s.ghost} aria-hidden>
            <MenuGlyph />
          </div>
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
