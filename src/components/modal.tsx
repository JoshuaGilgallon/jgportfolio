"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { parseComputedColor } from "@/lib/color";
import { frameOf, MorphAnimation, type Frame } from "@/lib/morph";
import { WIDE } from "@/lib/pages";
import { stage } from "@/lib/side-stage";
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

// going back home, browsers put the page where it was when the side pane opened.
// the page scrolled freely since, so hold it where it is. the restore lands just
// after popstate, and its scroll event fires before paint.
// chrome unmounts the pane before popstate (next uses the navigation api there),
// so this stays armed for a moment after it closes
const SIDE_GRACE = 250;
let sideUntil = 0;

if (typeof window !== "undefined") {
  addEventListener(
    "popstate",
    () => {
      if (performance.now() > sideUntil || location.pathname !== "/") return;
      const y = scrollY;
      const hold = () => {
        if (Math.abs(scrollY - y) > 0.5) scrollTo(0, y);
      };
      addEventListener("scroll", hold);
      requestAnimationFrame(() => requestAnimationFrame(() => removeEventListener("scroll", hold)));
    },
    true,
  );
}

const subscribeWide = (change: () => void) => {
  const query = matchMedia(WIDE);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};

// project pane that morphs out of its card. native dialog for focus trapping.
// opens and closes with visibility since next keeps hidden routes mounted.
// on wide screens it's a side pane instead, beside the column and not modal
export function Modal({ children, labelledBy }: { children: React.ReactNode; labelledBy: string }) {
  const wide = useSyncExternalStore(subscribeWide, () => matchMedia(WIDE).matches, () => false);
  // set when the window crosses WIDE, so the other layout appears settled
  const resume = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeFn = useRef<(() => void) | null>(null);
  const router = useRouter();

  // layout effect so a modal hiding and the next one showing hand over in one commit
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    const scroll = scrollRef.current;
    const ghost = ghostRef.current;
    const rail = railRef.current;
    const closeButton = closeRef.current;
    if (!dialog || !panel || !scroll || !ghost || !rail || !closeButton) return;

    const side = wide;
    const resumed = resume.current;
    resume.current = false;

    // restore focus manually, the built in one scrolls the page
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    opener?.blur();
    // show() keeps the page usable beside the pane
    if (side) dialog.dataset.side = "";
    else delete dialog.dataset.side;
    if (!dialog.open) {
      if (side) dialog.show();
      else dialog.showModal();
    }

    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let closing = false;
    // closed and landed, or left for another page
    let finished = false;
    // a card click mid close, the route change takes over
    let redirected = false;
    let frame = 0;
    let card: HTMLElement | null = null;

    // scrubbed by hand so it stays in sync
    // custom property if ::backdrop can't be animated
    let veil: Animation | null = null;
    if (!side) {
      try {
        veil = dialog.animate({ opacity: [0, 1] }, { pseudoElement: "::backdrop", duration: 1000, fill: "both" });
        veil.pause();
      } catch {}
    }
    // root gets it too for the scrollbar gutter
    const root = document.documentElement;
    // anything set on the root restyles the whole document, and the gutter's
    // tint only has a couple of dozen 8 bit steps (see globals.css), so it's
    // only touched when the colour it paints changes
    let gutter = "";
    const setVeil = (v: number) => {
      if (side) return;
      if (veil) veil.currentTime = v * 1000;
      else dialog.style.setProperty("--veil", String(v));
      const p = v * 0.45;
      const tint = `${Math.round(255 - 45 * p)} ${Math.round(255 - 40 * p)}`;
      if (tint === gutter) return;
      gutter = tint;
      root.style.setProperty("--veil", String(v));
    };
    const dropVeil = () => {
      veil?.cancel();
      dialog.style.removeProperty("--veil");
      root.style.removeProperty("--veil");
      gutter = "";
    };
    setVeil(reduceMotion || resumed ? 1 : 0);

    const finish = () => {
      finished = true;
      cancelAnimationFrame(frame);
      dialog.close();
      if (card) card.style.visibility = "";
      router.back();
    };

    const radiusOf = (el: Element) => parseFloat(getComputedStyle(el).getPropertyValue("--r")) || 0;

    const findCard = () => {
      for (const el of document.querySelectorAll<HTMLAnchorElement>("a[data-morph-source]")) {
        if (el.pathname === location.pathname && el.getClientRects().length > 0) return el;
      }
      return null;
    };

    // side pane: column and pane centred together, so the column moves half the pane and gap
    const shiftFor = (pane: Frame) => {
      const gap = parseFloat(getComputedStyle(dialog).getPropertyValue("--gap")) || 0;
      const page = parseFloat(getComputedStyle(root).getPropertyValue("--page")) || 0;
      return Math.min(0, pane.cx - pane.w / 2 - gap - (root.clientWidth + page) / 2);
    };

    // side pane: esc, and other cards swap the project in place
    const listenSide = () => {
      if (!side) return () => {};
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("dialog:modal")) return;
        e.preventDefault();
        closeFn.current?.();
      };
      const onClick = (e: MouseEvent) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const link = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[data-morph-source]") : null;
        if (!link || link.pathname === location.pathname) return;
        // replace so closing goes home, not back to the last project
        e.preventDefault();
        redirected = true;
        router.replace(link.pathname, { scroll: false });
      };
      document.addEventListener("keydown", onKey);
      document.addEventListener("click", onClick, true);
      sideUntil = Infinity;
      return () => {
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("click", onClick, true);
        sideUntil = performance.now() + SIDE_GRACE;
      };
    };

    if (reduceMotion) {
      card = findCard();
      if (side) {
        if (card) stage.lift(card, true);
        stage.claim(shiftFor(frameOf(panel.getBoundingClientRect(), 0)), true);
      }
      const unlisten = listenSide();
      closeFn.current = () => {
        if (closing) return;
        closing = true;
        if (side) {
          if (card) stage.drop(card, { instant: true });
          stage.release({ instant: true, now: true });
        }
        finish();
      };
      return () => {
        closeFn.current = null;
        unlisten();
        if (matchMedia(WIDE).matches !== side) resume.current = true;
        if (side && !finished) {
          if (card) stage.drop(card, { instant: true });
          stage.release({ instant: true });
        }
        dialog.close();
        delete dialog.dataset.side;
        dropVeil();
        opener?.focus({ preventScroll: true });
      };
    }

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

    // where a side pane's card was before it left the grid
    let lifted: Frame | null = null;

    // card frame, or a smaller pane if it's gone
    const sourceFrame = (rest: Frame): Frame => {
      if (lifted) return lifted;
      return card ? frameOf(card.getBoundingClientRect(), radiusOf(card)) : { ...rest, w: rest.w * 0.9, h: rest.h * 0.9 };
    };

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

    // where the rail sits, measured only when it can have changed so drawing
    // doesn't force a layout every frame. the scroll box keeps restSize while
    // morphing, so that's a scroll, a resize, new content, or a new run
    let railStale = true;
    let railScrolled = 0;
    const staleRail = () => {
      railStale = true;
    };

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
      if (railStale) {
        railStale = false;
        const overflow = scroll.scrollHeight - scroll.clientHeight;
        railScrolled = overflow > 0 ? Math.min(1, Math.max(0, scroll.scrollTop / overflow)) : 0;
      }
      const scrolled = railScrolled;
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
      staleRail();
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
    // a cleanup before any frame is strict mode remounting, nothing to animate away
    let ticked = false;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      ticked = true;
      // the slot slides with the column, follow it in
      if (side && closing) aim();
      morph.update(dt);
      draw();
      if (closing && !redirected && landed()) return finish();
      if (!closing && (opened() || !morph.animating)) return settle();
      frame = requestAnimationFrame(tick);
    };

    const run = () => {
      staleRail();
      cancelAnimationFrame(frame);
      last = 0;
      frame = requestAnimationFrame(tick);
    };

    // retarget if the size changes mid flight
    const resize = new ResizeObserver(() => {
      staleRail();
      if (!("morphing" in dialog.dataset) || closing) return;
      rest = restFrame();
      restSize = { w: rest.w, h: rest.h };
      aim();
    });
    resize.observe(scroll.firstElementChild ?? scroll);
    // content streaming in mid flight, caught before the next draw
    const mutations = new MutationObserver(staleRail);
    mutations.observe(scroll, { childList: true, subtree: true, characterData: true });
    scroll.addEventListener("scroll", staleRail, { passive: true });

    // the side pane's place depends on the window
    const onWindowResize = () => {
      if (closing) return;
      if ("morphing" in dialog.dataset) {
        rest = restFrame();
        restSize = { w: rest.w, h: rest.h };
        staleRail();
        aim();
      }
      stage.claim(shiftFor(restFrame()), true);
    };
    if (side) addEventListener("resize", onWindowResize);
    const unlisten = listenSide();

    card = findCard();
    fillGhost();
    if (card) {
      card.style.visibility = "hidden";
      if (side) {
        lifted = frameOf(card.getBoundingClientRect(), radiusOf(card));
        stage.lift(card, resumed);
      }
    }
    if (side) stage.claim(shiftFor(rest), resumed);
    aim();
    dialog.dataset.morphing = "";
    morph.expand();
    if (resumed) morph.snap(true);
    draw();
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
        staleRail();
        dialog.dataset.morphing = "";
      }
      if (side) {
        // back into the grid, still hidden, and the column comes home
        lifted = null;
        if (card) stage.drop(card);
        stage.release({ now: true });
      } else card = findCard() ?? card; // card may have moved
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

    // pulling a side pane down makes no sense
    if (!side) {
      scroll.addEventListener("touchstart", onTouchStart, { passive: true });
      scroll.addEventListener("touchmove", onTouchMove, { passive: false });
      scroll.addEventListener("touchend", onTouchEnd);
      scroll.addEventListener("touchcancel", onTouchEnd);
    }

    // copy of the pane as it looks now, sunk away under whatever comes next
    const recede = () => {
      const rect = panel.getBoundingClientRect();
      if (!rect.width) return;
      const layer = document.createElement("div");
      layer.className = dialog.className;
      layer.setAttribute("open", "");
      layer.setAttribute("aria-hidden", "true");
      layer.dataset.side = "";
      layer.inert = true;
      // only as big as the pane, it gets blurred
      layer.style.cssText = `inset:auto;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
      const copy = panel.cloneNode(true) as HTMLElement;
      copy.style.cssText +=
        `;position:absolute;left:0;top:0;right:auto;margin:0;transform:none;` +
        `width:${rect.width}px;height:${rect.height}px;max-height:none`;
      for (const el of copy.querySelectorAll("[id]")) el.removeAttribute("id");
      layer.append(copy);
      document.body.append(layer);
      const copyScroll = copy.querySelector<HTMLElement>(`.${s.scroll}`);
      if (copyScroll) copyScroll.scrollTop = scroll.scrollTop;
      stage.recede(layer);
    };

    return () => {
      closeFn.current = null;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(pullFrame);
      scroll.removeEventListener("touchstart", onTouchStart);
      scroll.removeEventListener("touchmove", onTouchMove);
      scroll.removeEventListener("touchend", onTouchEnd);
      scroll.removeEventListener("touchcancel", onTouchEnd);
      removeEventListener("resize", onWindowResize);
      unlisten();
      resize.disconnect();
      mutations.disconnect();
      scroll.removeEventListener("scroll", staleRail);
      const modeChange = matchMedia(WIDE).matches !== side;
      if (modeChange) resume.current = true;
      if (side && !finished) {
        if (modeChange) {
          if (card) stage.drop(card, { instant: true });
          stage.release({ instant: true, now: true });
        } else if (!ticked) {
          if (card) stage.drop(card);
          stage.release();
        } else {
          // left some other way: another project, back, a nav link
          recede();
          if (card) stage.drop(card, { emerge: true });
          stage.release();
        }
      }
      settle();
      dialog.close();
      delete dialog.dataset.side;
      dropVeil();
      if (card) card.style.visibility = "";
      // after a switch the opener is the previous project's card
      (side ? (card ?? opener) : opener)?.focus({ preventScroll: true });
    };
  }, [router, wide]);

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
