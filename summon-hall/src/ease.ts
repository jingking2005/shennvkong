/**
 * 缓动函数 — 真实物理曲线
 */

export const Ease = {
  linear: (t: number) => t,
  outQuad: (t: number) => t * (2 - t),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  outQuint: (t: number) => 1 - Math.pow(1 - t, 5),
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t: number) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    const c = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
  },
  outBounce: (t: number) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

/** 通用补间 */
export interface Tween {
  from: number; to: number; dur: number; delay: number;
  ease: (t: number) => number;
  onUpdate: (v: number) => void;
  onDone?: () => void;
  t: number; started: boolean; done: boolean;
}

export class Tweener {
  private list: Tween[] = [];

  add(cfg: Omit<Tween, 't' | 'started' | 'done'>): void {
    this.list.push({ ...cfg, t: 0, started: false, done: false });
  }

  update(dt: number): void {
    for (const tw of this.list) {
      if (tw.done) continue;
      tw.t += dt;
      const local = tw.t - tw.delay;
      if (local < 0) continue;
      tw.started = true;
      const p = Math.min(1, local / tw.dur);
      tw.onUpdate(tw.from + (tw.to - tw.from) * tw.ease(p));
      if (p >= 1) { tw.done = true; tw.onDone?.(); }
    }
    this.list = this.list.filter(t => !t.done);
  }

  clear(): void { this.list = []; }
}
