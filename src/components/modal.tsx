"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { parseComputedColor } from "@/lib/color";
import { frameOf, MorphAnimation, type Frame } from "@/lib/morph";
import { morph as morphSettings, Spring } from "@/lib/spring";
import { HapticTap } from "./haptic-tap";
import s from "./modal.module.css";
import { Scrollbar } from "./scrollbar";

// true for the j shaped flight
const PIVOT = false;
const MAX_BLUR = 16;
// pull distance in px to dismiss
const DISMISS_DISTANCE = 140;
const DISMISS_SPEED = 700;
// max corner rounding while pulling
const PULL_RADIUS = 24;
// how much outgoing content scales up
const BLUR_OUT_SCALE = 1.65;

// project pane that morphs out of its card. native dialog for focus trapping.
// opens and closes with visibility since next keeps hidden routes mounted
export function Modal({ children, labelledBy }: { children: React.ReactNode; labelledBy: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeFn = useRef<(() => void) | null>(null);
  const router = useRouter();

  useEffect(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    const scroll = scrollRef.current;
    const ghost = ghostRef.current;
    const rail = railRef.current;
    const closeButton = closeRef.current;
    if (!dialog || !panel || !scroll || !ghost || !rail || !closeButton) return;

    // restore focus manually, the built in one scrolls the page
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    opener?.blur();
    if (!dialog.open) dialog.showModal();

    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let closing = false;
    let frame = 0;
    let card: HTMLElement | null = null;

    // scrubbed by hand so it stays in sync
    // custom property if ::backdrop can't be animated
    let veil: Animation | null = null;
    try {
      veil = dialog.animate({ opacity: [0, 1] }, { pseudoElement: "::backdrop", duration: 1000, fill: "both" });
      veil.pause();
    } catch {}
    // root gets it too for the scrollbar gutter
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

    const radiusOf = (el: Element) => parseFloat(getComputedStyle(el).getPropertyValue("--r")) || 0;

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

    // card frame, or a smaller pane if it's gone
    const sourceFrame = (rest: Frame): Frame =>
      card ? frameOf(card.getBoundingClientRect(), radiusOf(card)) : { ...rest, w: rest.w * 0.9, h: rest.h * 0.9 };

    const rgb = (el: Element, fallback: number[]) =>
      parseComputedColor(getComputedStyle(el).backgroundColor) ?? fallback;
    let fromColor = [245, 245, 247];
    let ghostWidth = 1;
    let ghostPlus: HTMLElement | null = null;
    let toColor = [255, 255, 255];

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
      fromColor = rgb(card, [245, 245, 247]);
    };

    // below 1 if a pull already faded the page
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
    toColor = rgb(panel, toColor);

    // skip invisible blur, it's still expensive
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
      // keep its height and ride the right edge
      const overflow = scroll.scrollHeight - scroll.clientHeight;
      const scrolled = overflow > 0 ? Math.min(1, Math.max(0, scroll.scrollTop / overflow)) : 0;
      rail.style.cssText =
        `position:absolute;z-index:1;top:0;right:0;width:16px;height:${restSize.h}px;` +
        `transform:translateY(${(f.h - restSize.h) * scrolled}px);` +
        `opacity:${morph.targetOpacity};filter:${blur(morph.targetBlur)}`;
      // card's plus goes first so it doesn't smudge
      if (ghostPlus) ghostPlus.style.opacity = String(morph.sourceOpacity ** 3);
      closeButton.style.opacity = String(morph.targetOpacity);
      setVeil(p * veilScale);
    };

    const settle = () => {
      panel.style.cssText = "";
      scroll.style.cssText = "";
      ghost.style.cssText = "";
      ghost.replaceChildren();
      rail.style.cssText = "";
      closeButton.style.opacity = "";
      setVeil(1);
      delete dialog.dataset.morphing;
    };

    // hand over once it looks done, not when the springs settle
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

    // retarget if the size changes mid flight
    const resize = new ResizeObserver(() => {
      if (!("morphing" in dialog.dataset) || closing) return;
      rest = restFrame();
      restSize = { w: rest.w, h: rest.h };
      aim();
    });
    resize.observe(scroll.firstElementChild ?? scroll);

    card = findCard();
    fillGhost();
    if (card) card.style.visibility = "hidden";
    aim();
    dialog.dataset.morphing = "";
    draw();
    morph.expand();
    run();

    // fling = release point and speed of a pull
    const close = (fling?: { dy: number; v: number }) => {
      if (closing) return;
      closing = true;
      cancelAnimationFrame(pullFrame);
      if (!("morphing" in dialog.dataset)) {
        // remeasure since content may have scrolled or grown
        const r = radiusOf(panel); // a pull may have rounded these
        rest = { ...restFrame(), r };
        restSize = { w: rest.w, h: rest.h };
        dialog.dataset.morphing = "";
      }
      // card may have moved
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

    type Pull = { x: number; y: number; from: number; dy: number; v: number; t: number; engaged: boolean };
    let pull: Pull | null = null;
    let pullFrame = 0;
    const settleBack = new Spring();

    const setPull = (dy: number) => {
      panel.style.transform = dy > 0.25 ? `translate3d(0,${dy}px,0)` : "";
      // square corners round as it comes away
      panel.style.removeProperty("--r");
      const rounded = Math.min(PULL_RADIUS, dy);
      if (rounded > radiusOf(panel)) panel.style.setProperty("--r", `${rounded}px`);
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
        // only downward drags from the top, the rest scrolls
        if (scroll.scrollTop > 0 || dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
          if (Math.hypot(dx, dy) > 8) pull = null;
          return;
        }
        if (dy < 6) return;
        pull.engaged = true;
        pull.y += 6; // ignore the touch slop
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
      // no velocity if the finger stopped first
      if (e.timeStamp - p.t > 80) p.v = 0;
      if (p.dy > DISMISS_DISTANCE || (p.v > DISMISS_SPEED && p.dy > 16)) return close({ dy: p.dy, v: p.v });
      settleBack.x = p.dy;
      settleBack.v = p.v;
      settleBack.target = 0;
      let last = 0;
      const step = (now: number) => {
        const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
        last = now;
        settleBack.step(dt, morphSettings.pullBack);
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

  // plain close as a fallback so the page isn't stuck
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
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div ref={panelRef} className={`${s.panel} sq`}>
        <div ref={ghostRef} className={s.ghost} aria-hidden inert />
        <div ref={scrollRef} className={s.scroll}>
          <div>{children}</div>
        </div>
        {/* sized and faded by the morph */}
        <div ref={railRef}>
          <Scrollbar target={scrollRef} flash={1800} />
        </div>
        <button ref={closeRef} type="button" className={s.close} onClick={close} aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
            <path d="M7.5 7.5l9 9M16.5 7.5l-9 9" />
          </svg>
          <HapticTap />
        </button>
      </div>
    </dialog>
  );
}
