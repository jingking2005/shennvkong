/**
 * UI 组件 — VC 风格玻璃质感
 * 玻璃胶囊按钮 / 金属边框弹窗 / 斜切角
 */

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
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

/** 斜切角面板路径（金属边框弹窗用） */
export function chamferPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, c: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

export interface GlassButtonOpts {
  kind: 'green' | 'red' | 'blue' | 'gray';
  hover?: boolean;
  pressed?: boolean;
  fontSize?: number;
}

const GLASS_COLORS: Record<string, { top: string; mid: string; bot: string; edge: string; text: string }> = {
  green: { top: '#a8f0b8', mid: '#3fae5e', bot: '#1a6e38', edge: '#c9f5d4', text: '#0a3018' },
  red:   { top: '#f6b0a0', mid: '#c9402e', bot: '#7a1c12', edge: '#f5cfc4', text: '#3a0e08' },
  blue:  { top: '#a9ccf5', mid: '#4a86d8', bot: '#1e4a8a', edge: '#cfe2f8', text: '#0e2340' },
  gray:  { top: '#d8dce2', mid: '#8a919c', bot: '#4a505a', edge: '#e8ecf2', text: '#22262c' },
};

/** 玻璃胶囊按钮（VC 风格：多层渐变 + 高光弧面 + 金属描边 + 投影） */
export function glassButton(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string, opts: GlassButtonOpts,
): void {
  const c = GLASS_COLORS[opts.kind];
  const r = h / 2;
  const lift = opts.hover && !opts.pressed ? -1.5 : 0;
  y += lift;

  ctx.save();

  // 投影
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = opts.hover ? 18 : 10;
  ctx.shadowOffsetY = 4;

  // 主体垂直渐变（顶亮 → 中 → 底暗）
  const body = ctx.createLinearGradient(0, y, 0, y + h);
  body.addColorStop(0, c.top);
  body.addColorStop(0.45, c.mid);
  body.addColorStop(1, c.bot);
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 上半高光弧面（玻璃反光核心）
  const gloss = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
  gloss.addColorStop(0, 'rgba(255,255,255,0.55)');
  gloss.addColorStop(1, 'rgba(255,255,255,0.02)');
  roundRectPath(ctx, x + 2, y + 1.5, w - 4, h * 0.55, r * 0.9);
  ctx.fillStyle = gloss;
  ctx.fill();

  // 底部内反射
  const refl = ctx.createLinearGradient(0, y + h * 0.7, 0, y + h);
  refl.addColorStop(0, 'rgba(255,255,255,0)');
  refl.addColorStop(1, 'rgba(255,255,255,0.16)');
  roundRectPath(ctx, x + 2, y + h * 0.55, w - 4, h * 0.45 - 2, r * 0.9);
  ctx.fillStyle = refl;
  ctx.fill();

  // 金属外描边
  const edge = ctx.createLinearGradient(0, y, 0, y + h);
  edge.addColorStop(0, c.edge);
  edge.addColorStop(1, 'rgba(0,0,0,0.4)');
  roundRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // 内亮线
  roundRectPath(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r - 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 文字（亮字 + 深色投影，悬停发光）
  ctx.font = `bold ${opts.fontSize ?? 16}px system-ui, "PingFang SC", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (opts.hover) {
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 10;
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}

/** 金属边框弹窗（VC 确认框：斜切角 + 银边 + 内嵌凹槽面板） */
export function metalDialog(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
): void {
  const c = 14; // 斜切量
  ctx.save();

  // 外投影
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 6;

  // 金属银边框（多段渐变模拟拉丝金属）
  const frame = ctx.createLinearGradient(x, y, x, y + h);
  frame.addColorStop(0, '#f0f4f8');
  frame.addColorStop(0.2, '#9aa4b0');
  frame.addColorStop(0.5, '#e8edf2');
  frame.addColorStop(0.8, '#7a8492');
  frame.addColorStop(1, '#c8d0da');
  chamferPath(ctx, x, y, w, h, c);
  ctx.fillStyle = frame;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 边框内侧暗线
  chamferPath(ctx, x + 3, y + 3, w - 6, h - 6, c - 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 内嵌凹槽面板（深蓝黑，上亮下暗径向）
  const px = x + 8, py = y + 8, pw = w - 16, ph = h - 16;
  const inner = ctx.createRadialGradient(
    px + pw / 2, py + ph * 0.2, ph * 0.1,
    px + pw / 2, py + ph / 2, ph,
  );
  inner.addColorStop(0, '#2a3850');
  inner.addColorStop(0.5, '#1a2436');
  inner.addColorStop(1, '#0d1420');
  chamferPath(ctx, px, py, pw, ph, c - 4);
  ctx.fillStyle = inner;
  ctx.fill();

  // 凹槽顶部高光（凹陷感）
  chamferPath(ctx, px, py, pw, ph, c - 4);
  const innerEdge = ctx.createLinearGradient(0, py, 0, py + ph);
  innerEdge.addColorStop(0, 'rgba(255,255,255,0.22)');
  innerEdge.addColorStop(0.15, 'rgba(255,255,255,0)');
  innerEdge.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.strokeStyle = innerEdge;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

/** 弹窗刻字（凹陷文字：上暗下亮制造雕刻感） */
export function engravedText(
  ctx: CanvasRenderingContext2D,
  str: string, x: number, y: number, size: number,
): void {
  ctx.save();
  ctx.font = `bold ${size}px system-ui, "PingFang SC", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // 底部亮线（雕刻高光）
  ctx.fillStyle = 'rgba(160,190,230,0.6)';
  ctx.fillText(str, x, y + 1.5);
  // 主体深色
  ctx.fillStyle = '#e8eef6';
  ctx.fillText(str, x, y);
  ctx.restore();
}
