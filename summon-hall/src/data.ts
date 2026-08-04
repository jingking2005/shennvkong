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

/** 官方形态（wiki 复刻）：满级数值 + 反向推导的 Lv1 基础值 */
export interface OfficialForm {
  maxLv: number;
  atk: number;
  def: number;
  soldiers: number;
  baseAtk: number;
  baseDef: number;
  baseSoldiers: number;
}

/** 官方中文技能（按形态） */
export interface OfficialSkill {
  name?: string;
  desc?: string;
  descMax?: string;
  skill2Name?: string;
  skill2Desc?: string;
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
  /** 进化（HUR）图文件名（wiki） */
  evolvedFile?: string;
  /** 觉醒/重生（XUR）图文件名（wiki） */
  awakenFile?: string;
  /** 官方形态数据（wiki 复刻）：UR/HUR/GUR/XUR → 满级值 + Lv1 基础值 */
  officialForms?: Record<string, OfficialForm>;
  /** 官方中文技能（按形态） */
  skillsZh?: Record<string, OfficialSkill>;
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
  /** 官方形态数据（wiki 复刻） */
  officialForms?: Record<string, OfficialForm>;
  /** 官方中文技能（按形态） */
  skillsZh?: Record<string, OfficialSkill>;
  wiki?: {
    hasImage?: boolean;
    imageDir?: string;
    imageFile?: string;
    evolvedFile?: string;
    awakenFile?: string;
    skillName?: string;
    skillDesc?: string;
    skillDescMax?: string;
  };
}

import rawCards from './cards.json';
import { scaledStats } from './data/stat-scale';

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
    // 官方复刻（officialForms）：UR 档反向推导的 Lv1 基础值作为游戏基础数值
    // （战斗/展示均按官方满级曲线）；无官方数据回退 stat-scale 稀有度梯度
    stats: r.officialForms?.UR
      ? {
          attack: r.officialForms.UR.baseAtk,
          defense: r.officialForms.UR.baseDef,
          soldiers: r.officialForms.UR.baseSoldiers,
          speed: r.baseStats?.speed || 100,
          critRate: r.baseStats?.critRate ?? 0.08,
          critDamage: r.baseStats?.critDamage ?? 0.5,
        }
      : scaledStats(r.rarity, r.baseStats),
    imageDir: w.imageDir,
    imageFile: w.imageFile,
    evolvedFile: w.evolvedFile || undefined,
    awakenFile: w.awakenFile || undefined,
    officialForms: r.officialForms,
    skillsZh: r.skillsZh,
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
