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

/** 闯关 / 讨伐战斗背景（归档 Battle/Background 全量 128 张） */
export const BATTLE_BGS: string[] = [
  '/archive/battle-bg/BattleBG_001.png',
  '/archive/battle-bg/BattleBG_002.png',
  '/archive/battle-bg/BattleBG_003.png',
  '/archive/battle-bg/BattleBG_004.png',
  '/archive/battle-bg/BattleBG_005.png',
  '/archive/battle-bg/BattleBG_006.png',
  '/archive/battle-bg/BattleBG_007.png',
  '/archive/battle-bg/BattleBG_008.png',
  '/archive/battle-bg/BattleBG_009.png',
  '/archive/battle-bg/BattleBG_010.png',
  '/archive/battle-bg/BattleBG_012.png',
  '/archive/battle-bg/BattleBG_014.png',
  '/archive/battle-bg/BattleBG_015.png',
  '/archive/battle-bg/BattleBG_016.png',
  '/archive/battle-bg/BattleBG_017.png',
  '/archive/battle-bg/BattleBG_018.png',
  '/archive/battle-bg/BattleBG_019.png',
  '/archive/battle-bg/BattleBG_020.png',
  '/archive/battle-bg/BattleBG_021.png',
  '/archive/battle-bg/BattleBG_022.png',
  '/archive/battle-bg/BattleBG_023.png',
  '/archive/battle-bg/BattleBG_027.png',
  '/archive/battle-bg/BattleBG_028.png',
  '/archive/battle-bg/BattleBG_029.png',
  '/archive/battle-bg/BattleBG_030.png',
  '/archive/battle-bg/BattleBG_031.png',
  '/archive/battle-bg/BattleBG_032.png',
  '/archive/battle-bg/BattleBG_033.png',
  '/archive/battle-bg/BattleBG_034.png',
  '/archive/battle-bg/BattleBG_035.png',
  '/archive/battle-bg/BattleBG_036.png',
  '/archive/battle-bg/BattleBG_037.png',
  '/archive/battle-bg/BattleBG_038.png',
  '/archive/battle-bg/BattleBG_039.png',
  '/archive/battle-bg/BattleBG_040.png',
  '/archive/battle-bg/BattleBG_041.png',
  '/archive/battle-bg/BattleBG_042.png',
  '/archive/battle-bg/BattleBG_045.png',
  '/archive/battle-bg/BattleBG_046.png',
  '/archive/battle-bg/BattleBG_047.png',
  '/archive/battle-bg/BattleBG_048.png',
  '/archive/battle-bg/BattleBG_049.png',
  '/archive/battle-bg/BattleBG_050.png',
  '/archive/battle-bg/BattleBG_051.png',
  '/archive/battle-bg/BattleBG_052.png',
  '/archive/battle-bg/BattleBG_053.png',
  '/archive/battle-bg/BattleBG_054.png',
  '/archive/battle-bg/BattleBG_055.png',
  '/archive/battle-bg/BattleBG_056.png',
  '/archive/battle-bg/BattleBG_057.png',
  '/archive/battle-bg/BattleBG_058.png',
  '/archive/battle-bg/BattleBG_059.png',
  '/archive/battle-bg/BattleBG_060.png',
  '/archive/battle-bg/BattleBG_061.png',
  '/archive/battle-bg/BattleBG_062.png',
  '/archive/battle-bg/BattleBG_063.png',
  '/archive/battle-bg/BattleBG_064.png',
  '/archive/battle-bg/BattleBG_065.png',
  '/archive/battle-bg/BattleBG_066.png',
  '/archive/battle-bg/BattleBG_067.png',
  '/archive/battle-bg/BattleBG_068.png',
  '/archive/battle-bg/BattleBG_069.png',
  '/archive/battle-bg/BattleBG_070.png',
  '/archive/battle-bg/BattleBG_071.png',
  '/archive/battle-bg/BattleBG_072.png',
  '/archive/battle-bg/BattleBG_073.png',
  '/archive/battle-bg/BattleBG_074.png',
  '/archive/battle-bg/BattleBG_075.png',
  '/archive/battle-bg/BattleBG_076.png',
  '/archive/battle-bg/BattleBG_077.png',
  '/archive/battle-bg/BattleBG_078.png',
  '/archive/battle-bg/BattleBG_079.png',
  '/archive/battle-bg/BattleBG_080.png',
  '/archive/battle-bg/BattleBG_081.png',
  '/archive/battle-bg/BattleBG_082.png',
  '/archive/battle-bg/BattleBG_083.png',
  '/archive/battle-bg/BattleBG_084.png',
  '/archive/battle-bg/BattleBG_085.png',
  '/archive/battle-bg/BattleBG_086.png',
  '/archive/battle-bg/BattleBG_087.png',
  '/archive/battle-bg/BattleBG_088.png',
  '/archive/battle-bg/BattleBG_089.png',
  '/archive/battle-bg/BattleBG_090.png',
  '/archive/battle-bg/BattleBG_091.png',
  '/archive/battle-bg/BattleBG_092.png',
  '/archive/battle-bg/BattleBG_093.png',
  '/archive/battle-bg/BattleBG_094.png',
  '/archive/battle-bg/BattleBG_095.png',
  '/archive/battle-bg/BattleBG_096.png',
  '/archive/battle-bg/BattleBG_097.png',
  '/archive/battle-bg/BattleBG_098.png',
  '/archive/battle-bg/BattleBG_099.png',
  '/archive/battle-bg/BattleBG_100.png',
  '/archive/battle-bg/BattleBG_101.png',
  '/archive/battle-bg/BattleBG_102.png',
  '/archive/battle-bg/BattleBG_103.png',
  '/archive/battle-bg/BattleBG_104.png',
  '/archive/battle-bg/BattleBG_105.png',
  '/archive/battle-bg/BattleBG_106.png',
  '/archive/battle-bg/BattleBG_107.png',
  '/archive/battle-bg/BattleBG_108.png',
  '/archive/battle-bg/BattleBG_109.png',
  '/archive/battle-bg/BattleBG_110.png',
  '/archive/battle-bg/BattleBG_111.png',
  '/archive/battle-bg/BattleBG_112.png',
  '/archive/battle-bg/BattleBG_113.png',
  '/archive/battle-bg/BattleBG_114.png',
  '/archive/battle-bg/BattleBG_116.png',
  '/archive/battle-bg/BattleBG_117.png',
  '/archive/battle-bg/BattleBG_118.png',
  '/archive/battle-bg/BattleBG_119.png',
  '/archive/battle-bg/BattleBG_120.png',
  '/archive/battle-bg/BattleBG_121.png',
  '/archive/battle-bg/BattleBG_122.png',
  '/archive/battle-bg/BattleBG_123.png',
  '/archive/battle-bg/BattleBG_500.png',
  '/archive/battle-bg/BattleBG_501.png',
  '/archive/battle-bg/BattleBG_502.png',
  '/archive/battle-bg/BattleBG_503.png',
  '/archive/battle-bg/BattleBG_600.png',
  '/archive/battle-bg/BattleBG_601.png',
  '/archive/battle-bg/BattleBG_602.png',
  '/archive/battle-bg/BattleBG_603.png',
  '/archive/battle-bg/BattleBG_610.png',
  '/archive/battle-bg/BattleBG_611.png',
  '/archive/battle-bg/BattleBG_612.png',
  '/archive/battle-bg/BattleBG_613.png',
  '/archive/battle-bg/BattleBG_620.png',
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

/** 强化药水（Items/Enhancement，探索掉落） */
export const ENHANCE_POTION = {
  icon: '/archive/items/Upgrade Potion.png',
  name: '强化药水',
  desc: '使用后为目标卡提供大量经验',
} as const;

/** 宝箱（卡包）：战斗胜利奖励，开启出卡片 */
export const CHEST = {
  bronze: '/archive/items/Card Bag (R).png',
  silver: '/archive/items/Card Bag (SR).png',
  gold: '/archive/items/Card Bag (UR).png',
} as const;
export type ChestQuality = keyof typeof CHEST;

/** 强化道具图标（Items/Enhancement 目录全量，未用之预备） */
export const ENHANCE_ITEM_ICONS: string[] = [
  '/archive/items/Miracle Drop (Login Bonus).png',
  '/archive/items/Miracle Drop (Voyage).png',
  '/archive/items/Miracle Drop＋(Limited-Time).png',
  '/archive/items/Miracle Drop＋(Voyage).png',
  '/archive/items/Mysterious Drop (Login Bonus).png',
  '/archive/items/Mysterious Drop (Soul Weapon).png',
  '/archive/items/Mysterious Drop＋ (Soul Weapon).png',
  '/archive/items/Spirit Drop (Login Bonus).png',
  '/archive/items/Spirit Drop (Tower).png',
  '/archive/items/Spirit Drop＋ (Tower).png',
  '/archive/items/Upgrade Potion+.png',
  '/archive/items/Upgrade Potion.png',
];

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
