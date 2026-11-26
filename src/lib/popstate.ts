/**
 * A popstate listener that is guaranteed to run before the router's, so it
 * can hold the event back (page-transitions.tsx). Listeners run in the order
 * they were added, and `capture` alone didn't put a later one in front, so
 * instrumentation-client.ts imports this to add it before React starts.
 */
type Handler = (event: PopStateEvent) => void;

let handler: Handler | null = null;

if (typeof window !== "undefined") addEventListener("popstate", (event) => handler?.(event), true);

/** Hands Back and Forward to `next` until the returned function is called. */
export function interceptPopState(next: Handler) {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}
