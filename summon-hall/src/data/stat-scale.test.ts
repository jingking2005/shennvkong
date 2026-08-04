/**
 * 数值梯度测试：scaledStats 基准函数本身仍保证稀有度递增。
 * （全卡池实卡已改为官方数值体系，不再适用梯度断言）
 */
import { describe, expect, it } from 'vitest';
import { scaledStats } from './stat-scale';

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
});
