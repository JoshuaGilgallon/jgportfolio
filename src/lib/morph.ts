import { morph, Spring, type SpringSpec } from "./spring";

/** A rounded rectangle on screen: centre, size and corner radius, in CSS px. */
export type Frame = { cx: number; cy: number; w: number; h: number; r: number };

export function frameOf(rect: DOMRect, r: number): Frame {
  return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, w: rect.width, h: rect.height, r };
}

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

/**
 * Apple's liquid morph (a button growing into a menu or card, and back),
 * ported line for line from the Liquid Glass research library
 * (liquid_glass/include/liquid_glass/morph.hpp, `lg::MorphAnimation`), whose
 * spring values were read from AnimationKit's live MorphAnimationSettings.
 *
 * - The frame's position and size spring from the source to the target
 *   (grow 0.8/0.3, shrink 0.9/0.3), slightly under-damped, so it lands with a
 *   little follow-through.
 * - The old content blurs out (0.8/0.45) while the new content blurs in
 *   (1.0/0.3) 30 ms later.
 * - A "kick" impulse on a separate spring gives the size one soft bounce.
 * - Everything runs at AnimationKit's global speed, 0.7.
 *
 * Optional "pivot" mode is the library's flying variant: the shape first
 * heads for an intermediate frame on a J-shaped path (eject 0.75/0.5), then
 * is retargeted to the destination (absorb 0.8/0.7) with its velocity kept.
 */
export class MorphAnimation {
  private a!: Frame;
  private b!: Frame;
  private growing = false;
  private started = false;
  private delay = 0;
  private stage = 0;
  private fromSwitch = 0;
  pivot = false;

  private px = new Spring();
  private py = new Spring();
  private pw = new Spring();
  private ph = new Spring();
  private out = new Spring();
  private in = new Spring();
  private kick = new Spring();

  get expanded() {
    return this.growing;
  }

  /** Sets the source and target frames. Targets already in flight are updated in place. */
  setEnds(source: Frame, target: Frame) {
    this.a = source;
    this.b = target;
    if (!this.started) this.snap(false);
    else if (this.stage !== 1) this.setTargets(this.growing ? target : source);
  }

  snap(expanded: boolean) {
    this.growing = expanded;
    const f = expanded ? this.b : this.a;
    this.px.snap(f.cx);
    this.py.snap(f.cy);
    this.pw.snap(f.w);
    this.ph.snap(f.h);
    this.out.snap(expanded ? 1 : 0);
    this.in.snap(expanded ? 1 : 0);
    this.kick.snap(0);
    this.delay = 0;
  }

  /**
   * Moves the shape off its spring by (dx, dy) px, travelling at (vx, vy)
   * px/s of real time: e.g. where a finger let go of it. The springs carry
   * on from there with that velocity.
   */
  nudge(dx: number, dy: number, vx = 0, vy = 0) {
    this.px.x += dx;
    this.py.x += dy;
    this.px.v = vx / morph.speed;
    this.py.v = vy / morph.speed;
  }

  expand() {
    this.go(true);
  }

  collapse() {
    this.go(false);
  }

  update(seconds: number) {
    const dt = seconds * morph.speed;
    let spec: SpringSpec = this.growing ? morph.grow : morph.shrink;
    if (this.pivot && this.stage >= 1) {
      spec = this.stage === 1 ? pivot.eject : pivot.absorb;
      if (this.stage === 1) {
        const t = this.fromSwitch > 1e-3 ? 1 - Math.abs(this.py.x - this.py.target) / this.fromSwitch : 1;
        if (t >= 0.6) {
          this.stage = 2;
          this.setTargets(this.growing ? this.b : this.a);
        }
      }
    }
    this.px.step(dt, spec);
    this.py.step(dt, spec);
    this.pw.step(dt, spec);
    this.ph.step(dt, spec);
    this.out.step(dt, morph.blurOut);
    if (this.delay > 0) this.delay -= dt;
    else this.in.step(dt, morph.blurIn);
    this.kick.step(dt, this.growing ? morph.kickGrow : morph.kickShrink);
  }

  get animating() {
    const still =
      this.px.settled(0.01) &&
      this.py.settled(0.01) &&
      this.pw.settled(0.01) &&
      this.ph.settled(0.01) &&
      this.out.settled() &&
      this.in.settled() &&
      this.kick.settled();
    return !still || this.delay > 0;
  }

  /** 0 at the source frame, 1 at the target (may overshoot a little). */
  get progress() {
    const dw = this.b.w - this.a.w;
    const dh = this.b.h - this.a.h;
    if (Math.abs(dw) >= Math.abs(dh) && Math.abs(dw) > 1e-3) return (this.pw.x - this.a.w) / dw;
    if (Math.abs(dh) > 1e-3) return (this.ph.x - this.a.h) / dh;
    return this.in.x;
  }

  /** The morphing frame right now. */
  get shape(): Frame {
    const p = clamp(this.progress);
    const k = 1 + 0.06 * this.kick.x;
    const w = Math.max(2, this.pw.x * k);
    const h = Math.max(2, this.ph.x * k);
    const r = Math.min(this.a.r + (this.b.r - this.a.r) * p, Math.min(w, h) / 2);
    return { cx: this.px.x, cy: this.py.x, w, h, r };
  }

  /** How far the kick is from rest, as a fraction of the size. */
  get kickAmount() {
    return Math.abs(0.06 * this.kick.x);
  }

  // Content inside the shape: the old content blurs out, the new blurs in.
  get sourceOpacity() {
    return clamp(1 - this.out.x * 1.6);
  }
  get targetOpacity() {
    return clamp((this.in.x - 0.35) / 0.65);
  }
  /** 0..1, a fraction of the content's maximum blur. */
  get sourceBlur() {
    return clamp(this.out.x);
  }
  get targetBlur() {
    return clamp(1 - this.in.x);
  }

  private go(grow: boolean) {
    if (this.growing === grow && this.started) return;
    this.started = true;
    this.growing = grow;
    const to = grow ? this.b : this.a;
    this.setTargets(to);
    this.out.target = grow ? 1 : 0;
    this.in.target = grow ? 1 : 0;
    this.delay = morph.secondStepDelay;
    this.kick.v += grow ? 6 : -4;
    if (this.pivot) {
      // Stage 1: head for the intermediate frame on the J path.
      const from = this.shape;
      const ratio = grow ? pivot.growRatio : pivot.shrinkRatio;
      const dy = to.cy - from.cy;
      const jh = Math.abs(dy) > 1e-3 ? Math.min(pivot.maxJHeight, pivot.jHeightRatio * Math.abs(dy)) * Math.sign(dy) : 0;
      this.px.target = from.cx;
      this.py.target = from.cy + jh;
      this.pw.target = from.w + (to.w - from.w) * ratio;
      this.ph.target = from.h + (to.h - from.h) * ratio;
      this.fromSwitch = Math.abs(this.py.target - from.cy);
      this.stage = this.fromSwitch > 1e-3 ? 1 : 2;
      if (this.stage === 2) this.setTargets(to);
    } else this.stage = 0;
  }

  private setTargets(f: Frame) {
    this.px.target = f.cx;
    this.py.target = f.cy;
    this.pw.target = f.w;
    this.ph.target = f.h;
  }
}

/** AnimationKit's pivot ("flying") settings. */
const pivot = {
  eject: { damping: 0.75, response: 0.5 },
  absorb: { damping: 0.8, response: 0.7 },
  growRatio: 0.25,
  shrinkRatio: 0.9,
  jHeightRatio: 0.8,
  maxJHeight: 200,
};
