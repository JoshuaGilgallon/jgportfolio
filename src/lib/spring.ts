/**
 * Apple's spring, as used by UIKit and AnimationKit, ported from the
 * Liquid Glass research library (liquid_glass/include/liquid_glass/flex.hpp,
 * `lg::Spring1`).
 *
 * A spring is described UIKit style, by a damping ratio and a response time
 * in seconds: omega = 2π / response, stiffness k = omega², damping
 * c = 2·ζ·omega, mass 1. It is integrated with semi-implicit Euler at 240 Hz,
 * exactly like the original, so the CSS easings sampled from it (see
 * scripts/springs.ts) and the JavaScript-driven morph move identically.
 */

export type SpringSpec = { damping: number; response: number };

export class Spring {
  constructor(
    public x = 0,
    public v = 0,
    public target = 0,
  ) {}

  step(dt: number, { damping, response }: SpringSpec) {
    const w = (2 * Math.PI) / response;
    const k = w * w;
    const c = 2 * damping * w;
    const n = Math.max(1, Math.ceil(dt * 240));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (-k * (this.x - this.target) - c * this.v) * h;
      this.x += this.v * h;
    }
  }

  settled(eps = 2e-4) {
    return Math.abs(this.x - this.target) < eps && Math.abs(this.v) < 5e-3;
  }

  snap(value: number) {
    this.x = this.target = value;
    this.v = 0;
  }
}

/**
 * Live defaults of AnimationKit's MorphAnimationSettings (macOS 27), read
 * from the running system; see research_morph/MORPH_ANIMATION.md.
 */
export const morph = {
  /** Global time scale: every morph runs at 0.7× real time. */
  speed: 0.7,
  /** Button → menu: position and size. */
  grow: { damping: 0.8, response: 0.3 },
  /** Menu → button. */
  shrink: { damping: 0.9, response: 0.3 },
  /** Old content blurs away. */
  blurOut: { damping: 0.8, response: 0.45 },
  /** New content blurs in, a beat later. */
  blurIn: { damping: 1, response: 0.3 },
  secondStepDelay: 0.03,
  kickGrow: { damping: 0.8, response: 0.35 },
  kickShrink: { damping: 0.8, response: 0.5 },
} satisfies Record<string, SpringSpec | number>;
