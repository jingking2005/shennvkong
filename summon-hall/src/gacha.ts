/**
 * 抽卡引擎 — 零依赖，支持种子，可测试
 */

import { SUMMON_CARDS, RARITY_RANK, type Card, type Rarity } from './data';

export interface PoolEntry { rarity: Rarity; weight: number; }

export interface Banner {
  id: string;
  name: string;
  sub: string;
  accent: string;
  costSingle: number;
  costTen: number;
  pool: PoolEntry[];
  softPity: Rarity;      // 十连至少一张
  hardPity?: { rarity: Rarity; threshold: number };
  /** UP 指定卡（哪几张；命中该稀有度时高概率出） */
  up?: { cardId: string; upRate: number }[]; // upRate 0..1：命中稀有度时走 UP 池的概率
  /** 限池：只从这些卡里抽（默认全卡池） */
  limitedTo?: string[];  // cardId 白名单
}

export const BANNERS: Banner[] = [
  {
    id: 'fate', name: '命运之门', sub: '常驻 · 全稀有度', accent: '#8b7ff0',
    costSingle: 300, costTen: 3000,
    pool: [
      { rarity: 'N', weight: 38 }, { rarity: 'R', weight: 34 },
      { rarity: 'SR', weight: 18 }, { rarity: 'UR', weight: 7.5 },
      { rarity: 'LR', weight: 2.0 }, { rarity: 'X', weight: 0.45 },
      { rarity: 'VR', weight: 0.05 },
    ],
    softPity: 'SR', hardPity: { rarity: 'UR', threshold: 50 },
  },
  {
    id: 'legend', name: '金色传说', sub: 'UR↑ · LR/X 限定', accent: '#e8b23b',
    costSingle: 500, costTen: 5000,
    pool: [
      { rarity: 'SR', weight: 40 }, { rarity: 'UR', weight: 34 },
      { rarity: 'LR', weight: 18 }, { rarity: 'X', weight: 6.5 },
      { rarity: 'VR', weight: 1.5 },
    ],
    softPity: 'UR', hardPity: { rarity: 'LR', threshold: 30 },
  },
  {
    id: 'oracle', name: '神谕召唤', sub: '限时 · X/VR UP', accent: '#ff6ea8',
    costSingle: 600, costTen: 6000,
    pool: [
      { rarity: 'R', weight: 30 }, { rarity: 'SR', weight: 35 },
      { rarity: 'UR', weight: 22 }, { rarity: 'LR', weight: 9 },
      { rarity: 'X', weight: 3.2 }, { rarity: 'VR', weight: 0.8 },
    ],
    softPity: 'SR', hardPity: { rarity: 'X', threshold: 40 },
    // X / VR 各指定 3 张 UP（前三种固定代表性卡，样例；若指定卡在 SUMMON_CARDS 中不存在则自动退化为全稀有度池）
    up: [],
  },
  {
    id: 'friend', name: '友情召唤', sub: '友情点 · 日常', accent: '#6fce9a',
    costSingle: 100, costTen: 1000,
    pool: [
      { rarity: 'N', weight: 55 }, { rarity: 'R', weight: 32 },
      { rarity: 'SR', weight: 10 }, { rarity: 'UR', weight: 2.5 },
      { rarity: 'LR', weight: 0.5 },
    ],
    softPity: 'R',
  },
  {
    id: 'lr-guaranteed', name: 'LR 确定召唤', sub: '10连必出 LR', accent: '#ff5c8a',
    costSingle: 0, costTen: 8000,
    pool: [
      { rarity: 'UR', weight: 60 }, { rarity: 'LR', weight: 30 },
      { rarity: 'X', weight: 8 }, { rarity: 'VR', weight: 2 },
    ],
    softPity: 'UR', hardPity: { rarity: 'LR', threshold: 10 },
  },
  {
    id: 'collab', name: '魔界出击联动召唤', sub: '联动 · 限定卡 UP', accent: '#3ef0e0',
    costSingle: 500, costTen: 5000,
    pool: [
      { rarity: 'SR', weight: 38 }, { rarity: 'UR', weight: 36 },
      { rarity: 'LR', weight: 18 }, { rarity: 'X', weight: 6.5 },
      { rarity: 'VR', weight: 1.5 },
    ],
    softPity: 'UR', hardPity: { rarity: 'X', threshold: 30 },
    up: [],
  },
  {
    id: 'element', name: '元素精选召唤', sub: '光/暗/炎 轮换 UP', accent: '#ffb42e',
    costSingle: 400, costTen: 4000,
    pool: [
      { rarity: 'R', weight: 30 }, { rarity: 'SR', weight: 40 },
      { rarity: 'UR', weight: 22 }, { rarity: 'LR', weight: 6.5 },
      { rarity: 'X', weight: 1.5 },
    ],
    softPity: 'SR', hardPity: { rarity: 'UR', threshold: 40 },
    up: [],
  },
];

export interface Pull {
  card: Card;
  isNew: boolean;
  isPity: boolean;
}

/** 提供比率一览（按稀有度聚合） */
export function rateTable(banner: Banner): { rarity: Rarity; pct: number; count: number }[] {
  const total = banner.pool.reduce((s, e) => s + e.weight, 0);
  return banner.pool
    .map(e => ({
      rarity: e.rarity,
      pct: (e.weight / total) * 100,
      count: bannerCards(banner).filter(c => c.rarity === e.rarity).length,
    }))
    .sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity]);
}

/** 当前卡池可抽到的代表卡（详情浮层展示用，按稀有度取前 N）；优先展示 UP 卡 */
export function bannerShowcase(banner: Banner, perRarity = 4): Card[] {
  const rarities = [...new Set(banner.pool.map(e => e.rarity))]
    .sort((a, b) => RARITY_RANK[b] - RARITY_RANK[a]);
  const out: Card[] = [];
  for (const r of rarities) {
    const up = (banner.up || []).map(u => u.cardId);
    const pool = bannerCards(banner).filter(c => c.rarity === r);
    const ups = pool.filter(c => up.includes(c.id)).slice(0, Math.max(1, Math.floor(perRarity / 2)));
    const rest = pool.filter(c => !up.includes(c.id)).slice(0, perRarity);
    out.push(...ups, ...rest);
  }
  return out;
}

/** 卡池可抽卡集合：限池白名单优先，未配置则全可召唤池 */
export function bannerCards(banner: Banner): Card[] {
  if (banner.limitedTo?.length) {
    const set = new Set(banner.limitedTo);
    return SUMMON_CARDS.filter(c => set.has(c.id));
  }
  return SUMMON_CARDS;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const atLeast = (r: Rarity, min: Rarity) => RARITY_RANK[r] >= RARITY_RANK[min];

export class Gacha {
  private rand: () => number;
  private owned = new Set<string>();
  private hardCounter = new Map<string, number>();
  private byRarity = new Map<Rarity, Card[]>();

  constructor(seed = Date.now()) {
    this.rand = mulberry32(seed);
    for (const c of SUMMON_CARDS) {
      const list = this.byRarity.get(c.rarity) || [];
      list.push(c);
      this.byRarity.set(c.rarity, list);
    }
  }

  markOwned(ids: string[]): void {
    ids.forEach(id => this.owned.add(id));
  }

  pullOne(banner: Banner): Pull {
    const hardKey = banner.id;
    const n = (this.hardCounter.get(hardKey) || 0) + 1;
    let rarity: Rarity;
    let isPity = false;

    if (banner.hardPity && n >= banner.hardPity.threshold) {
      rarity = this.rollFrom(banner, banner.hardPity.rarity);
      isPity = true;
      this.hardCounter.set(hardKey, 0);
    } else {
      this.hardCounter.set(hardKey, n);
      rarity = this.rollWeighted(banner.pool);
    }

    const card = this.pickCard(rarity, banner);
    if (banner.hardPity && atLeast(card.rarity, banner.hardPity.rarity)) {
      this.hardCounter.set(hardKey, 0);
    }
    const isNew = !this.owned.has(card.id);
    this.owned.add(card.id);
    return { card, isNew, isPity };
  }

  pullTen(banner: Banner): Pull[] {
    const out: Pull[] = [];
    for (let i = 0; i < 10; i++) out.push(this.pullOne(banner));
    if (!out.some(p => atLeast(p.card.rarity, banner.softPity))) {
      const rarity = this.rollFrom(banner, banner.softPity);
      const card = this.pickCard(rarity, banner);
      const isNew = !this.owned.has(card.id);
      this.owned.add(card.id);
      out[9] = { card, isNew, isPity: true };
    }
    return out;
  }

  pityProgress(banner: Banner): { current: number; threshold: number } | null {
    if (!banner.hardPity) return null;
    return { current: this.hardCounter.get(banner.id) || 0, threshold: banner.hardPity.threshold };
  }

  private rollWeighted(pool: PoolEntry[]): Rarity {
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let roll = this.rand() * total;
    for (const e of pool) { roll -= e.weight; if (roll <= 0) return e.rarity; }
    return pool[pool.length - 1].rarity;
  }

  private rollFrom(banner: Banner, min: Rarity): Rarity {
    const sub = banner.pool.filter(e => atLeast(e.rarity, min));
    return sub.length ? this.rollWeighted(sub) : min;
  }

  /** 券保底：把卡升级到 min 稀有度（若已更高则保持） */
  upgradeTo(card: Card, min: Rarity): Card {
    if (atLeast(card.rarity, min)) return card;
    const c = this.pickCard(min);
    this.owned.add(c.id);
    return c;
  }

  private pickCard(rarity: Rarity, banner?: Banner): Card {
    // 优先从卡池可抽集合（限池白名单）内找该稀有度卡
    const pool = (banner ? bannerCards(banner) : SUMMON_CARDS).filter(c => c.rarity === rarity);
    if (pool.length) {
      // UP 命中：该稀有度时按 upRate 走 UP 池
      if (banner?.up?.length) {
        const upIds = new Set(banner.up.filter(u => pool.some(c => c.id === u.cardId)).map(u => u.cardId));
        const upPool = pool.filter(c => upIds.has(c.id));
        const upTotalRate = banner.up.reduce((s, u) => (upIds.has(u.cardId) ? s + u.upRate : s), 0);
        if (upPool.length && this.rand() < Math.min(1, upTotalRate)) {
          return upPool[Math.floor(this.rand() * upPool.length)];
        }
      }
      return pool[Math.floor(this.rand() * pool.length)];
    }
    // 降级到最近有卡稀有度（限池内）
    for (let rank = RARITY_RANK[rarity] - 1; rank >= 1; rank--) {
      const r = (Object.keys(RARITY_RANK) as Rarity[]).find(k => RARITY_RANK[k] === rank)!;
      const p = (banner ? bannerCards(banner) : SUMMON_CARDS).filter(c => c.rarity === r);
      if (p?.length) return p[Math.floor(this.rand() * p.length)];
    }
    const all = banner ? bannerCards(banner) : SUMMON_CARDS;
    return all[Math.floor(this.rand() * all.length)];
  }
}
