/**
 * 数值梯度测试：任意高稀有度卡严格强于任意低稀有度卡。
 */
import { describe, expect, it } from 'vitest';
import { scaledStats } from './stat-scale';
import { SUMMON_CARDS, WIKI_EXACT_IDS } from '../data';

describe('数值梯度（original-fill）', () => {
  const ORDER = ['N', 'R', 'SR', 'UR', 'LR', 'X', 'VR'] as const;

  it('稀有度基准严格递增，且档距不被 wiki 原值跨越', () => {
    const maxBase = { attack: 5000, defense: 5000, soldiers: 0, speed: 100, critRate: 20, critDamage: 150 };
    for (let i = 1; i < ORDER.length; i++) {
      const lo = scaledStats(ORDER[i - 1], maxBase);
      const hi = scaledStats(ORDER[i], { attack: 0, defense: 0 });
      expect(hi.attack).toBeGreaterThan(lo.attack);
      expect(hi.defense).toBeGreaterThan(lo.defense);
    }
  });

  it('全卡池实卡：高稀有度最低攻 > 低稀有度最高攻（官方复刻卡除外）', () => {
    const byR = new Map<string, number[]>();
    for (const c of SUMMON_CARDS) {
      if (WIKI_EXACT_IDS.has(c.id)) continue;
      byR.set(c.rarity, [...(byR.get(c.rarity) || []), c.stats.attack]);
    }
    const present = ORDER.filter(r => byR.has(r));
    for (let i = 1; i < present.length; i++) {
      const loMax = Math.max(...byR.get(present[i - 1])!);
      const hiMin = Math.min(...byR.get(present[i])!);
      expect(hiMin).toBeGreaterThan(loMax);
    }
  });
});
