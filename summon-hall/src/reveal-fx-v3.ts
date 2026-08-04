// ============================================================================
// reveal-fx-v3.ts —— LR/VR 揭晓前景特效（移植自 demo-lr-vr-v3，独立模块）
//
// 设计边界：
//  - 只做「前景」：卡片入场 + 粒子 + 光效层（叠加在生产背景之上）
//  - 不替换生产背景（drawVrHeaven / drawLrSun 原样保留）
//  - 不播放任何音效（生产 onRevealCard 的音效保持原样）
//  - 卡面绘制通过回调复用生产 drawCard / drawCardBack
//  - 时间轴由 revealLocal(0..1) 驱动，点击跳过/快速跳过行为与旧版一致；
//    粒子等连续动画使用独立的 fxT（支持 LR 慢动作窗，仅影响视觉）
//  - 全部参数模块化（CFG）；性能：贴图预渲染、粒子上限、一次性事件
// ============================================================================

import type { Card } from './data';
import { Ease } from './ease';

export type RevealFxRarity = 'VR' | 'LR';

const W = 1280;
const H = 760;
const TAU = Math.PI * 2;

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/* ---------------- CFG：模块化参数（与 demo v3 同构） ---------------- */
const CFG = {
  maxParticles: 420,
  card: { w: 240, h: 340 },
  circle: { R: 215, altarY: 0.72, runes: 20, spin: 0.5, spinInner: -0.8 },
  VR: {
    col: { main: '#a9ccff', glow: '#eaf4ff' },
    label: 'VERY RARE', sub: '氷 晶 の 恵 み',
    solidAt: 0.8,          // 实体化时刻：前 80% 幽灵渐显，最后 1 秒爆发
    burst: { n: 120, speed: 300 },
    star: 34, ice: 22, meteor: 0, smoke: 0,
    rings: 2, ringCol: '#9fc6ff',
    lensFlare: 0.35, rays: 10, rayAlpha: 0.12,
    punch: 1.05, flashV: 0.5, slowmo: 0, dust: 0.15,
    halo: { w: 70, col: '#bfe0ff' },
    hue: 215,
  },
  LR: {
    col: { main: '#ffd77a', glow: '#fff6d8' },
    label: 'LEGEND RARE', sub: '神 代 の 輝 き',
    solidAt: 0.8,
    burst: { n: 260, speed: 520 },
    star: 78, ice: 0, meteor: 38, smoke: 12,
    rings: 4, ringCol: '#ffdf9a',
    lensFlare: 0.95, rays: 14, rayAlpha: 0.22,
    punch: 1.09, flashV: 1.0, slowmo: 0.45, dust: 0.3,
    halo: { w: 90, col: '#ffe9b0' },
    hue: 45,
  },
};

/* ---------------- 预渲染贴图（性能优化） ---------------- */
function makeSprite(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  return c;
}

const SPR = {
  glow: makeSprite(256, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.35, 'rgba(255,255,255,.42)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  }),
  star: makeSprite(64, (g, s) => {
    g.translate(s / 2, s / 2);
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      g.rotate(Math.PI / 2);
      g.moveTo(0, 0);
      g.quadraticCurveTo(2.5, 2.5, 0, s / 2);
      g.quadraticCurveTo(-2.5, 2.5, 0, 0);
    }
    g.fill();
  }),
  hex: makeSprite(48, (g, s) => {
    g.translate(s / 2, s / 2);
    g.strokeStyle = 'rgba(215,238,255,.95)';
    g.lineWidth = 2.5;
    g.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i * Math.PI) / 3;
      g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * s * 0.42, Math.sin(a) * s * 0.42);
    }
    g.stroke();
    g.strokeStyle = 'rgba(150,205,255,.5)';
    g.beginPath();
    g.moveTo(-s * 0.42, 0); g.lineTo(s * 0.42, 0);
    g.moveTo(0, -s * 0.42); g.lineTo(0, s * 0.42);
    g.stroke();
  }),
};

/* ---------------- 粒子（随机速度/大小/透明度/生命周期） ---------------- */
interface P {
  type: string;
  x: number; y: number; px?: number; py?: number;
  vx?: number; vy?: number;
  tx?: number; ty?: number; v?: number; vMax?: number;
  ang?: number; av?: number; r?: number; dr?: number; rise?: number;
  cx?: number; cy?: number;
  drag?: number; grav?: number;
  life: number; age: number; size: number; alpha: number;
  rot?: number; vr?: number; seed?: number; tw?: number; grow?: number; growT?: number;
  color?: string;
}

interface Ribbon {
  cx: number; cy: number; age: number; life: number;
  r0: number; r1: number; a0: number; sweep: number; w: number; hueOff: number;
}
interface Wave {
  cx: number; cy: number; col: string; maxR: number; w: number; delay: number; age: number; life: number;
}

export class RevealFxV3 {
  private P: P[] = [];
  private RIB: Ribbon[] = [];
  private WAV: Wave[] = [];
  private fxT = 0;
  private timeScale = 1;
  private burstFired = false;
  private flashFired = false;
  private zoom = 1;
  private zoomT = 1;
  private raysA = 0;
  private flareA = 0;
  private circleP = 0;
  /** 随机元素（火/水/电/风）：每次揭示开始时随机一种，全屏撒下 */
  private element: 'fire' | 'water' | 'bolt' | 'wind' = 'fire';
  private elementReady = false;

  /** 卡背/卡面绘制回调（复用生产实现） */
  drawBack: ((ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, col: string, t: number, p: number) => void) | null = null;
  drawFront: ((ctx: CanvasRenderingContext2D, card: Card, cx: number, cy: number, w: number, h: number) => void) | null = null;
  /** LR 强闪光回调（写生产 flashV/flashColor） */
  onFlash: ((v: number) => void) | null = null;

  reset(): void {
    this.P.length = 0;
    this.RIB.length = 0;
    this.WAV.length = 0;
    this.fxT = 0;
    this.timeScale = 1;
    this.burstFired = false;
    this.flashFired = false;
    this.zoom = 1;
    this.zoomT = 1;
    this.raysA = 0;
    this.flareA = 0;
    this.circleP = 0;
    this.elementReady = false;
  }

  /* ---------- 粒子 ---------- */
  private spawn(o: P): void {
    const p = { ...o, age: o.age ?? 0, size: o.size ?? 10 };
    if (this.P.length < CFG.maxParticles) this.P.push(p);
  }

  private stepP(dt: number): void {
    for (let i = this.P.length - 1; i >= 0; i--) {
      const p = this.P[i];
      p.age += dt;
      if (p.age >= p.life) { this.P.splice(i, 1); continue; }
      switch (p.type) {
        case 'converge': {
          const dx = (p.tx ?? 0) - p.x, dy = (p.ty ?? 0) - p.y, d = Math.hypot(dx, dy) || 1;
          const v = Math.min(p.vMax ?? 0, (p.v ?? 0) + (p.vMax ?? 0) * dt * 3);
          p.v = v;
          p.x += (dx / d) * v * dt;
          p.y += (dy / d) * v * dt;
          break;
        }
        case 'vortex': {
          p.ang = (p.ang ?? 0) + (p.av ?? 0) * dt;
          p.r = (p.r ?? 0) - (p.dr ?? 0) * dt;
          p.x = (p.cx ?? 0) + Math.cos(p.ang ?? 0) * (p.r ?? 0);
          p.y = (p.cy ?? 0) + Math.sin(p.ang ?? 0) * (p.r ?? 0) * 0.55 - (p.rise ?? 0) * p.age;
          if ((p.r ?? 0) < 6) p.age = p.life;
          break;
        }
        case 'burst': {
          p.x += (p.vx ?? 0) * dt;
          p.y += (p.vy ?? 0) * dt;
          const dr = 1 - (p.drag ?? 0) * dt;
          p.vx = (p.vx ?? 0) * dr;
          p.vy = (p.vy ?? 0) * dr;
          p.vy = (p.vy ?? 0) + (p.grav ?? 0) * dt;
          break;
        }
        case 'meteor': {
          p.px = p.x; p.py = p.y;
          p.x += (p.vx ?? 0) * dt;
          p.y += (p.vy ?? 0) * dt;
          break;
        }
        case 'ice': {
          p.y -= (p.v ?? 0) * dt;
          p.x += Math.sin(p.age * 2 + (p.seed ?? 0)) * 14 * dt;
          p.rot = (p.rot ?? 0) + (p.vr ?? 0) * dt;
          break;
        }
        case 'dust': {
          p.x += (p.vx ?? 0) * dt;
          p.y += (p.vy ?? 0) * dt;
          break;
        }
        case 'smoke': {
          p.x += (p.vx ?? 0) * dt;
          p.y += (p.vy ?? 0) * dt;
          p.vx = (p.vx ?? 0) * (1 - 0.6 * dt);
          p.vy = (p.vy ?? 0) * (1 - 0.6 * dt);
          p.grow = (p.grow ?? 0) + ((p.growT ?? 0) - (p.grow ?? 0)) * dt;
          break;
        }
        case 'star': break;
        case 'fire': {
          p.x += (p.vx ?? 0) * dt + Math.sin(p.age * 3 + (p.seed ?? 0)) * 36 * dt;
          p.y += (p.vy ?? 0) * dt;
          break;
        }
        case 'water': {
          p.x += (p.vx ?? 0) * dt;
          p.y += (p.vy ?? 0) * dt;
          break;
        }
        case 'bolt': {
          p.x += (p.vx ?? 0) * dt;
          p.y += (p.vy ?? 0) * dt;
          break;
        }
        case 'wind': {
          p.x += (p.vx ?? 0) * dt;
          p.y += Math.sin(p.age * 2.4 + (p.seed ?? 0)) * 34 * dt;
          break;
        }
      }
    }
  }

  private drawSprite(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, scale: number, alpha: number, rot?: number): void {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(img, (-img.width / 2) * scale, (-img.height / 2) * scale, img.width * scale, img.height * scale);
    ctx.restore();
  }

  private glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number): void {
    if (alpha <= 0 || r <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(alpha, 0, 1);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private drawP(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.P) {
      const lt = p.age / p.life;
      const a = (lt < 0.15 ? lt / 0.15 : 1 - (lt - 0.15) / 0.85) * p.alpha;
      if (a <= 0) continue;
      switch (p.type) {
        case 'converge': case 'vortex': case 'burst':
          this.drawSprite(ctx, SPR.glow, p.x, p.y, p.size / 128, a * 0.95);
          break;
        case 'star': {
          const tw = 0.5 + 0.5 * Math.sin(p.age * (p.tw ?? 4) + (p.seed ?? 0));
          this.drawSprite(ctx, SPR.star, p.x, p.y, (p.size / 32) * (0.7 + 0.3 * tw), a * tw, p.rot);
          break;
        }
        case 'ice':
          this.drawSprite(ctx, SPR.hex, p.x, p.y, p.size / 24, a, p.rot);
          break;
        case 'meteor': {
          // 美化：暖白渐变拖尾 + 发光头部 + 火花尾点
          const px0 = p.px ?? p.x, py0 = p.py ?? p.y;
          const len = Math.hypot(p.x - px0, p.y - py0) || 1;
          const mg = ctx.createLinearGradient(px0, py0, p.x, p.y);
          mg.addColorStop(0, 'rgba(255,242,210,0)');
          mg.addColorStop(0.7, (p.color ?? '#ffd77a') + '66');
          mg.addColorStop(1, p.color ?? '#ffd77a');
          ctx.globalAlpha = clamp(a, 0, 1);
          ctx.strokeStyle = mg;
          ctx.lineWidth = Math.max(1, (p.size ?? 3) * 0.85);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(px0, py0);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          this.drawSprite(ctx, SPR.glow, p.x, p.y, (p.size ?? 3) / 20, a);
          ctx.fillStyle = '#fffbea';
          ctx.beginPath();
          ctx.arc(p.x, p.y, (p.size ?? 3) * 0.55, 0, TAU);
          ctx.fill();
          // 拖尾侧边小火花
          if (len > 26) {
            ctx.fillStyle = '#ffdf9a';
            ctx.beginPath();
            ctx.arc(p.x - (p.vx ?? 0) * 0.016, p.y - (p.vy ?? 0) * 0.016 + (p.seed ?? 3), Math.max(1, (p.size ?? 3) * 0.32), 0, TAU);
            ctx.fill();
          }
          break;
        }
        case 'fire': {
          // 火焰：黄→橙→红 发光球，随寿命收缩并上浮
          const hue = 20 + (1 - lt) * 28;
          const fr = (p.size ?? 14) * (1 - lt * 0.45);
          ctx.globalAlpha = clamp(a * 0.9, 0, 1);
          ctx.fillStyle = `hsla(${hue},100%,${55 + lt * 8}%,1)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, fr, 0, TAU);
          ctx.fill();
          this.drawSprite(ctx, SPR.glow, p.x, p.y, fr / 46, a * 0.85);
          break;
        }
        case 'water': {
          // 水滴：蓝色细长水滴 + 顶部光点
          ctx.globalAlpha = clamp(a, 0, 1);
          ctx.strokeStyle = `hsla(${200 + (p.seed ?? 0) * 4},85%,${62 + (p.seed ?? 0) * 2}%,1)`;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - 15);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.fillStyle = `hsla(${205 + (p.seed ?? 0) * 4},90%,78%,1)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y - 15, 1.8, 0, TAU);
          ctx.fill();
          break;
        }
        case 'bolt': {
          // 闪电：锯齿折线（形状由 seed 决定，不闪烁）+ 蓝白辉光
          const seg = 5, bl = 46 + ((p.seed ?? 0) * 7);
          ctx.globalAlpha = clamp(a * (0.55 + 0.45 * Math.sin(p.age * 42)), 0, 1);
          ctx.lineWidth = (p.size ?? 2) + 0.7 * Math.sin(p.age * 36);
          ctx.strokeStyle = '#cfe4ff';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          let bx = p.x, by = p.y;
          for (let i = 1; i <= seg; i++) {
            bx += Math.sin((p.seed ?? 0) * 13.7 + i * 7.3) * 19;
            by += bl / seg;
            ctx.lineTo(bx, by);
          }
          ctx.stroke();
          this.drawSprite(ctx, SPR.glow, p.x, p.y, (p.size ?? 2) / 12, a * 0.8);
          break;
        }
        case 'wind': {
          // 风：青白横向涡弧线（弯曲流动）
          const s = p.seed ?? 0;
          ctx.globalAlpha = clamp(a * 0.75, 0, 1);
          ctx.lineWidth = p.size ?? 1.6;
          ctx.lineCap = 'round';
          ctx.strokeStyle = `hsla(${178 + (s % 3) * 9},85%,76%,.9)`;
          ctx.beginPath();
          ctx.moveTo(p.x - 64, p.y + Math.sin(s + 1) * 9);
          ctx.quadraticCurveTo(p.x - 32, p.y + Math.sin(s + 2) * 16, p.x, p.y + Math.sin(s + 3) * 9);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(230,250,255,.6)';
          ctx.beginPath();
          ctx.moveTo(p.x - 38, p.y + Math.sin(s + 1.6) * 12);
          ctx.quadraticCurveTo(p.x - 18, p.y + Math.sin(s + 2.6) * 18, p.x + 4, p.y + Math.sin(s + 3.6) * 11);
          ctx.stroke();
          break;
        }
        case 'dust':
          this.drawSprite(ctx, SPR.glow, p.x, p.y, p.size / 128, a * 0.4);
          break;
        case 'smoke':
          this.drawSprite(ctx, SPR.glow, p.x, p.y, (p.grow ?? 40) / 128, a * 0.3);
          break;
      }
    }
    ctx.restore();
  }

  /* ---------- 彩虹带 / 能量波 / 神光 / Lens Flare ---------- */
  private spawnRibbons(cx: number, cy: number, n: number): void {
    for (let i = 0; i < n; i++) {
      this.RIB.push({
        cx, cy, age: 0, life: rnd(1, 1.5),
        r0: rnd(30, 60), r1: rnd(230, 330),
        a0: rnd(0, TAU), sweep: rnd(2.2, 3.8) * (i % 2 ? 1 : -1),
        w: rnd(10, 22), hueOff: i * 45,
      });
    }
  }

  private stepRibbons(dt: number): void {
    for (let i = this.RIB.length - 1; i >= 0; i--) {
      this.RIB[i].age += dt;
      if (this.RIB[i].age >= this.RIB[i].life) this.RIB.splice(i, 1);
    }
  }

  private drawRibbons(ctx: CanvasRenderingContext2D): void {
    if (this.RIB.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const rb of this.RIB) {
      const t = rb.age / rb.life;
      const r = lerp(rb.r0, rb.r1, Ease.outCubic(t));
      const a = rb.a0 + rb.sweep * t;
      const al = (1 - t) * 0.85;
      const x0 = rb.cx + Math.cos(a) * r;
      const y0 = rb.cy + Math.sin(a) * r * 0.55;
      const x1 = rb.cx + Math.cos(a + 0.5) * r;
      const y1 = rb.cy + Math.sin(a + 0.5) * r * 0.55;
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      const h = (rb.hueOff + t * 140) % 360;
      g.addColorStop(0, `hsla(${h},100%,65%,0)`);
      g.addColorStop(0.5, `hsla(${h},100%,70%,${al})`);
      g.addColorStop(1, `hsla(${(h + 60) % 360},100%,65%,0)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = rb.w * (1 - t * 0.5);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(rb.cx + Math.cos(a + 0.25) * r * 1.18, rb.cy + Math.sin(a + 0.25) * r * 0.64, x1, y1);
      ctx.stroke();
    }
    ctx.restore();
  }

  private spawnWave(cx: number, cy: number, col: string, maxR: number, w: number, delay: number): void {
    this.WAV.push({ cx, cy, col, maxR, w, delay, age: 0, life: 0.85 });
  }

  /* ---------- 随机元素全屏撒下（火 / 水 / 电 / 风） ---------- */
  private rollElement(): void {
    const list: ('fire' | 'water' | 'bolt' | 'wind')[] = ['fire', 'water', 'bolt', 'wind'];
    this.element = list[Math.floor(Math.random() * list.length)];
  }

  private spawnElement(local: number): void {
    if (!this.elementReady && local > 0.05) {
      this.elementReady = true;
      this.rollElement();
    }
    if (!this.elementReady || local < 0.15) return;
    switch (this.element) {
      case 'fire':
        if (Math.random() < 0.34) this.spawn({
          type: 'fire', x: rnd(0, W), y: -16, vx: rnd(-18, 18), vy: rnd(150, 300),
          life: rnd(1.6, 2.6), size: rnd(12, 30), alpha: rnd(0.5, 0.9), seed: rnd(0, 9), age: 0,
        });
        break;
      case 'water':
        if (Math.random() < 0.42) this.spawn({
          type: 'water', x: rnd(0, W), y: -14, vx: rnd(-14, 14), vy: rnd(430, 660),
          life: rnd(1.2, 2.0), size: rnd(9, 18), alpha: rnd(0.55, 0.9), seed: rnd(0, 9), age: 0,
        });
        break;
      case 'bolt':
        if (Math.random() < 0.15) this.spawn({
          type: 'bolt', x: rnd(0, W), y: -30, vx: rnd(-20, 20), vy: rnd(740, 1040),
          life: rnd(0.5, 0.9), size: rnd(1.4, 2.4), alpha: rnd(0.7, 1), seed: rnd(0, 9), age: 0,
        });
        break;
      case 'wind':
        if (Math.random() < 0.3) this.spawn({
          type: 'wind', x: rnd(-120, -20), y: rnd(0, H), vx: rnd(520, 820), vy: 0,
          life: rnd(0.7, 1.3), size: rnd(1.2, 2.2), alpha: rnd(0.4, 0.75), seed: rnd(0, 9), age: 0,
        });
        break;
    }
  }

  private stepWaves(dt: number): void {
    for (let i = this.WAV.length - 1; i >= 0; i--) {
      this.WAV[i].age += dt;
      if (this.WAV[i].age >= this.WAV[i].life + this.WAV[i].delay) this.WAV.splice(i, 1);
    }
  }

  private drawWaves(ctx: CanvasRenderingContext2D): void {
    if (this.WAV.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const wv of this.WAV) {
      if (wv.age < wv.delay) continue;
      const t = (wv.age - wv.delay) / wv.life;
      const r = wv.maxR * Ease.outCubic(t);
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = wv.col;
      ctx.lineWidth = wv.w * (1 - t) + 1;
      ctx.beginPath();
      ctx.ellipse(wv.cx, wv.cy, r, r * 0.42, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawRays(ctx: CanvasRenderingContext2D, cx: number, cy: number, n: number, rot: number, len: number, alpha: number, hue: number): void {
    if (alpha <= 0 || n <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    for (let i = 0; i < n; i++) {
      const an = (i / n) * TAU;
      const wdt = 0.05 + 0.03 * Math.sin(i * 3.7);
      ctx.save();
      ctx.rotate(an);
      const g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, `hsla(${hue},90%,80%,${alpha})`);
      g.addColorStop(1, `hsla(${hue},90%,80%,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, -len * wdt);
      ctx.lineTo(len, len * wdt);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private drawLensFlare(ctx: CanvasRenderingContext2D, cx: number, cy: number, str: number, hue: number): void {
    if (str <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.6 * str;
    const g = ctx.createLinearGradient(cx - 520, 0, cx + 520, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `hsla(${hue},90%,82%,.85)`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 520, cy - 2, 1040, 4);
    ctx.restore();
    const pts: [number, number, number][] = [[0, 30, 1], [130, 11, 0.5], [-170, 18, 0.4], [270, 8, 0.35], [-330, 13, 0.3]];
    for (const q of pts) this.glow(ctx, cx + q[0], cy + q[0] * 0.08, q[1] * 3, `hsla(${hue},85%,78%,1)`, q[2] * str);
  }

  /* ---------- 地面魔法阵（透视压扁，卡片下层） ---------- */
  private drawGroundCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, prog: number, t: number, colMain: string): void {
    if (prog <= 0) return;
    const a = Ease.outCubic(clamp(prog, 0, 1));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.42);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = colMain;
    ctx.globalAlpha = 0.85 * a;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.55 * a;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.92, 0, TAU); ctx.stroke();
    ctx.save();
    ctx.rotate(t * CFG.circle.spin);
    for (let i = 0; i < 48; i++) {
      const an = (i / 48) * TAU;
      ctx.globalAlpha = 0.5 * a;
      ctx.beginPath();
      ctx.moveTo(Math.cos(an) * R * 0.96, Math.sin(an) * R * 0.96);
      ctx.lineTo(Math.cos(an) * R * (i % 4 ? 0.9 : 0.83), Math.sin(an) * R * (i % 4 ? 0.9 : 0.83));
      ctx.stroke();
    }
    ctx.restore();
    const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    ctx.font = `${Math.round(R * 0.13)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.rotate(t * CFG.circle.spin * 0.6);
    for (let i = 0; i < CFG.circle.runes; i++) {
      const an = (i / CFG.circle.runes) * TAU;
      const ra = clamp(prog * CFG.circle.runes * 0.6 - i, 0, 1);
      if (ra <= 0) continue;
      ctx.globalAlpha = ra * 0.95 * a;
      ctx.fillStyle = colMain;
      ctx.save();
      ctx.rotate(an);
      ctx.translate(R * 0.8, 0);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(RUNES[i % RUNES.length], 0, 0);
      ctx.restore();
    }
    ctx.restore();
    ctx.save();
    ctx.rotate(t * CFG.circle.spinInner);
    ctx.globalAlpha = 0.75 * a;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.55, 0, TAU); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const an = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * R * 0.55, Math.sin(an) * R * 0.55);
    }
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  /* ---------- 主更新：local(0..1) 驱动时间轴 ---------- */
  update(dt: number, local: number, rarity: RevealFxRarity): void {
    const S = CFG[rarity];
    const cx = W / 2, cy = H / 2;

    /* LR 慢动作窗（实体化瞬间）：仅缩放视觉时间，不影响 local 进度（可跳过） */
    let tsT = 1;
    if (S.slowmo > 0 && local > S.solidAt - 0.12 && local < S.solidAt + 0.05) tsT = 0.3;
    this.timeScale = lerp(this.timeScale, tsT, 0.1);
    const fdt = dt * this.timeScale;
    this.fxT += fdt;
    this.zoom += (this.zoomT - this.zoom) * Math.min(1, fdt * 3.2);
    this.raysA = Math.max(0, this.raysA - fdt * 0.35);
    this.flareA = Math.max(0, this.flareA - fdt * 0.8);
    this.circleP = clamp(local / 0.3, 0, 1);

    /* 聚集粒子（0 ~ 0.32） */
    if (local < 0.32 && Math.random() < 0.9) {
      const n = rarity === 'LR' ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const an = rnd(0, TAU), r = rnd(300, 560);
        this.spawn({
          type: 'converge', x: cx + Math.cos(an) * r, y: cy + Math.sin(an) * r * 0.6,
          tx: cx, ty: cy, v: rnd(40, 120), vMax: rnd(340, 580),
          life: rnd(0.5, 1.1), size: rnd(10, 28), alpha: rnd(0.5, 1), age: 0,
        });
      }
    }
    /* 旋涡（0.18 ~ 0.4） */
    if (local > 0.18 && local < 0.4 && Math.random() < 0.7) {
      this.spawn({
        type: 'vortex', x: cx, y: cy, cx, cy, ang: rnd(0, TAU), r: rnd(130, 250),
        av: rnd(4, 8) * (Math.random() < 0.5 ? 1 : -1),
        dr: rnd(130, 230), rise: rnd(12, 55), life: rnd(0.5, 1),
        size: rnd(8, 22), alpha: rnd(0.5, 1), age: 0,
      });
    }
    /* 环境尘埃 */
    if (Math.random() < S.dust) {
      this.spawn({
        type: 'dust', x: rnd(0, W), y: rnd(H * 0.3, H),
        vx: rnd(-8, 8), vy: rnd(-14, -4), life: rnd(2, 4), size: rnd(6, 16), alpha: rnd(0.2, 0.5), age: 0,
      });
    }

    /* 随机元素全屏撒下（火 / 水 / 电 / 风） */
    this.spawnElement(local);

    /* 品质爆发（实体化瞬间，一次性） */
    if (local >= S.solidAt && !this.burstFired) {
      this.burstFired = true;
      this.zoomT = S.punch;
      this.flareA = S.lensFlare;
      if (S.rays > 0) this.raysA = 1;
      for (let i = 0; i < S.burst.n; i++) {
        const an = rnd(0, TAU), v = rnd(60, S.burst.speed);
        this.spawn({
          type: 'burst', x: cx, y: cy,
          vx: Math.cos(an) * v, vy: Math.sin(an) * v * 0.8,
          drag: 1.8, grav: rarity === 'LR' ? 70 : 0,
          life: rnd(0.5, 1.5), size: rnd(10, rarity === 'LR' ? 36 : 24), alpha: rnd(0.6, 1), age: 0,
        });
      }
      for (let i = 0; i < S.star; i++) {
        this.spawn({
          type: 'star', x: cx + rnd(-280, 280), y: cy + rnd(-260, 210),
          life: rnd(0.8, 2.2), size: rnd(8, 24), tw: rnd(4, 9), seed: rnd(0, 9),
          alpha: 1, rot: rnd(0, TAU), vr: 0, age: 0,
        });
      }
      for (let i = 0; i < S.ice; i++) {
        this.spawn({
          type: 'ice', x: cx + rnd(-250, 250), y: cy + rnd(-40, 210),
          life: rnd(1.2, 2.4), size: rnd(8, 22), v: rnd(22, 75), seed: rnd(0, 9),
          alpha: 1, rot: rnd(0, TAU), vr: rnd(-2, 2), age: 0,
        });
      }
      for (let i = 0; i < S.meteor; i++) {
        const x0 = cx + rnd(-520, 520), y0 = cy - 380 + rnd(-60, 0);
        this.spawn({
          type: 'meteor', x: x0, y: y0, px: x0, py: y0,
          vx: rnd(-70, 70), vy: rnd(400, 640), life: rnd(0.5, 0.9),
          size: rnd(2, 4.5), color: `hsla(${rnd(38, 54)},100%,${rnd(62, 80)}%,.95)`, alpha: 1, age: 0,
        });
      }
      for (let i = 0; i < S.smoke; i++) {
        const an = rnd(0, TAU);
        this.spawn({
          type: 'smoke', x: cx + Math.cos(an) * rnd(20, 90), y: cy + Math.sin(an) * rnd(20, 90),
          vx: rnd(-40, 40), vy: rnd(-70, -20), life: rnd(1.4, 2.4),
          grow: rnd(40, 80), growT: rnd(180, 300), alpha: rnd(0.5, 0.9), size: rnd(14, 30), age: 0,
        });
      }
      for (let i = 0; i < S.rings; i++) {
        this.spawnWave(cx, cy, S.ringCol, 470 + i * 90, 8 - i, i * 0.09);
      }
      if (rarity === 'LR') this.spawnRibbons(cx, cy, 3);
    }
    /* 强闪光（实体化瞬间） */
    if (local >= S.solidAt + 0.08 && !this.flashFired) {
      this.flashFired = true;
      if (S.flashV > 0) this.onFlash?.(S.flashV);
    }

    this.stepP(fdt);
    this.stepRibbons(fdt);
    this.stepWaves(fdt);
  }

  /* ---------- 渲染：前景层（生产背景已画完，调用本方法叠加） ---------- */
  render(
    ctx: CanvasRenderingContext2D,
    card: Card,
    local: number,
    rarity: RevealFxRarity,
    col: string,
  ): void {
    const S = CFG[rarity];
    const cx = W / 2, cy = H / 2;
    const t = this.fxT;

    /* 镜头推近（只作用于本层） */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-cx, -cy);

    /* 地面魔法阵（卡片下层） */
    this.drawGroundCircle(ctx, cx, H * CFG.circle.altarY, CFG.circle.R, this.circleP, t, col);

    /* 神光（LR） */
    if (this.raysA > 0) this.drawRays(ctx, cx, cy, S.rays, t * 0.25, W * 0.5, this.raysA * S.rayAlpha, S.hue);

    /* 能量波 / 彩虹带 / 粒子 / Lens Flare */
    this.drawWaves(ctx);
    this.drawRibbons(ctx);
    this.drawP(ctx);
    if (this.flareA > 0) this.drawLensFlare(ctx, cx, cy, this.flareA, S.hue);

    /* ── 卡片：居中幽灵渐显（10% → 35%），最后一秒突然实体化 + 圣光 ── */
    const solidAt = S.solidAt;
    const ghostP = clamp(local / solidAt, 0, 1);                          // 0→1（前 80% 时间）
    const ghostA = 0.10 + 0.25 * Ease.inOutSine(ghostP);                   // 0.10 → 0.35
    const solidP = local > solidAt ? clamp((local - solidAt) / (1 - solidAt), 0, 1) : 0; // 最后 1 秒
    const cardA = solidP > 0 ? lerp(0.35, 1, Ease.outCubic(solidP)) : ghostA;
    const breathe = 1 + 0.012 * Math.sin(t * 2);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(breathe, breathe);
    ctx.globalAlpha = cardA;
    this.drawFront?.(ctx, card, 0, 0, CFG.card.w, CFG.card.h);
    ctx.restore();

    /* 最后一秒：卡片周边一圈圣光（扩散光环）+ 收拢描边 */
    if (solidP > 0) {
      const haloA = S.halo ? 0.55 * Ease.outCubic(solidP) : 0;
      const r = CFG.card.w * (0.72 + 0.6 * solidP);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (haloA > 0) {
        const hg = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
        hg.addColorStop(0, S.col.glow + '00');
        hg.addColorStop(0.7, S.col.glow + Math.floor(haloA * 255 * 0.55).toString(16).padStart(2, '0'));
        hg.addColorStop(1, S.col.glow + '00');
        ctx.fillStyle = hg;
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = S.halo ? S.halo.col : S.col.main;
        ctx.lineWidth = 3 + 2 * Math.sin(t * 4);
        ctx.globalAlpha = Math.min(1, haloA * 1.4);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.stroke();
        // 第二圈反向收拢
        ctx.lineWidth = 2;
        ctx.globalAlpha = Math.min(1, haloA);
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1.25 - 0.2 * solidP), 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* 顶部品质文字（实体化瞬间 outBack 弹出）：大字 + 副标 */
    if (solidP > 0) {
      const e = Ease.outBack(clamp(solidP / 0.45, 0, 1));
      ctx.save();
      ctx.translate(cx, H * 0.155);
      ctx.scale(Math.max(0.02, e), Math.max(0.02, e));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = S.col.main;
      ctx.shadowBlur = 32;
      let fill: string | CanvasGradient = S.col.glow;
      if (rarity === 'LR') {
        const lg = ctx.createLinearGradient(-260, 0, 260, 0);
        for (let i = 0; i <= 6; i++) lg.addColorStop(i / 6, `hsl(${i * 60},95%,72%)`);
        fill = lg;
      }
      ctx.fillStyle = fill;
      ctx.font = 'bold 54px "Cinzel", "Kaiti SC", "STKaiti", "Kaiti SC", "STKaiti", serif';
      ctx.fillText(S.label.split('').join(' '), 0, 0);
      ctx.font = '20px "Kaiti SC", "STKaiti", "Kaiti SC", "STKaiti", serif';
      ctx.shadowBlur = 12;
      ctx.fillStyle = S.col.main;
      ctx.fillText(S.sub, 0, 44);
      ctx.restore();
    }

    ctx.restore();
  }
}
