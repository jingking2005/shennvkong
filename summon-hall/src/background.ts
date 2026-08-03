/**
 * 背景 — 真实插画 + 视差 + 呼吸光效
 * 大厅：活动地图轮播（Ken Burns 横移 + 交叉淡入），兜底黄金神殿
 * 稀有揭示：星空金卡
 */

import { RotationLoader } from './assets';

export interface BgLayer {
  img: HTMLImageElement;
  loaded: boolean;
}

function loadImage(src: string): BgLayer {
  const img = new Image();
  const layer: BgLayer = { img, loaded: false };
  img.onload = () => { layer.loaded = true; };
  img.src = src;
  return layer;
}

interface Dust { x: number; y: number; r: number; vy: number; ph: number; sp: number; }

/** 大厅轮播间隔（秒）与淡入时长 */
const HALL_ROTATE_SEC = 14;
const HALL_FADE_SEC = 1.6;

export class Background {
  private w = 0; private h = 0;
  private hall = loadImage('/images/_bg_temple_gold.png');
  private rare = loadImage('/images/_bg_reveal_rare.png');
  private dust: Dust[] = [];
  private time = 0;
  private mode: 'hall' | 'rare' = 'hall';
  private fadeToRare = 0; // 0=hall 1=rare
  /** 大厅轮播素材（地图）；空数组 = 只用兜底神殿 */
  private hallSources: string[] = [];
  private hallLoader = new RotationLoader(8);

  resize(w: number, h: number): void {
    this.w = w; this.h = h;
    this.dust = [];
    for (let i = 0; i < 60; i++) {
      this.dust.push({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 2 + 0.6, vy: -(Math.random() * 0.25 + 0.06),
        ph: Math.random() * Math.PI * 2, sp: Math.random() * 0.5 + 0.5,
      });
    }
  }

  setMode(m: 'hall' | 'rare'): void {
    this.mode = m;
  }

  /** 设置大厅轮播素材（活动地图列表） */
  setHallCarousel(sources: string[]): void {
    this.hallSources = sources;
  }

  /** 稀有揭示时淡入星空背景 */
  setRareBlend(v: number): void {
    this.fadeToRare = Math.max(0, Math.min(1, v));
  }

  update(dt: number): void {
    this.time += dt;
    for (const d of this.dust) {
      d.y += d.vy * d.sp;
      d.x += Math.sin(this.time * 0.4 + d.ph) * 0.25;
      if (d.y < -10) { d.y = this.h + 10; d.x = Math.random() * this.w; }
    }
  }

  private drawCover(img: HTMLImageElement, alpha: number, zoom: number, panX: number, panY: number): void {
    const ctx = this.ctxRef!;
    const iw = img.width, ih = img.height;
    // contain：完整显示整张 16:9，不裁剪；居中，超出留边由底色补
    const scale = Math.min(this.w / iw, this.h / ih) * zoom;
    const dw = iw * scale, dh = ih * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (this.w - dw) / 2 + panX, (this.h - dh) / 2 + panY, dw, dh);
    ctx.restore();
  }

  private ctxRef: CanvasRenderingContext2D | null = null;

  /** 大厅轮播：当前张 + 末尾 1.6s 交叉淡入下一张 */
  private drawHallCarousel(alpha: number): void {
    const n = this.hallSources.length;
    const idx = Math.floor(this.time / HALL_ROTATE_SEC) % n;
    const nidx = (idx + 1) % n;
    const fade = Math.min(1, Math.max(0,
      (this.time % HALL_ROTATE_SEC - (HALL_ROTATE_SEC - HALL_FADE_SEC)) / HALL_FADE_SEC));
    this.drawPano(this.hallLoader.get(this.hallSources[idx]), alpha);
    if (fade > 0) this.drawPano(this.hallLoader.get(this.hallSources[nidx]), alpha * fade);
  }

  /** 全景绘制：高度铺满，超宽部分缓慢横移扫过（Ken Burns） */
  private drawPano(img: HTMLImageElement, alpha: number): void {
    if (!img.complete || !img.naturalWidth) return;
    const ctx = this.ctxRef!;
    const scale = this.h / img.naturalHeight;
    const dw = img.naturalWidth * scale;
    const range = Math.max(0, dw - this.w);
    const sweep = range > 0 ? (0.5 + 0.5 * Math.sin(this.time * 0.04)) : 0.5;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, -range * sweep, 0, dw, this.h);
    ctx.restore();
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.ctxRef = ctx;
    // 底
    ctx.fillStyle = '#06030f';
    ctx.fillRect(0, 0, this.w, this.h);

    // 缓慢呼吸缩放（视差生命感）
    const breathe = 1 + Math.sin(this.time * 0.3) * 0.012;
    const panX = Math.sin(this.time * 0.15) * 8;
    const panY = Math.cos(this.time * 0.12) * 6;

    if (this.hallSources.length > 0) {
      this.drawHallCarousel(1 - this.fadeToRare);
    } else if (this.hall.loaded) {
      this.drawCover(this.hall.img, 1 - this.fadeToRare, breathe, panX, panY);
    }
    if (this.fadeToRare > 0 && this.rare.loaded) {
      this.drawCover(this.rare.img, this.fadeToRare, breathe, panX * 0.5, panY * 0.5);
    }

    // 电影暗角：只压暗四角聚焦卡牌，零色相，不盖住金色
    const vg = ctx.createRadialGradient(
      this.w / 2, this.h / 2, this.h * 0.45,
      this.w / 2, this.h / 2, this.h * 1.05,
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.w, this.h);

    // 漂浮星尘
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const d of this.dust) {
      const a = 0.25 + 0.3 * Math.sin(this.time * d.sp + d.ph);
      ctx.fillStyle = `rgba(255,235,180,${Math.max(0, a).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
