/**
 * 素材路径集中管理
 * 正式界面只用相对 URL；参考截图勿混入此表。
 *
 * 归档源（本机）：
 *   神女控2/.../Battle/Map          → 活动/世界地图背景（可轮换）
 *   神女控2/.../Battle/Background   → 闯关战斗背景
 *   神女控2/.../Audio/stream        → BGM（Battle/Audio 目录为空，改用此处）
 */

/** 活动 / 女神地图背景（文件名需与归档一致；由 Vite 中间件提供） */
export const EVENT_MAP_BGS: string[] = [
  '/archive/map/AreaMap_001.Celestial Realm Campaign 1.png',
  '/archive/map/AreaMap_002_005.Enchanted Forest Storyteller.The Fairy Kingdom.png',
  '/archive/map/AreaMap_002_007.Spacetime Archwitches.Realm between Space and Time.png',
  '/archive/map/AreaMap_002_008.Gods of the Starry Skies.Heaven Galaxy.png',
  '/archive/map/AreaMap_002_010.Get Back the Halloween Cookies.Halloween Land.png',
  '/archive/map/AreaMap_002_016.A Valkyrie Valentine.Sweetland.png',
  '/archive/map/AreaMap_002_020.School of Valkyries.Celestial Academy.png',
  '/archive/map/AreaMap_002_022.Cybercity.Cybercity.png',
  '/archive/map/AreaMap_002_031.Galactic Journey.Astral Nexus.png',
  '/archive/map/AreaMap_002_037.Valkyrie Kingdom.Kingdom Streets.png',
  '/archive/map/AreaMap_002_041.Witch Gates Galore.Land of Ruin.png',
];

/** 闯关 / 讨伐战斗背景 */
export const BATTLE_BGS: string[] = [
  '/archive/battle-bg/BattleBG_001.png',
  '/archive/battle-bg/BattleBG_004.png',
  '/archive/battle-bg/BattleBG_008.png',
  '/archive/battle-bg/BattleBG_015.png',
  '/archive/battle-bg/BattleBG_020.png',
  '/archive/battle-bg/BattleBG_027.png',
  '/archive/battle-bg/BattleBG_032.png',
  '/archive/battle-bg/BattleBG_037.png',
  '/archive/battle-bg/BattleBG_042.png',
  '/archive/battle-bg/BattleBG_046.png',
];

/** 场景 BGM */
export const BGM = {
  main: '/archive/bgm/bgm_001 Main Theme.ogg',
  kingdom: '/archive/bgm/bgm_002 Kingdom.ogg',
  campaign: '/archive/bgm/bgm_003 Campaign.ogg',
  battle: '/archive/bgm/bgm_004 Battle.ogg',
  eventMap: '/archive/bgm/bgm_007 Event Map.ogg',
  archwitch: '/archive/bgm/bgm_005 Archwitch.ogg',
  fantasyArchwitch: '/archive/bgm/bgm_006 Fantasy Archwitch.ogg',
} as const;

export type BgmKey = keyof typeof BGM;

export function eventMapBg(index: number): string {
  return EVENT_MAP_BGS[((index % EVENT_MAP_BGS.length) + EVENT_MAP_BGS.length) % EVENT_MAP_BGS.length];
}

export function battleBg(index: number): string {
  return BATTLE_BGS[((index % BATTLE_BGS.length) + BATTLE_BGS.length) % BATTLE_BGS.length];
}

/** 简单图片缓存 */
const cache = new Map<string, HTMLImageElement>();

export function loadAssetImage(src: string): HTMLImageElement {
  let img = cache.get(src);
  if (img) return img;
  img = new Image();
  img.src = src;
  cache.set(src, img);
  return img;
}

/** cover 绘制（铺满画布，可裁边） */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  alpha = 1,
): void {
  if (!img.complete || !img.naturalWidth) return;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale, dh = ih * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  ctx.restore();
}
