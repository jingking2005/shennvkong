/**
 * 数值梯度（original-fill）：wiki baseStats 跨稀有度几乎平坦（N/R/SR/UR/LR 均值≈2000，
 * 且大量卡贴 800 下限），无法体现 N→LR 强弱。本模块把最终数值重构为
 *   final = rarityBase[rarity] + wikiBase × WIKI_WEIGHT
 * 保证任意高稀有度卡 > 任意低稀有度卡，wiki 原值只提供同稀有度内的个体差异。
 * 该变换是原创填充，不冒充原版数值。
 */

import type { Rarity } from '../data';

/** 本地稀有度梯度（与 data.ts RARITY_RANK 一致；独立定义避免循环依赖） */
const RANK: Record<Rarity, number> = { N: 1, R: 2, SR: 3, UR: 4, LR: 5, X: 6, VR: 7 };

export interface RawStats {
  attack: number;
  defense: number;
  soldiers: number;
  speed: number;
  critRate: number;
  critDamage: number;
}

/** 各稀有度基准攻击/防御（original-fill）：档间距 > wiki 原值×权重最大值，严格分层 */
const RARITY_ATK_BASE: Record<Rarity, number> = {
  N: 400, R: 800, SR: 1400, UR: 2200, LR: 3400, X: 5000, VR: 7000,
};
const RARITY_DEF_BASE: Record<Rarity, number> = {
  N: 300, R: 600, SR: 1050, UR: 1650, LR: 2550, X: 3750, VR: 5250,
};
/** wiki 原值权重：上限 5000×0.05=250 < 最小档距 400，保证不跨档 */
const WIKI_WEIGHT = 0.05;

export function scaledStats(rarity: Rarity, base: Partial<RawStats> | undefined): RawStats {
  const b = base || {};
  const w = (v: number | undefined) => Math.round((v || 0) * WIKI_WEIGHT);
  return {
    attack: RARITY_ATK_BASE[rarity] + w(b.attack),
    defense: RARITY_DEF_BASE[rarity] + w(b.defense),
    soldiers: Math.round((b.soldiers || 0) * (0.6 + RANK[rarity] * 0.2)),
    speed: b.speed || 100,
    critRate: b.critRate || 20,
    critDamage: b.critDamage || 150,
  };
}
