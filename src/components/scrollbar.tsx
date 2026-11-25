"use client";

import { useEffect, useRef } from "react";
import s from "./scrollbar.module.css";

/**
 * An overlay scroll indicator in the manner of macOS and iOS: a slim pill
 * that floats over the content, appears while scrolling (or when the pointer
 * comes near), fades away when idle and widens to be dragged. The native
 * scrollbar of `target` is hidden in CSS; wheel, touch and keyboard
 * scrolling are untouched. Place it inside a positioned ancestor of target.
 */
export function Scrollbar({ target, flash = 0 }: { target: React.RefObject<HTMLElement | null>; flash?: number }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = target.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!el || !track || !thumb) return;

    let frame = 0;
    let idle = 0;
    let drag: { y: number; top: number; id: number } | null = null;

    const layout = () => {
      frame = 0;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const overflow = scrollHeight - clientHeight;
      if (overflow <= 1) {
        track.dataset.hidden = "";
        return;
      }
      delete track.dataset.hidden;
      const room = track.clientHeight;
      const size = Math.max(40, (room * clientHeight) / scrollHeight);
      const offset = (room - size) * Math.min(1, Math.max(0, scrollTop / overflow));
      thumb.style.height = `${size}px`;
      thumb.style.transform = `translateY(${offset}px)`;
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(layout);
    };

    const show = () => {
      track.dataset.active = "";
      clearTimeout(idle);
      idle = window.setTimeout(() => {
        if (!drag) delete track.dataset.active;
      }, 1000);
    };

    const onScroll = () => {
      schedule();
      show();
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      thumb.setPointerCapture(e.pointerId);
      drag = { y: e.clientY, top: el.scrollTop, id: e.pointerId };
      track.dataset.dragging = "";
      show();
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const travel = track.clientHeight - thumb.offsetHeight;
      const ratio = travel > 0 ? (el.scrollHeight - el.clientHeight) / travel : 0;
      el.scrollTop = drag.top + (e.clientY - drag.y) * ratio;
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      delete track.dataset.dragging;
      show();
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    thumb.addEventListener("pointerdown", onDown);
    thumb.addEventListener("pointermove", onMove);
    thumb.addEventListener("pointerup", onUp);
    thumb.addEventListener("pointercancel", onUp);
    const resize = new ResizeObserver(schedule);
    resize.observe(el);
    if (el.firstElementChild) resize.observe(el.firstElementChild);
    layout();

    // Like a fresh iOS scroll view, flash once so it's clear there's more.
    const flashTimer = window.setTimeout(() => {
      layout();
      show();
    }, flash);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(idle);
      clearTimeout(flashTimer);
      resize.disconnect();
      el.removeEventListener("scroll", onScroll);
      thumb.removeEventListener("pointerdown", onDown);
      thumb.removeEventListener("pointermove", onMove);
      thumb.removeEventListener("pointerup", onUp);
      thumb.removeEventListener("pointercancel", onUp);
    };
  }, [target, flash]);

  return (
    <div ref={trackRef} className={s.track} aria-hidden data-hidden="">
      <div ref={thumbRef} className={s.thumb} />
    </div>
  );
}
