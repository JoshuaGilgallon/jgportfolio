"use client";

import { useEffect } from "react";

// marks the reveal as seen once it has played or been cut short,
// so coming back to the page doesn't replay it.
// waiting on the animations survives strict mode's fake unmount
export function RevealOnce() {
  useEffect(() => {
    const root = document.documentElement;
    if ("revealed" in root.dataset) return;
    const playing = document
      .getAnimations()
      .filter((a) => a.effect instanceof KeyframeEffect && a.effect.target instanceof Element && a.effect.target.matches("[data-reveal]"));
    Promise.allSettled(playing.map((a) => a.finished)).then(() => {
      root.dataset.revealed = "";
    });
  }, []);

  return null;
}
