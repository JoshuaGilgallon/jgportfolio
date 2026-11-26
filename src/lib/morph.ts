import { morph, Spring, type SpringSpec } from "./spring";

// centre, size and radius in css px
export type Frame = { cx: number; cy: number; w: number; h: number; r: number };

export function frameOf(rect: DOMRect, r: number): Frame {
  return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, w: rect.width, h: rect.height, r };
}

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

// springs a shape between two frames while the content crossfades.
// pivot mode flies it along a j shaped path first
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

  // retargets if already moving
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

  // offset by a drag, keeping its velocity
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
    this.kick.step(dt, morph.kickShrink);
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

  // 0 to 1, can overshoot
  get progress() {
    const dw = this.b.w - this.a.w;
    const dh = this.b.h - this.a.h;
    if (Math.abs(dw) >= Math.abs(dh) && Math.abs(dw) > 1e-3) return (this.pw.x - this.a.w) / dw;
    if (Math.abs(dh) > 1e-3) return (this.ph.x - this.a.h) / dh;
    return this.in.x;
  }

  get shape(): Frame {
    const p = clamp(this.progress);
    const k = 1 + 0.06 * this.kick.x;
    const w = Math.max(2, this.pw.x * k);
    const h = Math.max(2, this.ph.x * k);
    const r = Math.min(this.a.r + (this.b.r - this.a.r) * p, Math.min(w, h) / 2);
    return { cx: this.px.x, cy: this.py.x, w, h, r };
  }

  get kickAmount() {
    return Math.abs(0.06 * this.kick.x);
  }

  get sourceOpacity() {
    return clamp(1 - this.out.x * 1.6);
  }
  get targetOpacity() {
    return clamp((this.in.x - 0.35) / 0.65);
  }
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
    if (!grow) this.kick.v -= 4;
    if (this.pivot) {
      // head to the midpoint first
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

const pivot = {
  eject: { damping: 0.75, response: 0.5 },
  absorb: { damping: 0.8, response: 0.7 },
  growRatio: 0.25,
  shrinkRatio: 0.9,
  jHeightRatio: 0.8,
  maxJHeight: 200,
};
