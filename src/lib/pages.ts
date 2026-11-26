/** What the phone-only page slides and preloading know about the site's pages. */

/** The same screens that get the full-screen project pane (modal.module.css). */
export const PHONE = "(max-width: 600px), (pointer: coarse) and (max-height: 500px)";

/** The URL a link would open, if it's a page of this site (not a file, /admin or elsewhere). */
export function pageUrl(link: HTMLAnchorElement): URL | null {
  if (link.target && link.target !== "_self") return null;
  if (link.hasAttribute("download")) return null;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return null;
  return /^\/(?:(?:writing(?:\/[^/.]+)?|projects\/[^/.]+)\/?)?$/.test(url.pathname) ? url : null;
}

/** How far into the site a page is: home, then lists, then single entries. */
export const depthOf = (path: string) => path.split("/").filter(Boolean).length;

/** Where a page's back link leads. */
export const parentOf = (path: string) => (path.startsWith("/writing/") ? "/writing" : "/");
