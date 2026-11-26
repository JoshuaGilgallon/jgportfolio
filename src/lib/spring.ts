// damped spring, semi-implicit euler at 240hz

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

export const morph = {
  speed: 0.7,
  // slightly stiffer so it doesn't overshoot
  grow: { damping: 1, response: 0.26 },
  shrink: { damping: 0.9, response: 0.3 },
  blurOut: { damping: 0.8, response: 0.45 },
  blurIn: { damping: 1, response: 0.3 },
  secondStepDelay: 0.03,
  kickShrink: { damping: 0.8, response: 0.5 },
  // cancelled pull to dismiss
  pullBack: { damping: 0.8, response: 0.3 },
  // wide screens: cards closing or opening a gap, a touch of settle
  shuffle: { damping: 0.82, response: 0.32 },
  // gap between each card setting off, outwards from the change
  shuffleStagger: 0.022,
  // lets the pane clear the slot before its neighbours slide in
  shuffleLead: 0.05,
  // a card coming back into the grid, and the pane it left
  emerge: { damping: 1, response: 0.34 },
  emergeDelay: 0.06,
  recede: { damping: 1, response: 0.4 },
} satisfies Record<string, SpringSpec | number>;
