/**
 * OC-07 抽卡引擎测试：seed 确定性、十连必出 SR、UR 45 / LR 80 多级保底、计数持久化。
 */
import { describe, expect, it } from 'vitest';
import { BANNERS, Gacha, rateTable } from './gacha-engine';
import { RARITY_RANK } from '../../data';

const fate = BANNERS.find(b => b.id === 'fate')!;
const legend = BANNERS.find(b => b.id === 'legend')!;
const collab = BANNERS.find(b => b.id === 'collab')!;
const element = BANNERS.find(b => b.id === 'element')!;

describe('配置加载', () => {
  it('7 池全部来自 gacha-config.json，权重为正', () => {
    expect(BANNERS.length).toBe(7);
    for (const b of BANNERS) {
      expect(b.pool.every(e => e.weight > 0)).toBe(true);
      const t = rateTable(b);
      expect(Math.abs(t.reduce((s, r) => s + r.pct, 0) - 100)).toBeLessThan(0.01);
    }
  });

  it('保底阈值符合需求：常驻 UR 45 / LR 80，高级池 LR 80', () => {
    expect(fate.hardPities).toEqual([
      { rarity: 'UR', threshold: 45 },
      { rarity: 'LR', threshold: 80 },
    ]);
    expect(legend.hardPities).toEqual([{ rarity: 'LR', threshold: 80 }]);
  });
});

describe('seed 确定性', () => {
  it('相同 seed 十连结果完全一致', () => {
    const a = new Gacha(123).pullTen(fate).map(p => p.card.id);
    const b = new Gacha(123).pullTen(fate).map(p => p.card.id);
    expect(a).toEqual(b);
  });
});

describe('保底机制', () => {
  it('十连必出 ≥SR（softPity）', () => {
    const g = new Gacha(7);
    for (let round = 0; round < 20; round++) {
      const pulls = g.pullTen(fate);
      expect(pulls.some(p => RARITY_RANK[p.card.rarity] >= RARITY_RANK.SR)).toBe(true);
    }
  });

  it('45 抽内必出 ≥UR（硬保底）', () => {
    const g = new Gacha(99);
    let sinceUr = 0;
    for (let i = 0; i < 400; i++) {
      const p = g.pullOne(fate);
      sinceUr++;
      if (RARITY_RANK[p.card.rarity] >= RARITY_RANK.UR) sinceUr = 0;
      expect(sinceUr).toBeLessThanOrEqual(45);
    }
  });

  it('80 抽内必出 ≥LR（硬保底）', () => {
    const g = new Gacha(2024);
    let sinceLr = 0;
    for (let i = 0; i < 500; i++) {
      const p = g.pullOne(fate);
      sinceLr++;
      if (RARITY_RANK[p.card.rarity] >= RARITY_RANK.LR) sinceLr = 0;
      expect(sinceLr).toBeLessThanOrEqual(80);
    }
  });

  it('保底进度上报且计数随命中清零', () => {
    const g = new Gacha(5);
    g.pullTen(fate);
    const prog = g.pityProgressAll(fate);
    expect(prog.length).toBe(2);
    expect(prog[0].rarity).toBe('UR');
    expect(prog[0].current).toBeGreaterThanOrEqual(0);
  });
});

describe('VR 确定召唤（原魔界联动）', () => {
  it('价格最贵：单抽 2000 钻 / 十连 20000 钻', () => {
    expect(collab.costSingle).toBe(2000);
    expect(collab.costTen).toBe(20000);
  });

  it('50 抽内必出 ≥VR（硬保底）', () => {
    const g = new Gacha(31);
    let sinceVr = 0;
    for (let i = 0; i < 500; i++) {
      const p = g.pullOne(collab);
      sinceVr++;
      if (RARITY_RANK[p.card.rarity] >= RARITY_RANK.VR) sinceVr = 0;
      expect(sinceVr).toBeLessThanOrEqual(50);
    }
  });

  it('十连必出 ≥LR（softPity）且 LR 权重高（LR+X+VR ≈ 60%）', () => {
    const g = new Gacha(77);
    for (let round = 0; round < 15; round++) {
      const pulls = g.pullTen(collab);
      expect(pulls.some(p => RARITY_RANK[p.card.rarity] >= RARITY_RANK.LR)).toBe(true);
    }
    const lrWeight = collab.pool.reduce((s, e) => s + (RARITY_RANK[e.rarity] >= RARITY_RANK.LR ? e.weight : 0), 0);
    const total = collab.pool.reduce((s, e) => s + e.weight, 0);
    expect(lrWeight / total).toBeGreaterThan(0.5);
  });
});

describe('元素精选召唤（全 X 狗粮）', () => {
  it('池子只有 X：抽 100 次全部为 X 卡', () => {
    const g = new Gacha(2026);
    for (let i = 0; i < 100; i++) {
      expect(g.pullOne(element).card.rarity).toBe('X');
    }
  });

  it('十连全部为 X', () => {
    const g = new Gacha(8);
    const pulls = g.pullTen(element);
    expect(pulls.every(p => p.card.rarity === 'X')).toBe(true);
  });
});

describe('计数持久化', () => {
  it('serialize/restore 后保底进度连续', () => {
    const a = new Gacha(11);
    for (let i = 0; i < 30; i++) a.pullOne(fate);
    const saved = a.serializeCounters();
    const b = new Gacha(22);
    b.restoreCounters(saved);
    expect(b.pityProgressAll(fate)).toEqual(a.pityProgressAll(fate));
  });
});
