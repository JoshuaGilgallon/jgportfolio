"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { frameOf, MorphAnimation, type Frame } from "@/lib/morph";
import { morph as morphSettings, Spring } from "@/lib/spring";
import s from "./modal.module.css";
import { Scrollbar } from "./scrollbar";

/** Set to true for AnimationKit's "pivot" variant (a J-shaped flight). */
const PIVOT = false;
/** Blur of content as it dissolves, at its strongest. */
const MAX_BLUR = 16;
/** Pull the pane down this far (px), or flick it, and letting go closes it. */
const DISMISS_DISTANCE = 140;
const DISMISS_SPEED = 700;
/** Outgoing content grows with the shape as it dissolves, up to Apple's largest blur-out scale. */
const BLUR_OUT_SCALE = 1.65;

/**
 * The project pane. The card you click flies out of the grid and morphs into
 * it, and closing morphs it back into its slot. The motion is Apple's liquid
 * morph (src/lib/morph.ts), stepped every frame: the card's content blurs out
 * as the pane's content blurs in.
 *
 * Built on the native <dialog>: showModal() puts it in the top layer, traps
 * focus, makes the page inert and closes on Esc. Closing plays the morph,
 * then goes back in history, so the URL and the back button always agree
 * with what's on screen.
 *
 * Next.js keeps visited routes mounted but hidden (React <Activity>), and
 * hiding runs effect cleanups, so the dialog is opened on show and closed on
 * hide. Otherwise a hidden route could leave an invisible modal holding the
 * page inert.
 */
export function Modal({ children, labelledBy }: { children: React.ReactNode; labelledBy: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeFn = useRef<(() => void) | null>(null);
  const router = useRouter();

  useEffect(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    const scroll = scrollRef.current;
    const ghost = ghostRef.current;
    const closeButton = closeRef.current;
    if (!dialog || !panel || !scroll || !ghost || !closeButton) return;

    // Return focus to whatever opened the modal ourselves, with preventScroll:
    // the dialog's built-in restore would scroll the page to reveal it.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    opener?.blur();
    if (!dialog.open) dialog.showModal();

    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let closing = false;
    let frame = 0;
    let card: HTMLElement | null = null;

    // The page behind fades under its blur in step with the morph. Driven by
    // hand (currentTime) rather than played, so it can never drift from it.
    // Engines that can't animate ::backdrop get a custom property instead.
    let veil: Animation | null = null;
    try {
      veil = dialog.animate({ opacity: [0, 1] }, { pseudoElement: "::backdrop", duration: 1000, fill: "both" });
      veil.pause();
    } catch {}
    // The root carries it too, to tint the reserved scrollbar strip that
    // the backdrop can't reach (see globals.css).
    const root = document.documentElement;
    const setVeil = (v: number) => {
      if (veil) veil.currentTime = v * 1000;
      else dialog.style.setProperty("--veil", String(v));
      root.style.setProperty("--veil", String(v));
    };
    const dropVeil = () => {
      veil?.cancel();
      dialog.style.removeProperty("--veil");
      root.style.removeProperty("--veil");
    };
    setVeil(reduceMotion ? 1 : 0);

    const finish = () => {
      cancelAnimationFrame(frame);
      dialog.close();
      if (card) card.style.visibility = "";
      router.back();
    };

    if (reduceMotion) {
      closeFn.current = () => {
        if (closing) return;
        closing = true;
        finish();
      };
      return () => {
        closeFn.current = null;
        dialog.close();
        dropVeil();
        opener?.focus({ preventScroll: true });
      };
    }

    // ---- Measuring ----

    const radiusOf = (el: Element) => parseFloat(getComputedStyle(el).getPropertyValue("--r")) || 0;

    /** Where the pane sits when it's at rest, laid out by its stylesheet. */
    const restFrame = (): Frame => {
      const panelStyle = panel.style.cssText;
      const scrollStyle = scroll.style.cssText;
      panel.style.cssText = "";
      scroll.style.cssText = "";
      const frame = frameOf(panel.getBoundingClientRect(), radiusOf(panel));
      panel.style.cssText = panelStyle;
      scroll.style.cssText = scrollStyle;
      return frame;
    };

    const findCard = () => {
      for (const el of document.querySelectorAll<HTMLAnchorElement>("a[data-morph-source]")) {
        if (el.pathname === location.pathname && el.getClientRects().length > 0) return el;
      }
      return null;
    };

    /** The card's frame, or (if it's gone) a slightly smaller pane to fade from. */
    const sourceFrame = (rest: Frame): Frame =>
      card ? frameOf(card.getBoundingClientRect(), radiusOf(card)) : { ...rest, w: rest.w * 0.9, h: rest.h * 0.9 };

    const rgb = (color: string) => (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    let fromColor = [245, 245, 247];
    let ghostWidth = 1;
    let ghostPlus: HTMLElement | null = null;
    let toColor = [255, 255, 255];

    /** A still copy of the card's content to dissolve, without its link. */
    const fillGhost = () => {
      ghost.replaceChildren();
      ghostPlus = null;
      if (!card) return;
      const copy = document.createElement("div");
      copy.className = card.className;
      if (matchMedia("(hover: hover)").matches && card.matches(":hover")) copy.dataset.hover = "";
      copy.append(...card.cloneNode(true).childNodes);
      copy.style.cssText = `width:${card.offsetWidth}px;height:${card.offsetHeight}px;background:transparent`;
      ghost.append(copy);
      ghostWidth = card.offsetWidth;
      ghostPlus = copy.querySelector<HTMLElement>("[aria-hidden]");
      fromColor = rgb(getComputedStyle(card).backgroundColor);
    };

    // ---- Drawing ----

    /** Below 1 while a pull-to-dismiss has already faded the page in. */
    let veilScale = 1;

    const morph = new MorphAnimation();
    morph.pivot = PIVOT;
    let rest = restFrame();
    let restSize = { w: rest.w, h: rest.h };
    let source = rest;
    const aim = () => {
      source = sourceFrame(rest);
      morph.setEnds(source, rest);
    };
    toColor = rgb(getComputedStyle(panel).backgroundColor);

    // Sub-pixel blur is invisible but still costs a filter pass per frame.
    const blur = (amount: number) => (amount * MAX_BLUR < 0.3 ? "none" : `blur(${amount * MAX_BLUR}px)`);

    const draw = () => {
      const f = morph.shape;
      const p = Math.min(1, Math.max(0, morph.progress));
      const mix = fromColor.map((c, i) => Math.round(c + (toColor[i] - c) * p)).join(" ");
      panel.style.cssText =
        `position:fixed;left:0;top:0;margin:0;max-height:none;` +
        `width:${f.w}px;height:${f.h}px;transform:translate3d(${f.cx - f.w / 2}px,${f.cy - f.h / 2}px,0);` +
        `--r:${f.r}px;--lift:${p};background-color:rgb(${mix})` +
        (card ? "" : `;opacity:${Math.min(1, p * 1.5)}`);
      scroll.style.cssText =
        `flex:none;width:${restSize.w}px;height:${restSize.h}px;` +
        `opacity:${morph.targetOpacity};filter:${blur(morph.targetBlur)}`;
      ghost.style.cssText =
        `opacity:${morph.sourceOpacity};filter:${blur(morph.sourceBlur)};` +
        `transform:scale(${Math.min(BLUR_OUT_SCALE, Math.max(1, f.w / ghostWidth))})`;
      // The card's dark "+" would linger as a smudge, so it leaves first.
      if (ghostPlus) ghostPlus.style.opacity = String(morph.sourceOpacity ** 3);
      closeButton.style.opacity = String(morph.targetOpacity);
      setVeil(p * veilScale);
    };

    /** Hands the pane back to its stylesheet once it has landed. */
    const settle = () => {
      panel.style.cssText = "";
      scroll.style.cssText = "";
      ghost.style.cssText = "";
      ghost.replaceChildren();
      closeButton.style.opacity = "";
      setVeil(1);
      delete dialog.dataset.morphing;
    };

    // Both ways, the pane hands over (to the stylesheet, or to the real card)
    // as soon as it's indistinguishable from where it's going, rather than
    // waiting out the springs' invisible tails.
    const at = (a: Frame) => {
      const f = morph.shape;
      const near = (x: number, y: number) => Math.abs(x - y) < 0.5;
      return (
        near(f.cx, a.cx) && near(f.cy, a.cy) && near(f.w, a.w) && near(f.h, a.h) &&
        morph.kickAmount * Math.max(a.w, a.h) < 0.5
      );
    };
    const landed = () => at(source) && (card ? morph.sourceOpacity > 0.99 : morph.progress < 0.02);
    const opened = () => at(rest) && morph.targetOpacity > 0.999 && morph.sourceOpacity === 0;

    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      morph.update(dt);
      draw();
      if (closing && landed()) return finish();
      if (!closing && (opened() || !morph.animating)) return settle();
      frame = requestAnimationFrame(tick);
    };

    const run = () => {
      cancelAnimationFrame(frame);
      last = 0;
      frame = requestAnimationFrame(tick);
    };

    // If the pane's content changes size mid-flight (it streamed in, or the
    // window was resized), the springs simply retarget to the new frame.
    const resize = new ResizeObserver(() => {
      if (!("morphing" in dialog.dataset) || closing) return;
      rest = restFrame();
      restSize = { w: rest.w, h: rest.h };
      aim();
    });
    resize.observe(scroll.firstElementChild ?? scroll);

    // ---- Open ----

    card = findCard();
    fillGhost();
    if (card) card.style.visibility = "hidden";
    aim();
    dialog.dataset.morphing = "";
    draw();
    morph.expand();
    run();

    // ---- Close ----

    /** `fling`: where (and how fast) a pull-to-dismiss let go of the pane. */
    const close = (fling?: { dy: number; v: number }) => {
      if (closing) return;
      closing = true;
      cancelAnimationFrame(pullFrame);
      if (!("morphing" in dialog.dataset)) {
        // At rest: measure the pane as it is now (its content may have
        // scrolled or grown) and start the morph from there.
        rest = restFrame();
        restSize = { w: rest.w, h: rest.h };
        dialog.dataset.morphing = "";
      }
      // The card may have moved since it opened (e.g. the window resized).
      card = findCard() ?? card;
      if (card) card.style.visibility = "hidden";
      fillGhost();
      aim();
      if (fling) morph.nudge(0, fling.dy, 0, fling.v);
      morph.collapse();
      draw();
      run();
    };
    closeFn.current = () => close();

    // ---- Pull down to dismiss (touch) ----
    // As with an iOS sheet: with the content scrolled to the top, dragging
    // down moves the pane with the finger and lets the page show through.
    // Let go far or fast enough and it morphs home carrying the finger's
    // speed; otherwise it springs back into place.

    type Pull = { x: number; y: number; from: number; dy: number; v: number; t: number; engaged: boolean };
    let pull: Pull | null = null;
    let pullFrame = 0;
    const settleBack = new Spring();

    const setPull = (dy: number) => {
      panel.style.transform = dy > 0.25 ? `translate3d(0,${dy}px,0)` : "";
      veilScale = 1 - 0.5 * Math.min(1, dy / Math.max(1, panel.offsetHeight));
      setVeil(veilScale);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (closing || "morphing" in dialog.dataset || e.touches.length !== 1) return;
      cancelAnimationFrame(pullFrame);
      const t = e.touches[0];
      const from = settleBack.x > 0.25 ? settleBack.x : 0;
      pull = { x: t.clientX, y: t.clientY, from, dy: from, v: 0, t: e.timeStamp, engaged: from > 0 };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pull || closing) return;
      const t = e.touches[0];
      const dx = t.clientX - pull.x;
      const dy = t.clientY - pull.y;
      if (!pull.engaged) {
        // Only a downward drag that starts with the content at its top;
        // anything else is an ordinary scroll (or a sideways code block).
        if (scroll.scrollTop > 0 || dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
          if (Math.hypot(dx, dy) > 8) pull = null;
          return;
        }
        if (dy < 6) return;
        pull.engaged = true;
        pull.y += 6; // the slop before it engaged isn't part of the pull
      }
      e.preventDefault();
      const offset = Math.max(0, pull.from + t.clientY - pull.y);
      const dt = Math.max(1, e.timeStamp - pull.t);
      pull.v = 0.6 * ((offset - pull.dy) / dt) * 1000 + 0.4 * pull.v;
      pull.dy = offset;
      pull.t = e.timeStamp;
      setPull(offset);
    };

    const onTouchEnd = (e: TouchEvent) => {
      const p = pull;
      pull = null;
      if (!p?.engaged) return;
      // A finger that stopped before lifting has no speed left to carry.
      if (e.timeStamp - p.t > 80) p.v = 0;
      if (p.dy > DISMISS_DISTANCE || (p.v > DISMISS_SPEED && p.dy > 16)) return close({ dy: p.dy, v: p.v });
      settleBack.x = p.dy;
      settleBack.v = p.v;
      settleBack.target = 0;
      let last = 0;
      const step = (now: number) => {
        const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
        last = now;
        settleBack.step(dt, morphSettings.grow);
        if (settleBack.settled(0.1)) {
          settleBack.snap(0);
          return setPull(0);
        }
        setPull(Math.max(0, settleBack.x));
        pullFrame = requestAnimationFrame(step);
      };
      pullFrame = requestAnimationFrame(step);
    };

    scroll.addEventListener("touchstart", onTouchStart, { passive: true });
    scroll.addEventListener("touchmove", onTouchMove, { passive: false });
    scroll.addEventListener("touchend", onTouchEnd);
    scroll.addEventListener("touchcancel", onTouchEnd);

    return () => {
      closeFn.current = null;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(pullFrame);
      scroll.removeEventListener("touchstart", onTouchStart);
      scroll.removeEventListener("touchmove", onTouchMove);
      scroll.removeEventListener("touchend", onTouchEnd);
      scroll.removeEventListener("touchcancel", onTouchEnd);
      resize.disconnect();
      settle();
      dialog.close();
      dropVeil();
      if (card) card.style.visibility = "";
      opener?.focus({ preventScroll: true });
    };
  }, [router]);

  // Falls back to a plain close, so the page can never be left inert.
  const close = () => {
    if (closeFn.current) return closeFn.current();
    dialogRef.current?.close();
    router.back();
  };

  return (
    <dialog
      ref={dialogRef}
      className={s.dialog}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault(); // Esc: morph back instead of vanishing.
        close();
      }}
      // The dialog fills the screen around the pane, so a click that lands
      // on the dialog element itself was outside the pane.
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div ref={panelRef} className={`${s.panel} sq`}>
        <div ref={ghostRef} className={s.ghost} aria-hidden inert />
        <div ref={scrollRef} className={s.scroll}>
          <div>{children}</div>
        </div>
        <Scrollbar target={scrollRef} flash={850} />
        <button ref={closeRef} type="button" className={s.close} onClick={close} aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
            <path d="M7.5 7.5l9 9M16.5 7.5l-9 9" />
          </svg>
        </button>
      </div>
    </dialog>
  );
}
