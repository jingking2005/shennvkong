/**
 * V2 抽卡系统 — 数据驱动卡池 + 保底机制
 * 参考 spec/v2/economy-and-gacha.md
 */

import type { Rarity } from '../data/types';
import { SeededRNG } from './rng';

// === 卡池定义 ===

export interface GachaBanner {
  id: string;
  name: string;
  type: 'normal' | 'premium' | 'ten_pull' | 'box' | 'select';
  currency: string;
  cost: number;
  pool: GachaPoolEntry[];
  pity: GachaPity[];
  featuredCards?: string[];
}

export interface GachaPoolEntry {
  rarity: Rarity;
  weight: number;
  cardIds?: string[]; // 限定卡池
}

export interface GachaPity {
  rarity: Rarity;
  threshold: number; // N 抽保底
  counter: number;   // 当前计数
}

// === 默认卡池 ===

export const NORMAL_BANNER: GachaBanner = {
  id: 'normal', name: '普通召唤', type: 'normal', currency: 'friendship_points', cost: 100,
  pool: [
    { rarity: 'N', weight: 60 },
    { rarity: 'R', weight: 30 },
    { rarity: 'SR', weight: 9 },
    { rarity: 'UR', weight: 1 },
  ],
  pity: [
    { rarity: 'SR', threshold: 30, counter: 0 },
    { rarity: 'UR', threshold: 100, counter: 0 },
  ],
};

export const PREMIUM_BANNER: GachaBanner = {
  id: 'premium', name: '高级召唤', type: 'premium', currency: 'jewels', cost: 300,
  pool: [
    { rarity: 'R', weight: 50 },
    { rarity: 'SR', weight: 35 },
    { rarity: 'UR', weight: 15 },
  ],
  pity: [
    { rarity: 'SR', threshold: 10, counter: 0 },
    { rarity: 'UR', threshold: 50, counter: 0 },
  ],
};

// === 抽卡引擎 ===

export interface GachaResult {
  rarity: Rarity;
  cardId: string;
  isPity: boolean;
  isNew: boolean;
}

export class GachaEngine {
  private rng: SeededRNG;
  private pityCounters: Map<string, Map<Rarity, number>> = new Map();
  private ownedCards: Set<string>;

  constructor(seed: number = 42, ownedCards: string[] = []) {
    this.rng = new SeededRNG(seed);
    this.ownedCards = new Set(ownedCards);
  }

  /** 单抽 */
  pull(banner: GachaBanner, availableCards: { id: string; rarity: Rarity }[]): GachaResult {
    // 初始化计数器
    if (!this.pityCounters.has(banner.id)) {
      const counters = new Map<Rarity, number>();
      for (const p of banner.pity) counters.set(p.rarity, 0);
      this.pityCounters.set(banner.id, counters);
    }
    const counters = this.pityCounters.get(banner.id)!;

    // 检查保底
    let pityRarity: Rarity | null = null;
    for (const p of banner.pity) {
      const count = (counters.get(p.rarity) || 0) + 1;
      if (count >= p.threshold) {
        pityRarity = p.rarity;
        counters.set(p.rarity, 0);
        break;
      }
      counters.set(p.rarity, count);
    }

    // 确定稀有度
    let rarity: Rarity;
    let isPity = false;

    if (pityRarity) {
      rarity = pityRarity;
      isPity = true;
    } else {
      rarity = this.rollRarity(banner.pool);
    }

    // 从该稀有度中选卡
    const poolCards = availableCards.filter(c => c.rarity === rarity);
    const cardId = poolCards.length > 0
      ? this.rng.pick(poolCards).id
      : `random_${rarity}_${this.rng.nextInt(1, 999)}`;

    const isNew = !this.ownedCards.has(cardId);
    this.ownedCards.add(cardId);

    // 抽到高稀有度重置低稀有度计数
    if (rarity === 'UR') {
      counters.set('SR', 0);
    }

    return { rarity, cardId, isPity, isNew };
  }

  /** 十连 */
  tenPull(banner: GachaBanner, availableCards: { id: string; rarity: Rarity }[]): GachaResult[] {
    const results: GachaResult[] = [];
    for (let i = 0; i < 10; i++) {
      results.push(this.pull(banner, availableCards));
    }
    // 十连保底：至少一张 SR+
    if (!results.some(r => r.rarity === 'SR' || r.rarity === 'UR' || r.rarity === 'LR')) {
      // 替换最后一张为 SR
      const srCards = availableCards.filter(c => c.rarity === 'SR');
      if (srCards.length > 0) {
        const card = this.rng.pick(srCards);
        results[9] = { rarity: 'SR', cardId: card.id, isPity: true, isNew: !this.ownedCards.has(card.id) };
        this.ownedCards.add(card.id);
      }
    }
    return results;
  }

  /** 获取当前保底进度 */
  getPityProgress(bannerId: string): Record<string, number> {
    const counters = this.pityCounters.get(bannerId);
    if (!counters) return {};
    const result: Record<string, number> = {};
    counters.forEach((v, k) => { result[k] = v; });
    return result;
  }

  private rollRarity(pool: GachaPoolEntry[]): Rarity {
    const totalWeight = pool.reduce((s, e) => s + e.weight, 0);
    let roll = this.rng.next() * totalWeight;
    for (const entry of pool) {
      roll -= entry.weight;
      if (roll <= 0) return entry.rarity;
    }
    return pool[pool.length - 1].rarity;
  }
}
