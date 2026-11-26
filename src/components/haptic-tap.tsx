"use client";

import { useSyncExternalStore } from "react";
import { needsHapticSwitch } from "@/lib/haptics";

const subscribe = () => () => {};

/**
 * Gives the <button> it's placed in an iPhone haptic (see lib/haptics.ts):
 * a transparent label over the button, so the finger's own tap toggles a
 * hidden switch. Renders nothing anywhere else. The switch itself is never
 * under the finger, so a swipe that starts here still scrolls.
 *
 * Only for buttons. On a link it would swallow the navigation.
 */
export function HapticTap() {
  const needed = useSyncExternalStore(subscribe, needsHapticSwitch, () => false);
  if (!needed) return null;
  return (
    <label className="haptic-tap" aria-hidden>
      <input ref={attach} type="checkbox" tabIndex={-1} />
    </label>
  );
}

/**
 * The tap's own click carries on to the button, so its handlers and form
 * submission work as usual. The label then clicks the switch, and those second
 * events must go no further: the button would be pressed twice and a form
 * would count it as an edit. Native listeners, to stop them before React does.
 */
function attach(input: HTMLInputElement) {
  input.setAttribute("switch", "");
  const stop = (e: Event) => e.stopPropagation();
  const events = ["click", "input", "change"];
  for (const type of events) input.addEventListener(type, stop);
  return () => {
    for (const type of events) input.removeEventListener(type, stop);
  };
}
