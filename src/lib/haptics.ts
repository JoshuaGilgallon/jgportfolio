// button haptics. vibration api here, ios uses haptic-tap.tsx

// ms
const TICK = 10;

const canVibrate = () => typeof navigator.vibrate === "function";

// ios only, needs a real tap on a switch
export function needsHapticSwitch() {
  return !canVibrate() && navigator.maxTouchPoints > 0 && "switch" in HTMLInputElement.prototype;
}

if (typeof window !== "undefined" && canVibrate()) {
  addEventListener(
    "click",
    (e) => {
      // real touch presses only
      if (!e.isTrusted || !navigator.maxTouchPoints) return;
      if (e.target instanceof Element && e.target.closest("button:not(:disabled)")) navigator.vibrate(TICK);
    },
    true, // capture, before the button can be disabled
  );
}
