/**
 * A tick under the finger when a button is pressed.
 *
 * - Android (and anything else with the Vibration API): a short vibration,
 *   from one delegated listener. instrumentation-client.ts imports this to add it.
 * - iPhone: WebKit has no API. Safari plays a haptic when a native switch is
 *   toggled, and since iOS 26.5 only by a real tap, so each button carries an
 *   invisible one (components/haptic-tap.tsx).
 * - Everything else: nothing to feel; the buttons' pressed styles are the feedback.
 */

/** Milliseconds. Long enough for a slow motor to start, short enough to read as a tick. */
const TICK = 10;

const canVibrate = () => typeof navigator.vibrate === "function";

/** True where the only way to a haptic is a switch under the finger. */
export function needsHapticSwitch() {
  return !canVibrate() && navigator.maxTouchPoints > 0 && "switch" in HTMLInputElement.prototype;
}

if (typeof window !== "undefined" && canVibrate()) {
  addEventListener(
    "click",
    (e) => {
      // Only real presses; touch screens only, as a mouse has nothing to shake.
      if (!e.isTrusted || !navigator.maxTouchPoints) return;
      if (e.target instanceof Element && e.target.closest("button:not(:disabled)")) navigator.vibrate(TICK);
    },
    true, // before a handler can disable or remove the button
  );
}
