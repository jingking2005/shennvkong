/**
 * 战斗 UI 组件 — 以参考截图为唯一标准的像素级复刻
 * 纯绘制函数；按钮矩形由调用方注册到 buttons 列表。
 */

import type { Card } from '../data';
import { drawCard } from '../card';
import { glassButton, metalDialog, roundRectPath } from '../ui';
import { SKILL_DLG, VICTORY, EXPLORE, COLORS, CANVAS_W, CANVAS_H } from './layout';

export interface Btn { x: number; y: number; w: number; h: number; id: string }

type Ctx = CanvasRenderingContext2D;

function text(ctx: Ctx, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', bold = false, stroke = false): void {
  ctx.save();
  ctx.font = `${bold ? 'bold ' : ''}${size}px "Cinzel", "Kaiti SC", "STKaiti", "Cinzel", "Kaiti SC", "STKaiti", system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = Math.max(2, size / 7); ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
  ctx.restore();
}

/** 元素 → 菱形颜色 */
export function elemColor(element: string): string {
  switch ((element || '').toUpperCase()) {
    case 'COOL': return COLORS.elemCool;
    case 'PASSION': return COLORS.elemPassion;
    case 'LIGHT': return COLORS.elemLight;
    case 'DARK': return COLORS.elemDark;
    default: return '#9aa4b0';
  }
}

// ─────────────────────────── 圆形按钮（撤退/自动/菜单）───────────────────────────

export function drawCircleButton(ctx: Ctx, cx: number, cy: number, r: number, label: string, hover: boolean, active = false): void {
  ctx.save();
  if (hover || active) { ctx.shadowColor = active ? '#6fe8a0' : '#ffe14d'; ctx.shadowBlur = active ? 26 : 20; }
  // 金属外环
  const ring = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  ring.addColorStop(0, '#f0e8d8'); ring.addColorStop(0.5, '#8a8078'); ring.addColorStop(1, '#d8d0c0');
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = ring; ctx.fill();
  ctx.shadowBlur = 0;
  // 球体：激活态绿色，否则橙色
  const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.15, cx, cy, r);
  if (active) { body.addColorStop(0, '#a8f8c8'); body.addColorStop(0.55, '#3ec878'); body.addColorStop(1, '#1a7a44'); }
  else { body.addColorStop(0, '#f8c868'); body.addColorStop(0.55, COLORS.circleBtnTop); body.addColorStop(1, COLORS.circleBtnBot); }
  ctx.beginPath(); ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
  ctx.fillStyle = body; ctx.fill();
  // 顶部高光
  ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.42, r * 0.5, r * 0.26, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
  text(ctx, label, cx, cy + 1, r * 0.38, '#fff', 'center', true, true);
  ctx.restore();
}

// ─────────────────────────── 血条（属性圆图标 + 金属框条 + 数字）───────────────────────────

export function drawHpBar(
  ctx: Ctx, x: number, y: number, w: number, h: number, ratio: number,
  opts: { element?: string; value?: string; valueColor?: string; iconR?: number } = {},
): void {
  const iconR = opts.iconR ?? 11;
  ctx.save();
  // 属性圆图标（条左侧）
  if (opts.element) {
    const icx = x - iconR - 4, icy = y + h / 2;
    const g = ctx.createRadialGradient(icx - 2, icy - 3, 1, icx, icy, iconR);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, elemColor(opts.element)); g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.beginPath(); ctx.arc(icx, icy, iconR, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  // 金属框
  roundRectPath(ctx, x - 1.5, y - 1.5, w + 3, h + 3, 3);
  ctx.fillStyle = COLORS.hpBarFrame; ctx.fill();
  // 条体渐变
  const grd = ctx.createLinearGradient(0, y, 0, y + h);
  grd.addColorStop(0, COLORS.hpBarAlly[0]); grd.addColorStop(1, COLORS.hpBarAlly[1]);
  const fw = Math.max(0, Math.min(1, ratio)) * w;
  if (fw > 0.5) {
    roundRectPath(ctx, x, y, fw, h, 2);
    ctx.fillStyle = grd; ctx.fill();
  }
  // 数字（条上方，截图样式）
  if (opts.value) text(ctx, opts.value, x + w / 2, y - 9, 13, opts.valueColor ?? COLORS.hpNumAlly, 'center', true, true);
  ctx.restore();
}

// ─────────────────────────── 技能星（可点击，截图大黄星）───────────────────────────

function starPath(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** 满怒技能星：水晶/玻璃质感——冰蓝折射星体 + 棱面 + 镜面反光 + 闪烁星芒 */
export function drawSkillStar(ctx: Ctx, cx: number, cy: number, r: number, t: number, hover: boolean): void {
  const pulse = 1 + Math.sin(t * 3.2) * 0.07;
  const rr = r * pulse * (hover ? 1.14 : 1);
  ctx.save();
  // 冰晶光晕
  const halo = ctx.createRadialGradient(cx, cy, rr * 0.2, cx, cy, rr * 2.0);
  halo.addColorStop(0, 'rgba(190,230,255,0.55)');
  halo.addColorStop(1, 'rgba(120,180,255,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(cx, cy, rr * 2.0, 0, Math.PI * 2); ctx.fill();
  // 玻璃星体：冰蓝纵向渐变 + 青色外发光
  ctx.shadowColor = '#9fd8ff'; ctx.shadowBlur = hover ? 34 : 20;
  const g = ctx.createLinearGradient(cx, cy - rr, cx, cy + rr);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#d8f0ff');
  g.addColorStop(0.7, '#8fc8f8'); g.addColorStop(1, '#4a90d8');
  starPath(ctx, cx, cy, rr);
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowBlur = 0;
  // 晶体棱面（中心到五角的折射线）
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * rr * 0.9, cy + Math.sin(a) * rr * 0.9); ctx.stroke();
  }
  // 冰边描边
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(230,246,255,0.95)';
  starPath(ctx, cx, cy, rr); ctx.stroke();
  // 顶部镜面反光
  ctx.beginPath();
  ctx.ellipse(cx - rr * 0.16, cy - rr * 0.4, rr * 0.32, rr * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
  // 闪烁十字星芒（随时间呼吸）
  const sp = (t * 1.2) % 1;
  const sr = rr * 0.26 * (1 - Math.abs(sp - 0.5) * 2);
  if (sr > 1) {
    const sx = cx + rr * 0.48, sy = cy - rr * 0.52;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - sr, sy); ctx.lineTo(sx + sr, sy);
    ctx.moveTo(sx, sy - sr); ctx.lineTo(sx, sy + sr);
    ctx.stroke();
  }
  ctx.restore();
}

// ─────────────────────────── 战斗卡牌（卡 + 元素菱形 + 稀有tag + Lv + 红心 + 选中框）───────────────────────────

export interface BattleCardOpts {
  elemBadge?: boolean;   // 左上元素菱形
  rarityTag?: string;    // 左上稀有度字标（XLR/XUR…）
  lv?: number;           // 右上 Lv 黑底标签
  heart?: boolean;       // 红心
  selected?: boolean;    // 金色选中框
  dim?: boolean;
  rainbowT?: number;
}

export function drawBattleCard(ctx: Ctx, card: Card, cx: number, cy: number, w: number, h: number, opts: BattleCardOpts = {}): void {
  ctx.save();
  if (opts.dim) ctx.globalAlpha = 0.45;
  drawCard(ctx, card, cx, cy, w, h, { showName: false, rainbowT: opts.rainbowT });
  const x = cx - w / 2, y = cy - h / 2;

  // 左上：元素菱形
  if (opts.elemBadge) {
    const d = 17, bx = x + 4, by = y + 4;
    ctx.save();
    ctx.translate(bx + d / 2, by + d / 2); ctx.rotate(Math.PI / 4);
    const g = ctx.createLinearGradient(-d / 2, -d / 2, d / 2, d / 2);
    g.addColorStop(0, '#fff'); g.addColorStop(0.35, elemColor(card.element)); g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g; ctx.fillRect(-d / 2, -d / 2, d, d);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.4; ctx.strokeRect(-d / 2, -d / 2, d, d);
    ctx.restore();
  }
  // 左上：稀有度字标（紫底白字）
  if (opts.rarityTag) {
    ctx.save();
    ctx.font = 'bold 13px "Cinzel", "Kaiti SC", "STKaiti", system-ui, sans-serif';
    const tw = ctx.measureText(opts.rarityTag).width + 10;
    roundRectPath(ctx, x + 3, y + 3, tw, 20, 3);
    ctx.fillStyle = COLORS.rareTagBg; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    text(ctx, opts.rarityTag, x + 3 + tw / 2, y + 13.5, 12, '#fff', 'center', true);
    ctx.restore();
  }
  // 右上：Lv 黑底标签
  if (opts.lv !== undefined) {
    ctx.save();
    ctx.font = 'bold 12px "Cinzel", "Kaiti SC", "STKaiti", system-ui, sans-serif';
    const s = `Lv.${opts.lv}`;
    const tw = ctx.measureText(s).width + 10;
    roundRectPath(ctx, x + w - tw - 3, y + 3, tw, 19, 3);
    ctx.fillStyle = COLORS.lvTagBg; ctx.fill();
    text(ctx, s, x + w - tw / 2 - 3, y + 13, 12, '#fff', 'center', true);
    ctx.restore();
  }
  // 红心
  if (opts.heart) text(ctx, '♥', x + w - 16, y + h - 18, 18, '#ff5a6a', 'center', true, true);
  // 金色选中框（截图第4卡高亮态）
  if (opts.selected) {
    ctx.save();
    ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 22;
    ctx.strokeStyle = '#ffd24d'; ctx.lineWidth = 4;
    roundRectPath(ctx, x - 3, y - 3, w + 6, h + 6, 10); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// ─────────────────────────── 技能确认弹窗 ───────────────────────────

export interface SkillInfo { name: string; lv: number; cost: number; desc: string; element: string }

export function drawSkillConfirm(ctx: Ctx, info: SkillInfo, hover: string | null): Btn[] {
  const cx = CANVAS_W / 2, cy = CANVAS_H / 2;
  const { w, h } = SKILL_DLG;
  const x = cx - w / 2, y = cy - h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(2,2,8,0.55)'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  metalDialog(ctx, x, y, w, h);
  // ★技能名 Lv.x（白字）
  text(ctx, `★${info.name} Lv.${info.lv}`, cx, cy + SKILL_DLG.titleDy, 24, '#fff', 'center', true);
  // 发动成本
  text(ctx, `发动成本：${info.cost}`, cx, cy + SKILL_DLG.costDy, 18, '#e8d5a8', 'center', true);
  // 描述（属性圆点 + 文字）
  const descY = cy + SKILL_DLG.descDy;
  ctx.beginPath(); ctx.arc(cx - ctx.measureText(info.desc).width / 2 - 14, descY, 7, 0, Math.PI * 2);
  ctx.fillStyle = elemColor(info.element); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
  text(ctx, info.desc, cx + 10, descY, 17, '#fff', 'center', true);
  // 放弃（红）/ 发动（绿）
  const bw = SKILL_DLG.btnW, bh = SKILL_DLG.btnH, by = cy + SKILL_DLG.btnDy - bh / 2;
  const cancelX = cx - SKILL_DLG.btnGap / 2 - bw, goX = cx + SKILL_DLG.btnGap / 2;
  glassButton(ctx, cancelX, by, bw, bh, '放弃', { kind: 'red', hover: hover === 'skillCancel', fontSize: 22 });
  glassButton(ctx, goX, by, bw, bh, '发动', { kind: 'green', hover: hover === 'skillGo', fontSize: 22 });
  ctx.restore();
  return [
    { x: cancelX, y: by, w: bw, h: bh, id: 'skillCancel' },
    { x: goX, y: by, w: bw, h: bh, id: 'skillGo' },
  ];
}

// ─────────────────────────── 胜利结算 ───────────────────────────

export interface VictoryEntry { card: Card; lv: number; rarityTag: string; gain: string; levelLabel: string; expRatio: number }

export function drawVictory(ctx: Ctx, entries: VictoryEntry[], hover: string | null): Btn[] {
  const V = VICTORY;
  ctx.save();
  ctx.fillStyle = 'rgba(6,4,12,0.45)'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // VICTORY 金色立体字（左上）
  ctx.save();
  ctx.font = `bold ${V.titleSize}px "Cinzel", "Kaiti SC", "STKaiti", "Cinzel", "Kaiti SC", "STKaiti", system-ui, sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.lineWidth = 10; ctx.strokeStyle = '#6a4a08'; ctx.strokeText('VICTORY', V.titleX, V.titleY);
  const tg = ctx.createLinearGradient(0, V.titleY, 0, V.titleY + V.titleSize);
  tg.addColorStop(0, COLORS.victoryGold1); tg.addColorStop(0.5, COLORS.victoryGold2); tg.addColorStop(1, COLORS.victoryGold3);
  ctx.fillStyle = tg; ctx.fillText('VICTORY', V.titleX, V.titleY);
  ctx.restore();

  // 「打败敌人！」灰框（右上）
  roundRectPath(ctx, V.msgX, V.msgY, V.msgW, V.msgH, 10);
  ctx.fillStyle = 'rgba(20,20,28,0.82)'; ctx.fill();
  ctx.strokeStyle = 'rgba(200,200,210,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  text(ctx, '打败敌人！', V.msgX + 30, V.msgY + V.msgH / 2, 26, '#fff', 'left', true);

  // 5 卡 + 获得值 + 等级 + 经验条
  const n = entries.length;
  const totalW = n * V.card.cw + (n - 1) * V.card.gap;
  let cx = (CANVAS_W - totalW) / 2 + V.card.cw / 2;
  const cy = V.card.top + V.card.ch / 2;
  for (const e of entries) {
    drawBattleCard(ctx, e.card, cx, cy, V.card.cw, V.card.ch, { rarityTag: e.rarityTag, lv: e.lv, heart: true });
    text(ctx, e.gain, cx, cy + V.gainDy - V.card.ch / 2 + 8, 15, '#7dd87d', 'center', true, true);
    text(ctx, `${e.levelLabel} »`, cx, cy + V.lvDy - V.card.ch / 2 + 8, 16, '#fff', 'center', true, true);
    // 经验条
    const ew = V.card.cw, ex = cx - ew / 2, ey = cy + V.expDy - V.card.ch / 2 + 8;
    roundRectPath(ctx, ex - 1.5, ey - 1.5, ew + 3, V.expH + 3, 3);
    ctx.fillStyle = COLORS.hpBarFrame; ctx.fill();
    const fg = ctx.createLinearGradient(0, ey, 0, ey + V.expH);
    fg.addColorStop(0, COLORS.expBar[0]); fg.addColorStop(1, COLORS.expBar[1]);
    const fw = Math.max(0, Math.min(1, e.expRatio)) * ew;
    if (fw > 0.5) { roundRectPath(ctx, ex, ey, fw, V.expH, 2); ctx.fillStyle = fg; ctx.fill(); }
    cx += V.card.cw + V.card.gap;
  }

  // OK 按钮
  const ox = CANVAS_W / 2 - V.okBtn.w / 2, oy = V.okBtn.y;
  glassButton(ctx, ox, oy, V.okBtn.w, V.okBtn.h, 'OK', { kind: 'green', hover: hover === 'victoryOk2', fontSize: 26 });
  ctx.restore();
  return [{ x: ox, y: oy, w: V.okBtn.w, h: V.okBtn.h, id: 'victoryOk2' }];
}

// ─────────────────────────── 探索/遭遇共用框架（进度条 + 行动力 + 资源栏 + 左侧竖排 + 菜单）───────────────────────────

export interface ExploreChromeData {
  stageLabel: string; progRatio: number; progText: string;
  energy: number; energyMax: number;
  resources: { icon: string; value: string }[];
}

export function drawExploreChrome(ctx: Ctx, d: ExploreChromeData, hover: string | null): Btn[] {
  const E = EXPLORE;
  const btns: Btn[] = [];
  ctx.save();

  // 顶部进度条（关卡标签 + 绿条 + 百分比）
  const P = E.progBar;
  roundRectPath(ctx, P.x, P.y, P.w, P.h, P.h / 2);
  ctx.fillStyle = 'rgba(10,10,16,0.8)'; ctx.fill();
  ctx.strokeStyle = 'rgba(220,220,230,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  const innerW = P.w - 130;
  const pg = ctx.createLinearGradient(0, P.y, 0, P.y + P.h);
  pg.addColorStop(0, '#9ae85a'); pg.addColorStop(1, '#3a9a20');
  roundRectPath(ctx, P.x + 78, P.y + 4, Math.max(0, innerW * d.progRatio), P.h - 8, (P.h - 8) / 2);
  ctx.fillStyle = pg; ctx.fill();
  text(ctx, d.stageLabel, P.x + 38, P.y + P.h / 2 + 1, 17, '#fff', 'center', true);
  text(ctx, d.progText, P.x + P.w - 34, P.y + P.h / 2 + 1, 16, '#fff', 'center', true);

  // 行动力绿框（左上）
  const eb = E.energy;
  const eg = ctx.createLinearGradient(0, eb.y, 0, eb.y + eb.h);
  eg.addColorStop(0, '#4a9a30'); eg.addColorStop(1, '#1a4a12');
  roundRectPath(ctx, eb.x, eb.y, eb.w, eb.h, 6);
  ctx.fillStyle = eg; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  text(ctx, '行动力', eb.x + eb.w / 2, eb.y + 18, 15, '#d8f0c8', 'center', true);
  text(ctx, `${d.energy}/${d.energyMax}`, eb.x + eb.w / 2, eb.y + 44, 16, '#fff', 'center', true);

  // 右侧资源竖栏
  d.resources.forEach((r, i) => {
    const ry = E.resRail.y0 + i * E.resRail.dy;
    text(ctx, r.icon, E.resRail.x + 12, ry + E.resRail.h / 2, 20, '#fff', 'center');
    roundRectPath(ctx, E.resRail.x + 26, ry, E.resRail.w, E.resRail.h, 4);
    ctx.fillStyle = COLORS.resBarBg; ctx.fill();
    text(ctx, r.value, E.resRail.x + 26 + E.resRail.w / 2, ry + E.resRail.h / 2 + 1, 14, '#ffe9a8', 'center', true);
  });

  // 左侧竖排：全恢复（橙）/ 部队2 / 部队编成（蓝绿）
  const sideItems: { label: string; id: string; kind: 'orange' | 'blue' }[] = [
    { label: '全恢复', id: 'sideHeal', kind: 'orange' },
    { label: '部队2', id: 'sideTeam', kind: 'blue' },
    { label: '部队编成', id: 'sideEdit', kind: 'blue' },
  ];
  sideItems.forEach((s, i) => {
    const sy = E.side.y0 + i * E.side.dy;
    glassButton(ctx, E.side.x + 4, sy, E.side.w, E.side.h, s.label, { kind: s.kind === 'orange' ? 'red' : 'blue', hover: hover === s.id, fontSize: 15 });
    btns.push({ x: E.side.x + 4, y: sy, w: E.side.w, h: E.side.h, id: s.id });
  });

  // 菜单圆钮（右下）
  drawCircleButton(ctx, E.menu.cx, E.menu.cy, E.menu.r, '菜单', hover === 'menu');
  btns.push({ x: E.menu.cx - E.menu.r, y: E.menu.cy - E.menu.r, w: E.menu.r * 2, h: E.menu.r * 2, id: 'menu' });

  ctx.restore();
  return btns;
}

/** 底部 5 卡横排（探索/遭遇/raid准备共用），返回每卡按钮 */
export function drawTeamStripBottom(
  ctx: Ctx, cards: { card: Card; lv: number; rarityTag: string; hpRatio: number; element: string }[],
  hover: string | null, t: number,
): Btn[] {
  const T = EXPLORE.team;
  const n = cards.length;
  const totalW = n * T.cw + (n - 1) * T.gap;
  let x = (CANVAS_W - totalW) / 2;
  const btns: Btn[] = [];
  cards.forEach((c, i) => {
    const cx = x + T.cw / 2, cy = T.top + T.ch / 2;
    drawBattleCard(ctx, c.card, cx, cy, T.cw, T.ch, { rarityTag: c.rarityTag, lv: c.lv, heart: true, rainbowT: t % 1 });
    drawHpBar(ctx, cx - 52, T.top + T.ch + 8, 104, 11, c.hpRatio, { element: c.element, iconR: 9 });
    btns.push({ x, y: T.top, w: T.cw, h: T.ch, id: `teamcard:${i}` });
    x += T.cw + T.gap;
  });
  return btns;
}
