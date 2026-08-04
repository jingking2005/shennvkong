/**
 * 卡面渲染器 — 圆角卡框 + 立绘 + 卡名 + 稀有度
 */

import { imageUrl, type Card } from './data';

export const RARITY_COLOR: Record<string, string> = {
  N: '#9aa0a8', R: '#4da3ff', SR: '#b45cff', UR: '#ffb42e',
  LR: '#ff5c8a', X: '#ffe14d', VR: '#3ef0e0',
};

const imageCache = new Map<string, HTMLImageElement>();

export function preloadImage(card: Card): Promise<HTMLImageElement> {
  const url = imageUrl(card);
  const cached = imageCache.get(url);
  if (cached?.complete) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { imageCache.set(url, img); resolve(img); };
    img.onerror = reject;
    img.src = url;
    imageCache.set(url, img);
  });
}

export function getImage(card: Card): HTMLImageElement | null {
  const img = imageCache.get(imageUrl(card));
  return img?.complete ? img : null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  if (w <= 0 || h <= 0) return;
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface CardDrawOpts {
  showName?: boolean;
  showBadge?: boolean;
  isNew?: boolean;
  rainbowT?: number; // 0..1 虹彩相位（LR/X/VR）
  showMeta?: boolean; // COST / Lv.1 徽标（落定卡）
}

export function drawCard(
  ctx: CanvasRenderingContext2D,
  card: Card,
  cx: number, cy: number, w: number, h: number,
  opts: CardDrawOpts = {},
): void {
  const { showName = true, showBadge = true, isNew = false, rainbowT, showMeta = false } = opts;
  if (w <= 0 || h <= 0) return;
  const color = RARITY_COLOR[card.rarity] || '#888';
  const x = cx - w / 2, y = cy - h / 2;
  const r = Math.min(14, w * 0.06);

  ctx.save();

  // 外发光
  const glowR = Math.max(w, h) * 0.7;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
  glow.addColorStop(0, color + '55');
  glow.addColorStop(1, color + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2);

  // 底板
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = '#0d0a16';
  ctx.fill();

  // 立绘（裁剪进圆角）
  ctx.save();
  roundRect(ctx, x + 4, y + 4, w - 8, h - 8, r - 3);
  ctx.clip();
  const img = getImage(card);
  if (img) {
    const pad = 8, topPad = 8, botPad = showName ? 44 : 12;
    const aw = w - pad * 2, ah = h - topPad - botPad;
    const scale = Math.min(aw / img.width, ah / img.height);
    const iw = img.width * scale, ih = img.height * scale;
    ctx.drawImage(img, cx - iw / 2, y + topPad + ah / 2 - ih / 2, iw, ih);
  } else {
    // 图未就绪：触发加载（下帧即可显示），先画稀有度色底
    preloadImage(card).catch(() => {});
    const pg = ctx.createLinearGradient(0, y, 0, y + h);
    pg.addColorStop(0, color + '44');
    pg.addColorStop(1, color + '11');
    ctx.fillStyle = pg;
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    ctx.fillStyle = color + 'aa';
    ctx.font = `bold ${Math.max(10, w * 0.1)}px "Cinzel", "Kaiti SC", "STKaiti", system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(card.rarity, cx, cy);
  }
  // 底部渐变压暗
  const vg = ctx.createLinearGradient(0, y + h * 0.55, 0, y + h);
  vg.addColorStop(0, 'rgba(6,4,14,0)');
  vg.addColorStop(1, 'rgba(6,4,14,0.95)');
  ctx.fillStyle = vg;
  ctx.fillRect(x + 4, y + h * 0.55, w - 8, h * 0.45 - 4);
  ctx.restore();

  // 稀有度描边（虹彩或纯色）
  let stroke = color;
  if (rainbowT !== undefined && ['LR', 'X', 'VR'].includes(card.rarity)) {
    stroke = `hsl(${Math.floor(rainbowT * 360)}, 85%, 62%)`;
  }
  roundRect(ctx, x, y, w, h, r);
  ctx.lineWidth = ['N', 'R'].includes(card.rarity) ? 2 : 3.5;
  ctx.strokeStyle = stroke;
  ctx.stroke();

  // 内细金线
  roundRect(ctx, x + 5, y + 5, w - 10, h - 10, r - 4);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,233,168,0.3)';
  ctx.stroke();

  // 稀有度徽标（玻璃质感）
  if (showBadge) {
    drawGlassRarityBadge(ctx, x + 6, y + 6, w, card.rarity, color, rainbowT);
  }

  // NEW（红色锯齿贴纸）
  if (isNew) {
    ctx.save();
    const nx = x + w - 22, ny = y + 22, nr = 17;
    ctx.fillStyle = '#ff5a2a';
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rr = i % 2 === 0 ? nr : nr * 0.78;
      const px = nx + Math.cos(a) * rr, py = ny + Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffd0a8'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px "Cinzel", "Kaiti SC", "STKaiti", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('NEW', nx, ny);
    ctx.restore();
  }

  // COST / Lv 徽标
  if (showMeta) {
    ctx.save();
    ctx.textBaseline = 'middle';
    // 右上 Lv.1
    ctx.font = `bold ${Math.max(9, w * 0.07)}px "Cinzel", "Kaiti SC", "STKaiti", system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const lw = ctx.measureText('Lv.1').width + 10;
    ctx.fillRect(x + w - lw - 6, y + 6, lw, 16);
    ctx.fillStyle = '#fff';
    ctx.fillText('Lv.1', x + w - 11, y + 14);
    // 左下 COST 数值
    ctx.textAlign = 'left';
    const costStr = String(card.cardCost);
    ctx.font = `bold ${Math.max(10, w * 0.085)}px "Cinzel", "Kaiti SC", "STKaiti", system-ui, sans-serif`;
    const cw2 = Math.max(34, ctx.measureText(costStr).width + 12);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x + 6, y + h - 24, cw2, 18);
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(7, w * 0.05)}px "Cinzel", "Kaiti SC", "STKaiti", system-ui, sans-serif`;
    ctx.fillText('COST', x + 10, y + h - 19);
    ctx.font = `bold ${Math.max(11, w * 0.09)}px "Cinzel", "Kaiti SC", "STKaiti", system-ui, sans-serif`;
    ctx.fillText(costStr, x + 10, y + h - 9);
    ctx.restore();
  }

  // 卡名
  if (showName) {
    const fs = w >= 200 ? 15 : w >= 130 ? 12 : 9;
    ctx.font = `bold ${fs}px "Cinzel", "Kaiti SC", "STKaiti", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const maxLen = w >= 200 ? 14 : w >= 130 ? 10 : 7;
    let label = card.name;
    if (label.length > maxLen) label = label.slice(0, maxLen) + '…';
    ctx.fillStyle = '#f7f2e8';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 5;
    ctx.fillText(label, cx, y + h - (w >= 130 ? 22 : 14));
    // 元素
    ctx.font = `bold ${Math.max(8, fs - 5)}px "Cinzel", "Kaiti SC", "STKaiti", system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(card.element, cx, y + h - 8);
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

/** 左上角玻璃稀有度角标 */
function drawGlassRarityBadge(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, cardW: number,
  rarity: string, color: string, rainbowT?: number,
): void {
  const label = rarity;
  const bw = Math.max(34, Math.min(56, cardW * 0.30));
  const bh = Math.max(16, Math.min(24, cardW * 0.105));
  const r = bh / 2;

  ctx.save();

  // 外发光
  ctx.shadowColor = color;
  ctx.shadowBlur = ['LR', 'X', 'VR'].includes(rarity) ? 12 : 7;

  // 玻璃底：深色半透 + 稀有度色
  const body = ctx.createLinearGradient(x, y, x, y + bh);
  body.addColorStop(0, shade(color, 0.55));
  body.addColorStop(0.45, shade(color, 0.22));
  body.addColorStop(1, shade(color, -0.25));
  roundRect(ctx, x, y, bw, bh, r);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.shadowBlur = 0;

  // 顶部高光弧
  const hi = ctx.createLinearGradient(x, y, x, y + bh * 0.55);
  hi.addColorStop(0, 'rgba(255,255,255,0.72)');
  hi.addColorStop(0.55, 'rgba(255,255,255,0.12)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  roundRect(ctx, x + 1.5, y + 1.2, bw - 3, bh * 0.48, r * 0.7);
  ctx.fillStyle = hi;
  ctx.fill();

  // 金属描边
  let edge = color;
  if (rainbowT !== undefined && ['LR', 'X', 'VR'].includes(rarity)) {
    edge = `hsl(${Math.floor(rainbowT * 360)}, 90%, 68%)`;
  }
  roundRect(ctx, x, y, bw, bh, r);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.stroke();
  roundRect(ctx, x + 0.8, y + 0.8, bw - 1.6, bh - 1.6, r - 0.5);
  ctx.lineWidth = 1;
  ctx.strokeStyle = edge;
  ctx.stroke();

  // 字：白字 + 深描边
  const fs = Math.max(9, Math.min(13, bw * 0.28));
  ctx.font = `bold ${fs}px "Cinzel", "Kaiti SC", "STKaiti", "Cinzel", "Kaiti SC", "STKaiti", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(10,8,20,0.75)';
  ctx.strokeText(label, x + bw / 2, y + bh / 2 + 0.5);
  ctx.fillStyle = '#fffef8';
  ctx.fillText(label, x + bw / 2, y + bh / 2 + 0.5);

  ctx.restore();
}

function shade(hex: string, amt: number): string {
  const n = hex.replace('#', '');
  if (n.length < 6) return hex;
  const r = Math.max(0, Math.min(255, parseInt(n.slice(0, 2), 16) + Math.round(amt * 255)));
  const g = Math.max(0, Math.min(255, parseInt(n.slice(2, 4), 16) + Math.round(amt * 255)));
  const b = Math.max(0, Math.min(255, parseInt(n.slice(4, 6), 16) + Math.round(amt * 255)));
  return `rgb(${r},${g},${b})`;
}
