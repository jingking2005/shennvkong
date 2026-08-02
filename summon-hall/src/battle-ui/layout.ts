/**
 * 战斗 UI 布局常量 — 以参考截图（约 1024×576）为唯一标准换算到 1280×720
 * 所有坐标/尺寸/颜色集中此处，后续调版只改本文件。
 */

export const CANVAS_W = 1280;
export const CANVAS_H = 760;

// ── 颜色（取自截图）──
export const COLORS = {
  hpBarEnemy: ['#4a9ae8', '#1a4a9a'],      // 敌血条蓝渐变
  hpBarAlly: ['#5ad8f0', '#1a6ab8'],       // 我方血条亮蓝渐变
  hpBarFrame: '#0a0a14',
  hpNumEnemy: '#ffe14d',                   // 敌血量数字黄
  hpNumAlly: '#7dd87d',                    // 我方血量数字绿
  elemCool: '#3a7bd5',                     // 元素菱形 蓝
  elemPassion: '#d54040',                  // 元素菱形 红
  elemLight: '#e8b83a',                    // 元素菱形 金
  elemDark: '#8a4cd8',                     // 元素菱形 紫
  starFill: '#ffe14d',
  starEdge: '#8a5a10',
  rareTagBg: '#7a2ad8',                    // 稀有度角标紫底
  lvTagBg: 'rgba(10,10,16,0.85)',          // Lv 标签黑底
  victoryGold1: '#fff6d8',
  victoryGold2: '#ffd24d',
  victoryGold3: '#a86a08',
  expBar: ['#6ce8d8', '#28a898'],          // 经验条青绿渐变
  circleBtnTop: '#f0a848',                 // 圆形按钮（撤退/自动）橙
  circleBtnBot: '#a85018',
  resBarBg: 'rgba(8,8,14,0.72)',
} as const;

// ── 战斗主界面 ──
export const BAT = {
  enemy: { cw: 150, ch: 214, cx: CANVAS_W / 2, cy: 140 },
  enemyHp: { w: 170, h: 15, dy: 126 },          // 相对敌卡中心向下偏移
  ally: { cw: 150, ch: 214, cy: 470, gap: 26 }, // 我方 5 卡
  allyHp: { w: 132, h: 13, dy: 122 },
  star: { r: 46, dy: -18 },                     // 技能星相对卡中心
  retreat: { cx: 56, cy: 694, r: 52 },
  auto: { cx: 1224, cy: 694, r: 52 },
  statusBtn: { x: 1100, y: 20, w: 152, h: 44 }, // 确认状态
} as const;

// ── 技能确认弹窗 ──
export const SKILL_DLG = {
  w: 580, h: 290,
  titleDy: -100,       // 技能名相对弹窗中心
  costDy: -58,
  descDy: -8,
  btnW: 190, btnH: 58, btnDy: 84,
  btnGap: 30,
} as const;

// ── 胜利结算 ──
export const VICTORY = {
  titleX: 56, titleY: 44, titleSize: 84,
  msgX: 628, msgY: 32, msgW: 566, msgH: 104,
  card: { cw: 170, ch: 242, top: 152, gap: 22 },
  gainDy: 268,         // 卡下绿色数字
  lvDy: 296,           // 等级文字
  expDy: 322, expH: 16,
  okBtn: { w: 220, h: 62, y: 652 },
} as const;

// ── 探索 / 遭遇界面共用 ──
export const EXPLORE = {
  progBar: { x: 358, y: 16, w: 564, h: 30 },
  energy: { x: 10, y: 58, w: 128, h: 64 },
  resRail: { x: 1148, y0: 88, dy: 60, w: 124, h: 30 },
  march: { x: 438, y: 412, w: 402, h: 64 },
  auto: { x: 882, y: 412, w: 180, h: 64 },
  side: { x: 0, w: 90, h: 54, y0: 288, dy: 68 },  // 左侧竖排：全恢复/部队/编成
  menu: { cx: 1226, cy: 698, r: 48 },
  team: { cw: 142, ch: 202, top: 518, gap: 14 },
} as const;

// ── 遭遇界面 ──
export const ENCOUNTER = {
  enemy: { cw: 170, ch: 242, cx: CANVAS_W / 2, cy: 196 },
  enemyHpDy: 138,
  start: { x: 438, y: 412, w: 402, h: 64 },
  auto: { x: 882, y: 412, w: 180, h: 64 },
} as const;
