/**
 * 活动召唤（定点召唤）测试：
 * - 池 = 2 张定点 UR（各 1%）+ 全 SR / R / N
 * - 50 抽保底至少 1 张定点
 * - 普通抽不会出定点卡以外的 UR/LR/VR
 */
import { describe, expect, it } from 'vitest';
import { BANNERS, Gacha } from './systems/gacha/gacha-engine';

const FEATURED_IDS = ['wiki-calamity', 'wiki-miss-lunar-new-year'];

function eventBanner() {
  const b = BANNERS.find(x => x.id === 'legend');
  expect(b).toBeTruthy();
  return b!;
}

describe('活动召唤配置', () => {
  it('banner 名为活动召唤，定点 2 张各 1%，50 抽保底', () => {
    const b = eventBanner();
    expect(b.name).toBe('活动召唤');
    expect(b.featured?.map(f => f.cardId).sort()).toEqual([...FEATURED_IDS].sort());
    for (const f of b.featured!) expect(f.rate).toBeCloseTo(0.01, 10);
    expect(b.featuredPity).toBe(50);
  });

  it('普通池只含 SR / R / N', () => {
    const b = eventBanner();
    const rs = b.pool.map(e => e.rarity).sort();
    expect(rs).toEqual(['N', 'R', 'SR']);
  });
});

describe('活动召唤抽取', () => {
  it('普通抽不出非定点 UR/LR/VR（200 抽样本）', () => {
    const b = eventBanner();
    const g = new Gacha(20260805);
    for (let i = 0; i < 200; i++) {
      const p = g.pullOne(b);
      const isFeatured = FEATURED_IDS.includes(p.card.id);
      if (!isFeatured) expect(['N', 'R', 'SR']).toContain(p.card.rarity);
      else expect(p.card.rarity).toBe('UR');
    }
  });

  it('定点自然命中率约 2%（各 1%；单抽独立样本，保底不干扰）', () => {
    const b = eventBanner();
    let n = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) {
      const g = new Gacha(100000 + i);
      if (FEATURED_IDS.includes(g.pullOne(b).card.id)) n++;
    }
    const rate = n / N;
    expect(rate).toBeGreaterThan(0.012);
    expect(rate).toBeLessThan(0.028);
  });

  it('含 50 抽保底的有效概率约 3.3%（自然 2% + 保底抬升）', () => {
    const b = eventBanner();
    const g = new Gacha(7);
    let n = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) if (FEATURED_IDS.includes(g.pullOne(b).card.id)) n++;
    const rate = n / N;
    expect(rate).toBeGreaterThan(0.025);
    expect(rate).toBeLessThan(0.042);
  });

  it('50 抽保底：任意连续 50 抽必出定点', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const b = eventBanner();
      const g = new Gacha(seed);
      let got = false;
      for (let i = 0; i < 50; i++) {
        if (FEATURED_IDS.includes(g.pullOne(b).card.id)) { got = true; break; }
      }
      expect(got).toBe(true);
    }
  });

  it('保底计数持久化：serialize/restore 后继续累计', () => {
    const b = eventBanner();
    const g = new Gacha(99);
    for (let i = 0; i < 10; i++) g.pullOne(b);
    const saved = g.serializeCounters();
    const g2 = new Gacha(100);
    g2.restoreCounters(saved);
    const prog = g2.featuredPityProgress(b);
    expect(prog).toBeTruthy();
    expect(prog!.current).toBeGreaterThan(0);
    expect(prog!.threshold).toBe(50);
  });
});
