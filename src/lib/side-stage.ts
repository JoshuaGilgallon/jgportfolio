import { morph, Spring, type SpringSpec } from "./spring";

// what's left on the page while a project sits in the side pane on wide screens:
// the column slides aside, the grid closes ranks, and panes that get replaced sink away.
// lives outside react since one modal hands over to the next on every switch

// how much a card shrinks while it travels, like it's been picked up
const DIP = 0.03;
// cards crossing to another row blur out one end and in the other
const CROSS_BLUR = 10;
const EMERGE_SCALE = 0.94;
const EMERGE_BLUR = 8;
const RECEDE_SCALE = 0.92;
const RECEDE_BLUR = 12;

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const blur = (px: number) => (px < 0.3 ? "" : `blur(${px}px)`);

type Mover = { x: Spring; y: Spring; fade: Spring; emerging: boolean; delay: number };
// copy of a card leaving its row
type Trail = { el: HTMLElement; dx: number; from: number; p: Spring; delay: number };
type Layer = { el: HTMLElement; p: Spring };
type Spot = { left: number; top: number; row: number; index: number };
type Before = { grid: HTMLElement; cards: Map<HTMLElement, Spot>; height: number };

// the column, live so pages mounting mid shift are picked up
let pages: HTMLCollectionOf<HTMLElement> | null = null;

const cardsOf = (grid: HTMLElement) =>
  [...grid.children].filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute("data-morph-source"),
  );

class Stage {
  private shift = new Spring();
  private shiftSpec: SpringSpec = morph.grow;
  private claimed = false;
  private movers = new Map<HTMLElement, Mover>();
  private trails: Trail[] = [];
  private layers: Layer[] = [];
  private height: { grid: HTMLElement; s: Spring } | null = null;
  private pitch = 1;
  private before: Before | null = null;
  private instant = false;
  private lifting = false;
  private emerging = new Set<HTMLElement>();
  // grid with scroll anchoring off while it changes
  private anchorless: HTMLElement | null = null;
  private frame = 0;
  private last = 0;

  // slide the column aside, px
  claim(px: number, instant = false) {
    this.claimed = true;
    this.shiftSpec = morph.grow;
    this.shift.target = px;
    if (instant) this.shift.snap(px);
    this.run();
  }

  // a frame later by default so the next pane can claim it first
  release({ instant = false, now = false } = {}) {
    this.claimed = false;
    const go = () => {
      if (this.claimed) return;
      this.shiftSpec = morph.shrink;
      this.shift.target = 0;
      if (instant) this.shift.snap(0);
      this.run();
    };
    if (now) go();
    else requestAnimationFrame(go);
  }

  // takes a card out of the grid, the rest close up
  lift(card: HTMLElement, instant = false) {
    const grid = card.parentElement;
    if (!grid) return;
    this.capture(grid, instant);
    this.lifting = true;
    this.forget(card);
    card.dataset.lifted = "";
  }

  // puts it back. emerge fades it in, otherwise a pane is about to land on it
  drop(card: HTMLElement, { emerge = false, instant = false } = {}) {
    const grid = card.parentElement;
    if (!grid) return;
    this.capture(grid, instant);
    delete card.dataset.lifted;
    if (emerge) this.emerging.add(card);
  }

  // sinks a copy of a pane that's been replaced or left behind
  recede(el: HTMLElement) {
    el.style.zIndex = "29";
    this.layers.push({ el, p: new Spring(0, 0, 1) });
    this.run();
  }

  // grid before any changes this task, committed together in a microtask
  private capture(grid: HTMLElement, instant: boolean) {
    this.instant ||= instant;
    if (this.before) return;
    // otherwise the page scrolls to follow whichever card it anchored to
    grid.style.overflowAnchor = "none";
    this.anchorless = grid;
    const cards = new Map<HTMLElement, Spot>();
    let index = 0;
    for (const el of cardsOf(grid)) {
      if ("lifted" in el.dataset) continue;
      const m = this.movers.get(el);
      cards.set(el, {
        left: el.offsetLeft + (m?.x.x ?? 0),
        top: el.offsetTop + (m?.y.x ?? 0),
        row: el.offsetTop,
        index: index++,
      });
    }
    const height = this.height?.grid === grid ? this.height.s.x : grid.offsetHeight;
    this.before = { grid, cards, height };
    queueMicrotask(() => this.commit());
  }

  private commit() {
    const before = this.before;
    const instant = this.instant;
    const lead = this.lifting ? morph.shuffleLead : 0;
    const emerging = this.emerging;
    this.before = null;
    this.instant = false;
    this.lifting = false;
    this.emerging = new Set();
    if (!before) return;

    const { grid } = before;
    grid.style.height = "";
    const cards = cardsOf(grid).filter((el) => !("lifted" in el.dataset));
    if (cards.length > 1 && cards[1].offsetTop === cards[0].offsetTop) {
      this.pitch = cards[1].offsetLeft - cards[0].offsetLeft;
    } else if (cards.length) this.pitch = cards[0].offsetWidth;

    // ripple out from the first card that changed
    const origin = cards.findIndex((el, i) => before.cards.get(el)?.index !== i);

    cards.forEach((el, i) => {
      const was = before.cards.get(el);
      const resting = !this.movers.has(el);
      const m = this.movers.get(el) ?? { x: new Spring(), y: new Spring(), fade: new Spring(1, 0, 1), emerging: false, delay: 0 };

      if (was && was.index !== i) {
        if (resting) m.delay = lead + morph.shuffleStagger * Math.max(0, i - origin);
        if (Math.abs(was.row - el.offsetTop) > 1) {
          // across a row: the old one carries on out, a new one slides in from the other side
          const dir = i < was.index ? -1 : 1;
          this.leave(grid, el, was, dir * this.pitch, m);
          m.x.snap(-dir * this.pitch);
          m.y.snap(0);
          m.fade.snap(0);
          m.emerging = false;
        } else {
          // keeps any speed it already had
          m.x.x = was.left - el.offsetLeft;
          m.y.x = was.top - el.offsetTop;
        }
        m.x.target = 0;
        m.y.target = 0;
        m.fade.target = 1;
      }

      if (emerging.has(el)) {
        m.fade.snap(0);
        m.fade.target = 1;
        m.emerging = true;
        m.delay = Math.max(m.delay, morph.emergeDelay);
      }

      if (this.movers.has(el) || m.x.x !== 0 || m.y.x !== 0 || m.fade.x !== 1) this.movers.set(el, m);
    });

    // the content below follows the grid's height
    const height = grid.offsetHeight;
    if (Math.abs(before.height - height) > 0.5) {
      const s = this.height?.grid === grid ? this.height.s : new Spring(before.height);
      s.x = before.height;
      s.target = height;
      this.height = { grid, s };
    }

    if (instant) this.settleAll();
    this.run();
  }

  private leave(grid: HTMLElement, el: HTMLElement, was: Spot, dx: number, m: Mover) {
    const copy = document.createElement("div");
    copy.className = el.className;
    copy.append(...el.cloneNode(true).childNodes);
    copy.setAttribute("aria-hidden", "true");
    copy.inert = true;
    copy.style.cssText =
      `position:absolute;left:${was.left}px;top:${was.top}px;margin:0;pointer-events:none;` +
      `width:${el.offsetWidth}px;height:${el.offsetHeight}px`;
    grid.append(copy);
    const from = m.emerging ? clamp(m.fade.x) : clamp((m.fade.x - 0.2) / 0.8);
    this.trails.push({ el: copy, dx, from, p: new Spring(0, 0, 1), delay: m.delay });
  }

  private forget(el: HTMLElement) {
    this.movers.delete(el);
    el.style.transform = el.style.opacity = el.style.filter = "";
  }

  private settleAll() {
    for (const el of [...this.movers.keys()]) this.forget(el);
    for (const t of this.trails) t.el.remove();
    this.trails = [];
    if (this.height) this.height.grid.style.height = "";
    this.height = null;
  }

  private run() {
    this.render();
    if (this.frame) return;
    if (this.busy()) {
      this.last = 0;
      this.frame = requestAnimationFrame(this.tick);
    } else this.rest();
  }

  private rest() {
    if (this.before || !this.anchorless) return;
    this.anchorless.style.overflowAnchor = "";
    this.anchorless = null;
  }

  private busy() {
    return (
      !this.shift.settled(0.05) ||
      this.movers.size > 0 ||
      this.trails.length > 0 ||
      this.layers.length > 0 ||
      this.height !== null
    );
  }

  private tick = (now: number) => {
    const dt = (this.last ? Math.min((now - this.last) / 1000, 1 / 30) : 1 / 60) * morph.speed;
    this.last = now;
    this.shift.step(dt, this.shiftSpec);

    for (const [el, m] of this.movers) {
      if (m.delay > 0) {
        m.delay -= dt;
        continue;
      }
      m.x.step(dt, morph.shuffle);
      m.y.step(dt, morph.shuffle);
      m.fade.step(dt, m.emerging ? morph.emerge : morph.shuffle);
      if (m.x.settled(0.05) && m.y.settled(0.05) && m.fade.settled(1e-3)) this.forget(el);
    }

    this.trails = this.trails.filter((t) => {
      if (t.delay > 0) t.delay -= dt;
      else t.p.step(dt, morph.shuffle);
      const gone = t.p.x > 0.98 || t.from * (1 - t.p.x * 1.6) <= 0;
      if (gone) t.el.remove();
      return !gone;
    });

    this.layers = this.layers.filter((l) => {
      l.p.step(dt, morph.recede);
      const gone = l.p.x > 0.995;
      if (gone) l.el.remove();
      return !gone;
    });

    if (this.height) {
      this.height.s.step(dt, morph.shuffle);
      if (this.height.s.settled(0.1)) {
        this.height.grid.style.height = "";
        this.height = null;
      }
    }

    this.render();
    this.frame = this.busy() ? requestAnimationFrame(this.tick) : 0;
    if (!this.frame) this.rest();
  };

  private render() {
    const root = document.documentElement;
    // straight onto each .page, a property on the root would restyle the whole document every frame
    pages ??= document.getElementsByClassName("page") as HTMLCollectionOf<HTMLElement>;
    if (this.shift.settled(0.05) && this.shift.target === 0) {
      this.shift.snap(0);
      if ("shift" in root.dataset) delete root.dataset.shift;
      for (const el of pages) if (el.style.translate) el.style.translate = "";
    } else {
      if (!("shift" in root.dataset)) root.dataset.shift = "";
      const translate = `${this.shift.x}px 0`;
      for (const el of pages) el.style.translate = translate;
    }

    const pitch = Math.max(1, this.pitch);
    for (const [el, m] of this.movers) {
      const f = clamp(m.fade.x);
      let scale = 1 - DIP * Math.min(1, Math.hypot(m.x.x, m.y.x) / pitch);
      if (m.emerging) scale *= EMERGE_SCALE + (1 - EMERGE_SCALE) * f;
      el.style.transform = `translate3d(${m.x.x}px,${m.y.x}px,0) scale(${scale})`;
      el.style.opacity = f < 1 ? String(m.emerging ? f : clamp((f - 0.2) / 0.8)) : "";
      el.style.filter = blur((1 - f) * (m.emerging ? EMERGE_BLUR : CROSS_BLUR));
    }

    for (const t of this.trails) {
      const p = clamp(t.p.x);
      t.el.style.transform = `translate3d(${t.dx * p}px,0,0) scale(${1 - DIP * p})`;
      t.el.style.opacity = String(t.from * clamp(1 - p * 1.6));
      t.el.style.filter = blur(p * CROSS_BLUR);
    }

    for (const l of this.layers) {
      const p = clamp(l.p.x);
      l.el.style.transform = `scale(${1 - (1 - RECEDE_SCALE) * p})`;
      l.el.style.opacity = String(1 - p);
      l.el.style.filter = blur(p * RECEDE_BLUR);
    }

    if (this.height) this.height.grid.style.height = `${this.height.s.x}px`;
  }
}

export const stage = new Stage();
