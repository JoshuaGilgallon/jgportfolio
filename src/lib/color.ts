/**
 * A computed CSS colour (getComputedStyle) → [r, g, b] in 0..255, or null if
 * it can't be read or is fully transparent.
 *
 * Browsers serialize computed colours as `rgb()`/`rgba()`, except colours
 * made by color-mix() and the like, which come back as
 * `color(srgb r g b / a)` with channels in 0..1 (Firefox does this, and read
 * as rgb() they'd be all but black). Parsing the string, rather than painting
 * it into a canvas and reading the pixel back, also survives Firefox's
 * fingerprinting protection, which randomises canvas readback.
 */
export function parseComputedColor(css: string): [number, number, number] | null {
  const n = (css.match(/-?[\d.]+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
  if (n.length < 3 || n.some(Number.isNaN)) return null;
  let rgb: [number, number, number];
  if (/^rgba?\(/i.test(css)) rgb = [n[0], n[1], n[2]];
  else if (/^color\(srgb\s/i.test(css)) rgb = [n[0] * 255, n[1] * 255, n[2] * 255];
  else return null;
  if (n[3] === 0) return null;
  return rgb.map((c) => Math.min(255, Math.max(0, c))) as [number, number, number];
}
