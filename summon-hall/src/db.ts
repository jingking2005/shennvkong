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
  energyRecoverAt: number; // 上一点行动力恢复完成的时刻（epoch ms）
  battlePt: number;    // 战斗体力（讨伐魔女 AP）
  battlePtMax: number;
  battlePtRecoverAt: number; // 上一点 AP 恢复完成的时刻（epoch ms）
  gold: number;
  gems: number;        // 氪金石
  friendPt: number;
  tickets: Record<string, number>; // bannerId → 券数
  /** 商店：累计充值宝石数 */
  paidGems: number;
  /** 商店：各档位已购次数（首充双倍按档判定，key 如 gem60/gem300…） */
  paidTiers: Record<string, number>;
  /** 月卡到期时间戳（0/缺省 = 无） */
  monthCardUntil: number;
  /** 月卡每日领取日期（YYYY-MM-DD），当天已领则不再发放 */
  monthCardLastClaim: string | null;
  /** 签到：连续签到天数（决定 7 日表位置） */
  loginStreak: number;
  /** 签到：上次领取日期（YYYY-MM-DD）；断签则 streak 重置 */
  loginLastClaim: string | null;
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
  /** 获得时间戳（用于 NEW 标记）；种子/旧存档缺省 */
  gainedAt?: number;
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

/** 关卡定义模板（顺序即解锁顺序） */
const STAGE_DEFS: { regionId: string; stageId: string; name: string; energyCost: number; enemyPower: number }[] = [
  { regionId: 'r1', stageId: 'r1-s1', name: '战斗少女的修练场', energyCost: 10, enemyPower: 8000 },
  { regionId: 'r1', stageId: 'r1-s2', name: '神界地图 2', energyCost: 10, enemyPower: 15000 },
  { regionId: 'r1', stageId: 'r1-s3', name: '圣炎回廊', energyCost: 15, enemyPower: 32000 },
  { regionId: 'r1', stageId: 'r1-s4', name: '苍雷王座', energyCost: 20, enemyPower: 60000 },
];

/** 体力数值平衡：上限 120（3min/点 → 约 6 小时回满），出战一趟扣 10 */
export const ENERGY_MAX = 120;
/** 仓库默认容量 */
export const INV_CAPACITY = 200;

function newStage(def: (typeof STAGE_DEFS)[number]): Stage {
  return {
    ...def, bossCardId: '',
    progress: 0, firstClear: false, rewardClaimed100: false,
    stepsTaken: 0, witchEncounters: 0, archEncountered: false,
  };
}

let instCounter = 1;
export function newInstId(): string { return `inst_${instCounter++}`; }

// ─────────────────────────── 持久化（localStorage）───────────────────────────

const LS_DB = 'summonHall_db_v1';
const LS_INST = 'summonHall_instCounter';

export function saveDB(db: DB): void {
  try {
    localStorage.setItem(LS_DB, JSON.stringify(db));
    localStorage.setItem(LS_INST, String(instCounter));
  } catch (e) {
    console.error('saveDB failed', e);
  }
}

/** 读取存档；无存档或损坏返回 null */
export function loadDB(): DB | null {
  try {
    const raw = localStorage.getItem(LS_DB);
    if (!raw) return null;
    const db = JSON.parse(raw) as DB;
    if (!db?.user || !db?.inventory?.cards) return null;
    if (db.user.battlePtRecoverAt === undefined) db.user.battlePtRecoverAt = Date.now();
    if (db.user.energyRecoverAt === undefined) db.user.energyRecoverAt = Date.now();
    // 战斗体力上限迁移：旧存档 5/30 → 2000
    if (!db.user.battlePtMax || db.user.battlePtMax < 2000) {
      db.user.battlePtMax = 2000;
      db.user.battlePt = Math.max(db.user.battlePt || 0, 2000);
      db.user.battlePtRecoverAt = Date.now();
    }
    // 体力上限迁移：旧原型 3000 → 120（3min/点满需 150h，等于死锁）
    if (!db.user.energyMax || db.user.energyMax > ENERGY_MAX) {
      db.user.energyMax = ENERGY_MAX;
      db.user.energy = Math.min(db.user.energy ?? 0, ENERGY_MAX);
      db.user.energyRecoverAt = Date.now();
    }
    // 仓库容量迁移：旧 300 → 200
    if (!db.inventory.capacity || db.inventory.capacity > INV_CAPACITY) {
      db.inventory.capacity = INV_CAPACITY;
    }
    // 召唤券键名迁移：旧 named legendary/divine → 卡池 id legend/oracle
    const tix = db.user.tickets;
    if (tix && (tix['legendary'] !== undefined || tix['divine'] !== undefined)) {
      if (tix['legend'] === undefined) tix['legend'] = tix['legendary'] ?? 0;
      if (tix['oracle'] === undefined) tix['oracle'] = tix['divine'] ?? 0;
      delete tix['legendary'];
      delete tix['divine'];
    }
    // 商店字段迁移
    if (typeof db.user.paidGems !== 'number') db.user.paidGems = 0;
    if (!db.user.paidTiers || typeof db.user.paidTiers !== 'object') {
      // 旧存档：曾充值过则视为所有档首充已用
      db.user.paidTiers = db.user.paidGems > 0
        ? { gem60: 1, gem300: 1, gem980: 1, gem1980: 1, gem3280: 1, gem6480: 1 }
        : {};
    }
    if (typeof db.user.monthCardUntil !== 'number') db.user.monthCardUntil = 0;
    if (typeof db.user.monthCardLastClaim !== 'string') db.user.monthCardLastClaim = null;
    if (typeof db.user.loginStreak !== 'number') db.user.loginStreak = 0;
    if (typeof db.user.loginLastClaim !== 'string') db.user.loginLastClaim = null;
    if (!db.inventory.materials) db.inventory.materials = {};
    if (db.inventory.materials.upgradePotion === undefined) db.inventory.materials.upgradePotion = 0;
    // 关卡迁移：补齐新增关卡
    if (!Array.isArray(db.stages)) db.stages = [];
    for (const def of STAGE_DEFS) {
      if (!db.stages.some(s => s.stageId === def.stageId)) db.stages.push(newStage(def));
    }
    const inst = parseInt(localStorage.getItem(LS_INST) || '0', 10);
    if (Number.isFinite(inst) && inst > instCounter) instCounter = inst;
    return db;
  } catch (e) {
    console.error('loadDB failed', e);
    return null;
  }
}

export function clearDB(): void {
  localStorage.removeItem(LS_DB);
  localStorage.removeItem(LS_INST);
}

export function makeOwnedCard(cardId: string, lv = 1): OwnedCard {
  return { instId: newInstId(), cardId, lv, exp: 0, evoStage: 0, atkBonus: 0, hpBonus: 0, locked: false, gainedAt: Date.now() };
}

/** 种子：初始化数据库 */
export function seedDB(pickCards: (r: Rarity, n: number) => Card[]): DB {
  const inv: UserInventory = { uid: 'u1', cards: [], capacity: INV_CAPACITY, materials: { upgradePotion: 3, enhanceStone: 50, evolveGem: 10 } };
  // 初始给几张卡（用可召唤池）
  const seed: [Rarity, number][] = [['X', 1], ['VR', 1], ['LR', 2], ['UR', 3], ['SR', 5], ['R', 10], ['N', 10]];
  for (const [r, n] of seed) {
    for (const c of pickCards(r, n)) inv.cards.push(makeOwnedCard(c.id, 1 + RARITY_TIER[r] * 3));
  }
  const stages: Stage[] = STAGE_DEFS.map(newStage);
  const buildings: Building[] = [
    { buildingId: 'b1', name: '剑之祭坛', level: 3, effect: 'atk+9%' },
    { buildingId: 'b2', name: '盾之祭坛', level: 2, effect: 'hp+6%' },
  ];
  return {
    user: {
      uid: 'u1', name: '星术师·阿尔德', level: 88, exp: 0.42,
      energy: ENERGY_MAX, energyMax: ENERGY_MAX, energyRecoverAt: Date.now(),
      battlePt: 2000, battlePtMax: 2000, battlePtRecoverAt: Date.now(),
      gold: 78000, gems: 3000, friendPt: 9999,
      tickets: { fate: 3, legend: 3, oracle: 3, friend: 30, 'lr-guaranteed': 1, collab: 0, element: 1 },
      paidGems: 0, paidTiers: {}, monthCardUntil: Date.now() + 30 * 86400000, monthCardLastClaim: null,
      loginStreak: 0, loginLastClaim: null,
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
