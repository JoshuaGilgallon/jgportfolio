// has to be added before the router's listener so it can hold events back
type Handler = (event: PopStateEvent) => void;

let handler: Handler | null = null;

if (typeof window !== "undefined") addEventListener("popstate", (event) => handler?.(event), true);

// takes over popstate until the returned function is called
export function interceptPopState(next: Handler) {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}
