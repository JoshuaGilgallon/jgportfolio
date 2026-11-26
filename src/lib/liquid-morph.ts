import { Spring, type SpringSpec } from "./spring";
import type { Frame } from "./morph";

// button to menu morph with two blobs: the body grows into the menu while
// the ghost (the button) shrinks away. values measured from ios.
// no lens displacement, only its blur

const P = {
  A: { damping: 0.749, response: 0.351 },
  B: { damping: 0.87, response: 0.231 },
  // vertical overshoot
  kick: { damping: 0.686, response: 0.343 },
  kickRatio: 0.84,
  kickMax: 200,
  kickWidth: 0.085,
  closeA: { damping: 0.851, response: 0.449 },
  closeB: { damping: 0.688, response: 0.583 },
  // kick towards the menu
  closeKick: { damping: 0.833, response: 0.383 },
  closeKickRatio: 5.257,
  closeKickWidth: 0.0187,
  // nudge the button the other way
  ghostKick: { damping: 0.744, response: 0.505 },
  ghostKickRatio: -0.33,
  ghostKickWidth: 0.146,
  rad: { damping: 0.8, response: 0.28 },
  radTrigger: 0.97,
  // blur while the blobs merge
  gaussSigma: 14,
  gaussTime: 0.27,
  closeGaussSigma: 7.27,
  closeGaussTime: 0.414,
  // start and end circles
  bodyStart: 0.5,
  ghostEnd: 0.25,
  ghostDist: 0.25,
  delay: 0.0063,
  contentDelay: 0.0085,
  closeContent: { damping: 0.816, response: 0.47 },
} satisfies Record<string, SpringSpec | number>;

// lens blur per frame at 60fps, opening then closing
const LENS_BLUR = [0, 1.06, 1.77, 2.38, 2.85, 3.03, 2.88, 2.55, 2.13, 1.71, 1.32, 0.97, 0.69, 0.46, 0.29, 0.17, 0.08, 0, 0, 0, 0];
const LENS_BLUR_CLOSE = [0, 0.49, 1.2, 1.9, 2.48, 2.75, 2.68, 2.41, 2.05, 1.66, 1.29, 0.97, 0.69, 0.47, 0.3, 0.18, 0.09, 0, 0, 0, 0];

function tab(v: number[], t: number) {
  const f = t / 0.016667;
  const i = Math.trunc(f);
  if (i >= 20) return v[20] * Math.exp(-(f - 20) * 0.17);
  const x = f - i;
  return v[i] * (1 - x) + v[i + 1] * x;
}

class Blob {
  cx = new Spring();
  cy = new Spring();
  w = new Spring();
  h = new Spring();
  set(f: Frame) {
    this.cx.snap(f.cx);
    this.cy.snap(f.cy);
    this.w.snap(f.w);
    this.h.snap(f.h);
  }
  target(f: Frame) {
    this.cx.target = f.cx;
    this.cy.target = f.cy;
    this.w.target = f.w;
    this.h.target = f.h;
  }
  frame(yKick: number): Frame {
    const w = Math.max(2, this.w.x);
    const h = Math.max(2, this.h.x);
    return { cx: this.cx.x, cy: this.cy.x + yKick, w, h, r: Math.min(w, h) / 2 };
  }
  settled(eps: number) {
    return this.cx.settled(eps) && this.cy.settled(eps) && this.w.settled(eps) && this.h.settled(eps);
  }
}

const circle = (cx: number, cy: number, d: number): Frame => ({ cx, cy, w: d, h: d, r: d / 2 });
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export class LiquidMorph {
  private a!: Frame;
  private b!: Frame;
  private open = false;
  private started = false;
  private moving = false;
  private radOn = false;
  private delay = 0;
  private t = 0;
  private kickT = 1e9;
  private kickK = 0;
  private gkickK = 0;
  private body = new Blob();
  private ghost = new Blob();
  private kick = new Spring();
  private gkick = new Spring();
  private rf = new Spring(1, 0, 1);
  private cp = new Spring();

  setEnds(trigger: Frame, menu: Frame) {
    this.a = trigger;
    this.b = menu;
    if (!this.started) this.snap(false);
  }

  get expanded() {
    return this.open;
  }

  get animating() {
    return this.moving;
  }

  expand() {
    this.go(true);
  }

  collapse() {
    this.go(false);
  }

  snap(open: boolean) {
    this.cp.snap(open ? 1 : 0);
    this.open = open;
    this.started = true;
    this.moving = false;
    this.radOn = false;
    this.t = 0;
    this.kickT = 1e9;
    this.kick.snap(0);
    this.gkick.snap(0);
    this.rf.snap(this.restRadiusFactor(open));
    this.body.set(open ? this.b : this.bodyStart());
    this.ghost.set(open ? this.ghostEnd() : this.a);
  }

  update(seconds: number) {
    let dt = seconds;
    if (!this.moving) return;
    if (this.delay > 0) {
      this.delay -= dt;
      if (this.delay > 0) return;
      dt = -this.delay;
      this.delay = 0;
      if (dt <= 0) return;
    }
    this.t += dt;
    this.kickT += dt;
    const o = this.open;
    const A = o ? P.A : P.closeA;
    const B = o ? P.B : P.closeB;
    const { body, ghost } = this;
    body.cx.step(dt, A);
    body.cy.step(dt, A);
    body.w.step(dt, A);
    body.h.step(dt, B);
    ghost.cx.step(dt, A);
    ghost.cy.step(dt, A);
    ghost.w.step(dt, B);
    ghost.h.step(dt, A);
    if (o) {
      this.kick.target = this.kickT < P.kickWidth ? this.kickK : 0;
      this.kick.step(dt, P.kick);
    } else {
      this.kick.target = this.kickT < P.closeKickWidth ? this.kickK : 0;
      this.kick.step(dt, P.closeKick);
      this.gkick.target = this.kickT < P.ghostKickWidth ? this.gkickK : 0;
      this.gkick.step(dt, P.ghostKick);
    }
    if (o) {
      if (this.t >= P.contentDelay) this.cp.step(dt, A);
    } else this.cp.step(dt, P.closeContent);
    if (o && !this.radOn && this.progress >= P.radTrigger) {
      this.radOn = true;
      this.rf.target = this.restRadiusFactor(true);
    }
    if (this.radOn || !o) this.rf.step(dt, P.rad);
    if (!this.live()) this.moving = false;
  }

  // 0 to 1 by width, can overshoot
  get progress() {
    const d = this.b.w - this.bodyStart().w;
    return Math.abs(d) < 1e-3 ? 1 : (this.body.w.x - this.bodyStart().w) / d;
  }

  // r is the corner radius
  get bodyFrame(): Frame {
    if (!this.moving) return this.open ? this.b : this.bodyStart();
    const f = this.body.frame(this.kick.x);
    f.r = (Math.min(this.rf.x, 1) * Math.min(f.w, f.h)) / 2;
    return f;
  }

  get ghostFrame(): Frame {
    if (!this.moving) return this.open ? this.ghostEnd() : this.a;
    return this.ghost.frame(this.gkick.x);
  }

  // 0 = capsule, 1 = menu corners
  get cornerProgress() {
    const rest = this.restRadiusFactor(true);
    return rest >= 1 ? 1 : clamp((1 - this.rf.x) / (1 - rest), 0, 1);
  }

  // 0 once the blobs stop blurring
  get gaussSigma() {
    if (!this.moving) return 0;
    return this.open ? (this.t < P.gaussTime ? P.gaussSigma : 0) : this.t < P.closeGaussTime ? P.closeGaussSigma : 0;
  }

  // content crossfade, can overshoot
  get contentProgress() {
    return this.moving ? this.cp.x : this.open ? 1 : 0;
  }

  get lensBlur() {
    return this.moving ? tab(this.open ? LENS_BLUR : LENS_BLUR_CLOSE, this.t) : 0;
  }

  private restRadiusFactor(open: boolean) {
    return open ? Math.min(1, this.b.r / Math.max(1, Math.min(this.b.w, this.b.h) / 2)) : 1;
  }

  private bodyStart() {
    return circle(this.a.cx, this.a.cy, Math.min(this.a.w, this.a.h) * P.bodyStart);
  }

  private ghostEnd() {
    const { a, b } = this;
    return circle(a.cx + P.ghostDist * (b.cx - a.cx), a.cy + P.ghostDist * (b.cy - a.cy), Math.min(a.w, a.h) * P.ghostEnd);
  }

  private go(o: boolean) {
    if (!this.started) this.snap(false);
    if (o === this.open && !this.moving && (o ? this.body.w.target === this.b.w : this.ghost.w.target === this.a.w)) return;
    if (!this.moving) {
      // start from rest
      this.body.set(o ? this.bodyStart() : this.b);
      this.ghost.set(o ? this.a : this.ghostEnd());
    }
    this.cp.target = o ? 1 : 0;
    if (!this.moving) this.cp = new Spring(o ? 0 : 1, 0, o ? 1 : 0);
    this.open = o;
    this.moving = true;
    this.t = 0;
    this.delay = P.delay;
    this.body.target(o ? this.b : this.bodyStart());
    this.ghost.target(o ? this.ghostEnd() : this.a);
    const dy = this.b.cy - this.a.cy;
    this.kick.snap(0);
    this.kickT = 0;
    if (o) {
      this.kickK = clamp(P.kickRatio * dy, -P.kickMax, P.kickMax);
      this.radOn = false;
      this.rf.snap(1);
    } else {
      this.gkick.snap(0);
      this.kickK = clamp(P.closeKickRatio * dy, -P.kickMax * 6, P.kickMax * 6);
      this.gkickK = P.ghostKickRatio * dy;
      this.radOn = false;
      this.rf.target = 1;
    }
  }

  private live() {
    return (
      !this.body.settled(0.02) ||
      !this.ghost.settled(0.02) ||
      !this.cp.settled(0.002) ||
      !this.rf.settled(0.002) ||
      !this.kick.settled(0.02) ||
      !this.gkick.settled(0.02)
    );
  }
}
