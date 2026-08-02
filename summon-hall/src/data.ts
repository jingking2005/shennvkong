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
  wiki?: {
    hasImage?: boolean;
    imageDir?: string;
    imageFile?: string;
    skillName?: string;
    skillDesc?: string;
  };
}

import rawCards from './cards.json';

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
    stats: {
      attack: r.baseStats?.attack ?? 0,
      defense: r.baseStats?.defense ?? 0,
      soldiers: r.baseStats?.soldiers ?? 0,
      speed: r.baseStats?.speed ?? 0,
      critRate: r.baseStats?.critRate ?? 0,
      critDamage: r.baseStats?.critDamage ?? 0,
    },
    imageDir: w.imageDir,
    imageFile: w.imageFile,
  };
}

export const ALL_CARDS: Card[] = (rawCards as RawCard[])
  .map(toCard)
  .filter((c): c is Card => c !== null);

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
