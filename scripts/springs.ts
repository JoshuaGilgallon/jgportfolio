/**
 * Prints the CSS easing tokens in globals.css: Apple springs sampled into
 * `linear()` curves with the same integrator the morph uses (src/lib/spring.ts).
 *
 *   npx tsx scripts/springs.ts
 */
import { Spring, type SpringSpec } from "../src/lib/spring";

function sample(spec: SpringSpec) {
  const s = new Spring(0, 0, 1);
  const dt = 1 / 240;
  const points: [number, number][] = [[0, 0]];
  let t = 0;
  // Run until the motion is below a thousandth of the distance travelled.
  while (!(Math.abs(s.x - 1) < 1e-3 && Math.abs(s.v) < 1e-2) && t < 3) {
    s.step(dt, spec);
    t += dt;
    points.push([t, s.x]);
  }
  points[points.length - 1][1] = 1;
  return { duration: t, points };
}

// Ramer–Douglas–Peucker: keep only the points that bend the curve.
function simplify(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length < 3) return points;
  const [x0, y0] = points[0];
  const [x1, y1] = points[points.length - 1];
  let worst = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const yLine = y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    const d = Math.abs(y - yLine);
    if (d > worst) [worst, index] = [d, i];
  }
  if (worst <= tolerance) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
}

function token(name: string, spec: SpringSpec, note: string) {
  const { duration, points } = sample(spec);
  const stops = simplify(points, 0.002).map(([t, x], i, all) => {
    const value = +x.toFixed(4);
    if (i === 0 || i === all.length - 1) return String(value);
    return `${value} ${+((t / duration) * 100).toFixed(2)}%`;
  });
  const ms = Math.round(duration * 1000);
  return `  /* ${note}: damping ${spec.damping}, response ${spec.response}s */\n  --${name}: ${ms}ms linear(${stops.join(", ")});`;
}

console.log(
  [
    token("spring-smooth", { damping: 1, response: 0.3 }, "AnimationKit blurIn, critically damped"),
    token("spring", { damping: 0.8, response: 0.3 }, "AnimationKit liquidMorph"),
    token("spring-nav", { damping: 1, response: 0.3 }, "UIKit fluid navigation push and pop"),
  ].join("\n"),
);
