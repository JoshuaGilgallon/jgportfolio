// parses a computed css colour to rgb, null if transparent or unreadable.
// firefox returns color(srgb ...) for color-mix, and its canvas readback is randomised
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
