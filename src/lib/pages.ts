// page info for slides and preloading

// matches the full screen modal query
export const PHONE = "(max-width: 600px), (pointer: coarse) and (max-height: 500px)";

// room for the project pane beside the column, see .dialog[data-side]
export const WIDE = "(min-width: 1280px) and (min-height: 600px)";

// null if it isn't a page on this site
export function pageUrl(link: HTMLAnchorElement): URL | null {
  if (link.target && link.target !== "_self") return null;
  if (link.hasAttribute("download")) return null;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return null;
  return /^\/(?:(?:writing(?:\/[^/.]+)?|projects\/[^/.]+)\/?)?$/.test(url.pathname) ? url : null;
}

// home, lists, entries
export const depthOf = (path: string) => path.split("/").filter(Boolean).length;

// back link target
export const parentOf = (path: string) => (path.startsWith("/writing/") ? "/writing" : "/");
