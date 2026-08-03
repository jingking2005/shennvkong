/**
 * 抽卡引擎（OC-07）：概率/保底全部来自 gacha-config.json（original-fill 离线演示配置）。
 * seed 注入，纯逻辑；表现层（动画/光效）读 gacha-visuals.json，与结算解耦。
 * 保底模型：softPity=十连必出；hardPities=多级硬保底（如 UR 45 / LR 80），
 * 每档独立计数「自上次命中 ≥该稀有度以来的抽数」，到阈值强制命中。
 */

import { SUMMON_CARDS, RARITY_RANK, type Card, type Rarity } from '../../data';
import { mulberry32 } from '../battle/rng';
import configJson from './gacha-config.json';

export interface PoolEntry { rarity: Rarity; weight: number; }

export interface HardPity { rarity: Rarity; threshold: number; }

export interface Banner {
  id: string;
  name: string;
  sub: string;
  accent: string;
  costSingle: number;
  costTen: number;
  pool: PoolEntry[];
  softPity: Rarity;
  hardPities?: HardPity[];
  up?: { cardId: string; upRate: number }[];
  limitedTo?: string[];
}

/** 概率/保底唯一事实源：gacha-config.json */
export const BANNERS: Banner[] = (configJson as { banners: Banner[] }).banners;

export interface Pull {
  card: Card;
  isNew: boolean;
  isPity: boolean;
}

const atLeast = (r: Rarity, min: Rarity) => RARITY_RANK[r] >= RARITY_RANK[min];

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

export interface PityProgress { rarity: Rarity; current: number; threshold: number; }

export class Gacha {
  private rand: () => number;
  private owned = new Set<string>();
  /** bannerId → rarity → 距上次命中 ≥rarity 的抽数 */
  private counters = new Map<string, Map<Rarity, number>>();

  constructor(seed = Date.now()) {
    this.rand = mulberry32(seed);
  }

  markOwned(ids: string[]): void {
    ids.forEach(id => this.owned.add(id));
  }

  /** 保底计数持久化：存入存档，刷新后保底进度不丢 */
  serializeCounters(): Record<string, Partial<Record<Rarity, number>>> {
    const out: Record<string, Partial<Record<Rarity, number>>> = {};
    for (const [bid, m] of this.counters) out[bid] = Object.fromEntries(m);
    return out;
  }

  restoreCounters(data: Record<string, Partial<Record<Rarity, number>>> | undefined): void {
    if (!data) return;
    for (const [bid, m] of Object.entries(data)) {
      this.counters.set(bid, new Map(Object.entries(m) as [Rarity, number][]));
    }
  }

  pullOne(banner: Banner): Pull {
    const tiers = banner.hardPities || [];
    const cnt = this.counters.get(banner.id) || new Map<Rarity, number>();
    this.counters.set(banner.id, cnt);

    // 到阈值的最高档触发硬保底
    let forced: Rarity | null = null;
    for (const t of tiers) {
      const n = (cnt.get(t.rarity) || 0) + 1;
      if (n >= t.threshold && (!forced || RARITY_RANK[t.rarity] > RARITY_RANK[forced])) {
        forced = t.rarity;
      }
    }
    const isPity = forced !== null;
    const rarity = forced ? this.rollFrom(banner, forced) : this.rollWeighted(banner.pool);
    const card = this.pickCard(rarity, banner);

    // 结算各档计数：命中 ≥ 档位稀有度则清零，否则 +1
    for (const t of tiers) {
      cnt.set(t.rarity, atLeast(card.rarity, t.rarity) ? 0 : (cnt.get(t.rarity) || 0) + 1);
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
      // 软保底补的那张也要参与硬保底计数结算
      for (const t of banner.hardPities || []) {
        const cnt = this.counters.get(banner.id)!;
        if (atLeast(card.rarity, t.rarity)) cnt.set(t.rarity, 0);
      }
    }
    return out;
  }

  /** 全部保底档位进度（UI 逐档展示） */
  pityProgressAll(banner: Banner): PityProgress[] {
    const cnt = this.counters.get(banner.id);
    return (banner.hardPities || []).map(t => ({
      rarity: t.rarity, current: cnt?.get(t.rarity) || 0, threshold: t.threshold,
    }));
  }

  /** 兼容旧接口：返回最高档位进度 */
  pityProgress(banner: Banner): { current: number; threshold: number } | null {
    const all = this.pityProgressAll(banner);
    if (!all.length) return null;
    const top = all[all.length - 1];
    return { current: top.current, threshold: top.threshold };
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
    const pool = (banner ? bannerCards(banner) : SUMMON_CARDS).filter(c => c.rarity === rarity);
    if (pool.length) {
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
    for (let rank = RARITY_RANK[rarity] - 1; rank >= 1; rank--) {
      const r = (Object.keys(RARITY_RANK) as Rarity[]).find(k => RARITY_RANK[k] === rank)!;
      const p = (banner ? bannerCards(banner) : SUMMON_CARDS).filter(c => c.rarity === r);
      if (p?.length) return p[Math.floor(this.rand() * p.length)];
    }
    const all = banner ? bannerCards(banner) : SUMMON_CARDS;
    return all[Math.floor(this.rand() * all.length)];
  }
}
