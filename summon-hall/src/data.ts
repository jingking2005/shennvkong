/**
 * 数据层 — 卡目录访问（纯函数，零依赖）
 */

export type Rarity = 'N' | 'R' | 'SR' | 'UR' | 'LR' | 'X' | 'VR';

export interface CardStats {
  attack: number;
  defense: number;
  soldiers: number;
  speed: number;
  critRate: number;
  critDamage: number;
}

export interface Card {
  id: string;
  name: string;
  rarity: Rarity;
  element: string;
  cardCost: number;
  skillName: string;
  skillDesc: string;
  stats: CardStats;
  imageDir: string;
  imageFile: string;
}

interface RawCard {
  id: string;
  name: { cn: string; en: string };
  rarity: Rarity;
  element: string;
  cardCost: number;
  baseStats: any;
  /** 官方复刻标记：true 时 stats 直接采用 baseStats 原值（绕过 stat-scale 稀有度梯度） */
  wikiExact?: boolean;
  wiki?: {
    hasImage?: boolean;
    imageDir?: string;
    imageFile?: string;
    skillName?: string;
    skillDesc?: string;
  };
}

import rawCards from './cards.json';
import { scaledStats } from './data/stat-scale';

/** 官方复刻：直接采用 wiki 原值（卡牌 baseStats 即官方数值，跳过稀有度梯度） */
function exactStats(b: any): CardStats {
  return {
    attack: Math.round(b?.attack || 0),
    defense: Math.round(b?.defense || 0),
    soldiers: Math.round(b?.soldiers || 0),
    speed: b?.speed || 100,
    critRate: b?.critRate ?? 0.08,
    critDamage: b?.critDamage ?? 0.5,
  };
}

function toCard(r: RawCard): Card | null {
  const w = r.wiki;
  if (!w?.hasImage || !w.imageDir || !w.imageFile) return null;
  return {
    id: r.id,
    name: r.name?.cn || r.name?.en || r.id,
    rarity: r.rarity,
    element: r.element,
    cardCost: r.cardCost,
    skillName: w.skillName || '',
    skillDesc: w.skillDesc || '',
    // 数值梯度：wiki 原值跨稀有度平坦，经 stat-scale 重构为严格 N→VR 分层（original-fill）
    // 官方复刻卡（wikiExact）例外：直接采用 wiki 原值，不做梯度重构
    stats: r.wikiExact ? exactStats(r.baseStats) : scaledStats(r.rarity, r.baseStats),
    imageDir: w.imageDir,
    imageFile: w.imageFile,
  };
}

export const ALL_CARDS: Card[] = (rawCards as RawCard[])
  .map(toCard)
  .filter((c): c is Card => c !== null);

/** 官方复刻卡 id 集合（wikiExact 标记的卡：数值按 wiki 原值，不参与稀有度梯度） */
export const WIKI_EXACT_IDS: ReadonlySet<string> = new Set(
  (rawCards as RawCard[]).filter(r => r.wikiExact).map(r => r.id),
);

/** 可召唤卡池：剔除 SPECIAL 道具/装备/宝石（避免抽卡抽到非角色卡） */
export const SUMMON_CARDS: Card[] = ALL_CARDS.filter(c => (c.element || '').toUpperCase() !== 'SPECIAL');

/** 道具/装备类卡（不入抽卡池，仍可用于图鉴展示） */
export const ITEM_CARDS: Card[] = ALL_CARDS.filter(c => (c.element || '').toUpperCase() === 'SPECIAL');

const byId = new Map(ALL_CARDS.map(c => [c.id, c]));

export function getCard(id: string): Card | undefined {
  return byId.get(id);
}

export function cardsByRarity(rarity: Rarity): Card[] {
  return ALL_CARDS.filter(c => c.rarity === rarity);
}

export function imageUrl(card: Card): string {
  return `/images/${encodeURIComponent(card.imageDir)}/${encodeURIComponent(card.imageFile)}`;
}

export const RARITY_ORDER: Rarity[] = ['N', 'R', 'SR', 'UR', 'LR', 'X', 'VR'];

export const RARITY_RANK: Record<Rarity, number> = {
  N: 1, R: 2, SR: 3, UR: 4, LR: 5, X: 6, VR: 7,
};
