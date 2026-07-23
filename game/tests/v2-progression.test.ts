import { describe, it, expect } from 'vitest';
import { getExpForLevel, getMaxLevel, levelUp, canEvolve, evolve, enhance, applyEnhance, calculateDerivedStats, getMaterialExp } from '../src/v2/systems/progression';
import { GachaEngine, NORMAL_BANNER, PREMIUM_BANNER } from '../src/v2/systems/gacha';
import type { CardInstance, CardDefinition, Stats } from '../src/v2/data/types';

function makeStats(): Stats {
  return { attack: 1000, defense: 500, soldiers: 5000, speed: 60, critRate: 0.1, critDamage: 0.5, healingPower: 800, damageReduction: 0, statusAccuracy: 50, statusResistance: 30 };
}

function makeInstance(overrides: Partial<CardInstance> = {}): CardInstance {
  return { instanceId: 'i1', cardId: 'c1', level: 1, exp: 0, enhancement: 0, evolutionStage: 0, skillLevels: [1], friendship: 0, locked: false, derivedStats: makeStats(), ...overrides };
}

function makeDef(overrides: Partial<CardDefinition> = {}): CardDefinition {
  return { id: 'c1', name: { en: 'Test' }, rarity: 'R', element: 'PASSION', symbol: null, cardCost: 10, primaryRole: 'MAIN_DPS', secondaryRole: null, combatTags: [], baseStats: makeStats(), skillIds: ['s1'], familyId: 'f1', forms: [], ...overrides };
}

describe('Progression - 经验曲线', () => {
  it('等级1需要100经验', () => { expect(getExpForLevel(1)).toBe(100); });
  it('递增', () => { expect(getExpForLevel(10)).toBeGreaterThan(getExpForLevel(5)); });
  it('R卡满级30', () => { expect(getMaxLevel('R')).toBe(30); });
  it('UR卡满级50', () => { expect(getMaxLevel('UR')).toBe(50); });
});

describe('Progression - 升级', () => {
  it('获得经验后升级', () => {
    const inst = makeInstance({ level: 1, exp: 0 });
    const def = makeDef();
    const result = levelUp(inst, def, 200);
    expect(result.levelsGained).toBeGreaterThanOrEqual(1);
    expect(result.instance.level).toBeGreaterThan(1);
  });

  it('不超过满级', () => {
    const inst = makeInstance({ level: 29, exp: 0 });
    const def = makeDef({ rarity: 'R' }); // 满级30
    const result = levelUp(inst, def, 999999);
    expect(result.instance.level).toBe(30);
  });

  it('升级后属性增长', () => {
    const inst = makeInstance({ level: 1 });
    const def = makeDef();
    const result = levelUp(inst, def, 5000);
    expect(result.instance.derivedStats.attack).toBeGreaterThan(inst.derivedStats.attack);
  });
});

describe('Progression - 进化', () => {
  it('未满级不能进化', () => {
    const inst = makeInstance({ level: 10 });
    const def = makeDef();
    expect(canEvolve(inst, def, [makeInstance({ instanceId: 'i2' })])).toBe(false);
  });

  it('满级+同名卡可以进化', () => {
    const inst = makeInstance({ instanceId: 'i1', level: 30 });
    const def = makeDef();
    const mat = makeInstance({ instanceId: 'i2', cardId: 'c1', level: 30 });
    expect(canEvolve(inst, def, [mat])).toBe(true);
  });

  it('进化后阶段+1，等级重置', () => {
    const inst = makeInstance({ instanceId: 'i1', level: 30, evolutionStage: 0 });
    const def = makeDef();
    const mat = makeInstance({ instanceId: 'i2' });
    const result = evolve(inst, def, mat);
    expect(result.evolutionStage).toBe(1);
    expect(result.level).toBe(1);
  });

  it('进化后属性提升', () => {
    const inst = makeInstance({ instanceId: 'i1', level: 30 });
    const def = makeDef();
    const mat = makeInstance({ instanceId: 'i2' });
    const result = evolve(inst, def, mat);
    expect(result.derivedStats.attack).toBeGreaterThan(inst.derivedStats.attack);
  });
});

describe('Progression - FIFA式强化', () => {
  it('+0→+1 必定成功', () => {
    const inst = makeInstance({ enhancement: 0 });
    const def = makeDef();
    const result = enhance(inst, def, 0, () => 0.99);
    expect(result.success).toBe(true);
    expect(result.newLevel).toBe(1);
  });

  it('+9→+10 低概率', () => {
    const inst = makeInstance({ enhancement: 9 });
    const def = makeDef();
    // rate = 0.03 + 0.03 = 0.06, roll 0.5 > 0.06 → 失败
    const result = enhance(inst, def, 0, () => 0.5);
    expect(result.success).toBe(false);
  });

  it('+8失败降级', () => {
    const inst = makeInstance({ enhancement: 8 });
    const def = makeDef();
    const result = enhance(inst, def, 0, () => 0.99); // 失败
    expect(result.degraded).toBe(true);
    expect(result.newLevel).toBe(7);
  });

  it('+3失败不降级', () => {
    const inst = makeInstance({ enhancement: 3 });
    const def = makeDef();
    const result = enhance(inst, def, 0, () => 0.99); // 失败
    expect(result.degraded).toBe(false);
    expect(result.newLevel).toBe(3);
  });

  it('applyEnhance 更新属性', () => {
    const inst = makeInstance({ enhancement: 0 });
    const def = makeDef();
    const result = { success: true, newLevel: 3, rate: 0.6, degraded: false };
    const updated = applyEnhance(inst, def, result);
    expect(updated.enhancement).toBe(3);
    expect(updated.derivedStats.attack).toBeGreaterThan(inst.derivedStats.attack);
  });
});

describe('Gacha - 抽卡', () => {
  const cards = [
    { id: 'n1', rarity: 'N' as const }, { id: 'n2', rarity: 'N' as const },
    { id: 'r1', rarity: 'R' as const }, { id: 'r2', rarity: 'R' as const },
    { id: 'sr1', rarity: 'SR' as const }, { id: 'ur1', rarity: 'UR' as const },
  ];

  it('单抽返回结果', () => {
    const engine = new GachaEngine(42);
    const result = engine.pull(NORMAL_BANNER, cards);
    expect(result.rarity).toBeTruthy();
    expect(result.cardId).toBeTruthy();
  });

  it('十连返回10个结果', () => {
    const engine = new GachaEngine(42);
    const results = engine.tenPull(PREMIUM_BANNER, cards);
    expect(results).toHaveLength(10);
  });

  it('十连保底至少一张SR+', () => {
    const engine = new GachaEngine(42);
    const results = engine.tenPull(PREMIUM_BANNER, cards);
    expect(results.some(r => r.rarity === 'SR' || r.rarity === 'UR')).toBe(true);
  });

  it('相同种子相同结果', () => {
    const e1 = new GachaEngine(123);
    const e2 = new GachaEngine(123);
    const r1 = e1.pull(NORMAL_BANNER, cards);
    const r2 = e2.pull(NORMAL_BANNER, cards);
    expect(r1.rarity).toBe(r2.rarity);
    expect(r1.cardId).toBe(r2.cardId);
  });

  it('保底触发', () => {
    const engine = new GachaEngine(42);
    // threshold=2: 第2抽必出SR
    const banner = { id: 'pity_test_2', name: 'test', type: 'normal' as const, currency: 'fp', cost: 100,
      pool: [{ rarity: 'R' as const, weight: 100 }], // pool只有R，正常不会出SR
      pity: [{ rarity: 'SR' as const, threshold: 2, counter: 0 }] };
    const r1 = engine.pull(banner, cards);
    expect(r1.rarity).toBe('R'); // 第1抽正常
    const r2 = engine.pull(banner, cards);
    expect(r2.isPity).toBe(true); // 第2抽保底
    expect(r2.rarity).toBe('SR');
  });

  it('概率分布合理（1000次模拟）', () => {
    const engine = new GachaEngine(42);
    const counts: Record<string, number> = { N: 0, R: 0, SR: 0, UR: 0 };
    for (let i = 0; i < 1000; i++) {
      const r = engine.pull(NORMAL_BANNER, cards);
      counts[r.rarity]++;
    }
    // N 应该最多
    expect(counts.N).toBeGreaterThan(counts.R);
    expect(counts.R).toBeGreaterThan(counts.SR);
    // 总抽数正确
    expect(counts.N + counts.R + counts.SR + counts.UR).toBe(1000);
  });
});
