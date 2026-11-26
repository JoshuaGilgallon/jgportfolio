"use client";

import { useSyncExternalStore } from "react";
import { needsHapticSwitch } from "@/lib/haptics";

const subscribe = () => () => {};

// invisible switch over a button for ios haptics.
// buttons only, it would swallow link clicks
export function HapticTap() {
  const needed = useSyncExternalStore(subscribe, needsHapticSwitch, () => false);
  if (!needed) return null;
  return (
    <label className="haptic-tap" aria-hidden>
      <input ref={attach} type="checkbox" tabIndex={-1} />
    </label>
  );
}

// stop the switch's own events so the button doesn't fire twice.
// native listeners so they run before react
function attach(input: HTMLInputElement) {
  input.setAttribute("switch", "");
  const stop = (e: Event) => e.stopPropagation();
  const events = ["click", "input", "change"];
  for (const type of events) input.addEventListener(type, stop);
  return () => {
    for (const type of events) input.removeEventListener(type, stop);
  };
}
