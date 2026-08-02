/**
 * 数据库层 — 内存实现的完整 Schema
 * 对应接口设计：User / Card / UserInventory / Stage / Building / WitchRaidBoss / EventPoint
 * 纯 TypeScript，零依赖，可测试，后续可替换为真实持久化。
 */

import type { Card, Rarity } from './data';

// ─────────────────────────── 元素与稀有度 ───────────────────────────

/** 四系元素（光/暗 互克，火/水树 互克） */
export type Element = 'passion' | 'cool' | 'light' | 'dark';

/** 稀有度梯度 N → R → HR → SR → HSR → UR → GUR（映射到现有数据稀有度） */
export const RARITY_TIER: Record<Rarity, number> = {
  N: 1, R: 2, SR: 3, UR: 4, LR: 5, X: 6, VR: 7,
};

/** 元素克制系数（0.8 / 1.0 / 1.5，落在 20%~50% 区间要求内） */
export function elementalMultiplier(atk: string, def: string): number {
  const a = norm(atk), d = norm(def);
  if (a === d) return 1.0;
  // 光 ↔ 暗 互克
  if ((a === 'light' && d === 'dark') || (a === 'dark' && d === 'light')) return 1.5;
  // 火(passion) ↔ 水/树(cool) 互克
  if ((a === 'passion' && d === 'cool') || (a === 'cool' && d === 'passion')) return 1.4;
  return 1.0;
}
function norm(e: string): Element {
  const s = (e || '').toLowerCase();
  if (s.includes('light') || s.includes('光')) return 'light';
  if (s.includes('dark') || s.includes('暗')) return 'dark';
  if (s.includes('cool') || s.includes('水') || s.includes('tree') || s.includes('树')) return 'cool';
  return 'passion';
}

// ─────────────────────────── Schema ───────────────────────────

/** 玩家 */
export interface User {
  uid: string;
  name: string;
  level: number;
  exp: number;
  energy: number;      // 体力（闯关）
  energyMax: number;
  battlePt: number;    // 战斗体力（讨伐魔女 AP）
  battlePtMax: number;
  gold: number;
  gems: number;        // 氪金石
  friendPt: number;
  tickets: Record<string, number>; // bannerId → 券数
}

/** 玩家持有的卡实例（库存项） */
export interface OwnedCard {
  instId: string;      // 实例 id
  cardId: string;      // 目录卡 id
  lv: number;
  exp: number;
  evoStage: number;    // 进化次数 0..n
  atkBonus: number;    // 进化继承累加
  hpBonus: number;
  locked: boolean;
}

/** 库存（卡牌仓库） */
export interface UserInventory {
  uid: string;
  cards: OwnedCard[];
  capacity: number;
  materials: Record<string, number>; // 强化素材
}

/** 章节关卡 */
export interface Stage {
  regionId: string;
  stageId: string;
  name: string;
  energyCost: number;
  progress: number;        // 0..1
  firstClear: boolean;     // 是否已首通
  rewardClaimed100: boolean;
  enemyPower: number;      // 小怪强度
  bossCardId: string;
  /** 本关已走步数（遇敌节奏用） */
  stepsTaken: number;
  /** 本关已遇普通魔女次数 */
  witchEncounters: number;
  /** 本关是否已遇过大魔女 */
  archEncountered: boolean;
}

/** 王国建筑 */
export interface Building {
  buildingId: string;
  name: string;
  level: number;
  effect: string;          // 例如 'atk+5%'
}

/** 魔女（Raid Boss） */
export interface WitchRaidBoss {
  raidId: string;
  bossCardId: string;
  name: string;
  level: number;
  hp: number;
  hpMax: number;
  attack: number;
  archWitch: boolean;      // 是否超魔女
  discoveredBy: string;    // 发现者 uid
  expiresAt: number;       // 限时（epoch ms）
  damageLog: Record<string, number>; // uid → 累计伤害
  defeated: boolean;
  claimed: boolean;
}

/** 活动积分 */
export interface EventPoint {
  uid: string;
  points: number;
  raidKills: number;
  rank: number;
}

// ─────────────────────────── 内存库 ───────────────────────────

export interface DB {
  user: User;
  inventory: UserInventory;
  stages: Stage[];
  buildings: Building[];
  raids: WitchRaidBoss[];
  eventPoint: EventPoint;
}

let instCounter = 1;
export function newInstId(): string { return `inst_${instCounter++}`; }

export function makeOwnedCard(cardId: string, lv = 1): OwnedCard {
  return { instId: newInstId(), cardId, lv, exp: 0, evoStage: 0, atkBonus: 0, hpBonus: 0, locked: false };
}

/** 种子：初始化数据库 */
export function seedDB(pickCards: (r: Rarity, n: number) => Card[]): DB {
  const inv: UserInventory = { uid: 'u1', cards: [], capacity: 300, materials: { enhanceStone: 50, evolveGem: 10 } };
  // 初始给几张卡
  const seed: [Rarity, number][] = [['X', 1], ['VR', 1], ['LR', 2], ['UR', 3], ['SR', 5], ['R', 10], ['N', 10]];
  for (const [r, n] of seed) {
    for (const c of pickCards(r, n)) inv.cards.push(makeOwnedCard(c.id, 1 + RARITY_TIER[r] * 3));
  }
  const stages: Stage[] = [
    {
      regionId: 'r1', stageId: 'r1-s1', name: '战斗少女的修练场', energyCost: 10,
      progress: 0, firstClear: false, rewardClaimed100: false, enemyPower: 8000, bossCardId: '',
      stepsTaken: 0, witchEncounters: 0, archEncountered: false,
    },
    {
      regionId: 'r1', stageId: 'r1-s2', name: '神界地图 2', energyCost: 10,
      progress: 0, firstClear: false, rewardClaimed100: false, enemyPower: 15000, bossCardId: '',
      stepsTaken: 0, witchEncounters: 0, archEncountered: false,
    },
  ];
  const buildings: Building[] = [
    { buildingId: 'b1', name: '剑之祭坛', level: 3, effect: 'atk+9%' },
    { buildingId: 'b2', name: '盾之祭坛', level: 2, effect: 'hp+6%' },
  ];
  return {
    user: {
      uid: 'u1', name: '星术师·阿尔德', level: 88, exp: 0.42,
      energy: 3000, energyMax: 3000,
      battlePt: 5, battlePtMax: 5,
      gold: 788038, gems: 854, friendPt: 99999,
      tickets: { fate: 2, legendary: 99, divine: 99, friend: 99, 'lr-guaranteed': 99, collab: 99, element: 99 },
    },
    inventory: inv,
    stages,
    buildings,
    raids: seedDemoRaids(pickCards),
    eventPoint: { uid: 'u1', points: 0, raidKills: 2, rank: 0 },
  };
}

/** 示范战绩：两场已讨伐魔女（一张可领、一张已领） */
function seedDemoRaids(pickCards: (r: Rarity, n: number) => Card[]): WitchRaidBoss[] {
  const a = pickCards('LR', 1)[0] ?? pickCards('UR', 1)[0];
  const b = pickCards('X', 1)[0] ?? pickCards('LR', 2)[1] ?? a;
  const now = Date.now();
  return [
    {
      raidId: 'demo_raid_1',
      bossCardId: a?.id ?? '',
      name: a?.name ?? '露娜·列拿',
      level: 200,
      hp: 0, hpMax: 940500,
      attack: 8000,
      archWitch: false,
      discoveredBy: '星术师·阿尔德',
      expiresAt: now + 86400000,
      damageLog: { u1: 940500 },
      defeated: true,
      claimed: false,
    },
    {
      raidId: 'demo_raid_2',
      bossCardId: b?.id ?? '',
      name: b?.name ?? '萨薇',
      level: 999,
      hp: 0, hpMax: 99999999,
      attack: 20000,
      archWitch: true,
      discoveredBy: '月轮骑士团',
      expiresAt: now + 86400000,
      damageLog: { u1: 99999999 },
      defeated: true,
      claimed: true,
    },
  ];
}
