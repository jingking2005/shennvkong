import { describe, it, expect } from 'vitest';
import {
  getExpForLevel,
  getMaxLevel,
  calculateStatGrowth,
  enhanceCard,
  canEvolve,
  evolveCard,
  fuseCards,
} from '../src/systems/CardGrowth';
import type { CardInstance, Rarity, Stats } from '../src/data/schema/types';

// === 辅助 ===

function makeInstance(overrides: Partial<CardInstance> = {}): CardInstance {
  return {
    instanceId: 'inst_1',
    cardId: 'goddess-athena',
    level: 1,
    exp: 0,
    rarity: 'R',
    stats: { atk: 1000, def: 800, hp: 5000, speed: 60 },
    skillLevel: 1,
    affection: 0,
    ...overrides,
  };
}

function makeMaterial(id: string, rarity: Rarity = 'N', level = 1): CardInstance {
  return makeInstance({
    instanceId: id,
    cardId: 'slime',
    rarity,
    level,
    stats: { atk: 100, def: 100, hp: 500, speed: 20 },
  });
}

// === 经验曲线 ===

describe('getExpForLevel', () => {
  it('等级 1 升级需要 100 经验', () => {
    expect(getExpForLevel(1)).toBe(100);
  });

  it('经验需求随等级递增', () => {
    expect(getExpForLevel(10)).toBeGreaterThan(getExpForLevel(5));
    expect(getExpForLevel(20)).toBeGreaterThan(getExpForLevel(10));
  });

  it('等级 0 或负数返回 0', () => {
    expect(getExpForLevel(0)).toBe(0);
    expect(getExpForLevel(-1)).toBe(0);
  });
});

// === 满级上限 ===

describe('getMaxLevel', () => {
  it('N 卡满级 20', () => {
    expect(getMaxLevel('N')).toBe(20);
  });

  it('R 卡满级 30', () => {
    expect(getMaxLevel('R')).toBe(30);
  });

  it('SR 卡满级 40', () => {
    expect(getMaxLevel('SR')).toBe(40);
  });

  it('UR 卡满级 50', () => {
    expect(getMaxLevel('UR')).toBe(50);
  });

  it('LR 卡满级 60', () => {
    expect(getMaxLevel('LR')).toBe(60);
  });

  it('H 前缀变体与基础相同', () => {
    expect(getMaxLevel('HN')).toBe(20);
    expect(getMaxLevel('HR')).toBe(30);
    expect(getMaxLevel('HSR')).toBe(40);
  });
});

// === 属性成长 ===

describe('calculateStatGrowth', () => {
  const base: Stats = { atk: 1000, def: 800, hp: 5000, speed: 60 };

  it('等级 1 时属性等于基础值', () => {
    const stats = calculateStatGrowth(base, 1, 30);
    expect(stats.atk).toBe(1000);
    expect(stats.def).toBe(800);
  });

  it('满级时属性约为基碀值的 2 倍', () => {
    const stats = calculateStatGrowth(base, 30, 30);
    expect(stats.atk).toBeCloseTo(2000, -1);
    expect(stats.hp).toBeCloseTo(10000, -1);
  });

  it('成长是线性的', () => {
    const mid = calculateStatGrowth(base, 15, 30);
    // 中间等级应该是基础 + 50% 成长
    expect(mid.atk).toBeCloseTo(1483, -1);
  });

  it('速度不成长（固定值）', () => {
    const stats = calculateStatGrowth(base, 30, 30);
    expect(stats.speed).toBe(60);
  });
});

// === 强化（吞噬素材卡获得经验） ===

describe('enhanceCard', () => {
  it('吞噬素材卡获得经验', () => {
    const target = makeInstance({ level: 1, exp: 0 });
    const materials = [makeMaterial('m1'), makeMaterial('m2')];
    const result = enhanceCard(target, materials);
    expect(result.exp).toBeGreaterThan(0);
  });

  it('经验足够时升级', () => {
    const target = makeInstance({ level: 1, exp: 90 }); // 还差 10 升级
    const materials = [makeMaterial('m1')]; // N卡提供 ~50 exp
    const result = enhanceCard(target, materials);
    expect(result.level).toBeGreaterThan(1);
  });

  it('可以连升多级', () => {
    const target = makeInstance({ level: 1, exp: 0 });
    const materials = [makeMaterial('m1', 'SR', 30)]; // 高级素材提供大量经验
    const result = enhanceCard(target, materials);
    expect(result.level).toBeGreaterThan(2);
  });

  it('不超过满级', () => {
    const target = makeInstance({ level: 29, exp: 0, rarity: 'R' }); // R卡满级 30
    const materials = [makeMaterial('m1', 'UR', 50), makeMaterial('m2', 'UR', 50)];
    const result = enhanceCard(target, materials);
    expect(result.level).toBe(30);
  });

  it('升级后属性成长', () => {
    const target = makeInstance({ level: 1, exp: 0 });
    const materials = [makeMaterial('m1', 'SR', 20)];
    const result = enhanceCard(target, materials);
    expect(result.stats.atk).toBeGreaterThan(target.stats.atk);
  });

  it('无素材时返回原状态', () => {
    const target = makeInstance({ level: 5, exp: 50 });
    const result = enhanceCard(target, []);
    expect(result.level).toBe(5);
    expect(result.exp).toBe(50);
  });
});

// === 进化判定 ===

describe('canEvolve', () => {
  it('未满级不能进化', () => {
    const card = makeInstance({ level: 10, rarity: 'R' }); // R满级30
    const inventory = [makeInstance({ instanceId: 'i2', cardId: 'goddess-athena', level: 30, rarity: 'R' })];
    expect(canEvolve(card, inventory)).toBe(false);
  });

  it('满级但没有同名卡不能进化', () => {
    const card = makeInstance({ level: 30, rarity: 'R' });
    const inventory = [makeInstance({ instanceId: 'i2', cardId: 'other-card', level: 30, rarity: 'R' })];
    expect(canEvolve(card, inventory)).toBe(false);
  });

  it('满级 + 同名卡可以进化', () => {
    const card = makeInstance({ instanceId: 'i1', level: 30, rarity: 'R' });
    const inventory = [makeInstance({ instanceId: 'i2', cardId: 'goddess-athena', level: 30, rarity: 'R' })];
    expect(canEvolve(card, inventory)).toBe(true);
  });

  it('LR 卡不能进化（已是最高）', () => {
    const card = makeInstance({ level: 60, rarity: 'LR' });
    const inventory = [makeInstance({ instanceId: 'i2', cardId: 'goddess-athena', level: 60, rarity: 'LR' })];
    expect(canEvolve(card, inventory)).toBe(false);
  });
});

// === 进化执行 ===

describe('evolveCard', () => {
  it('R 进化为 HR', () => {
    const card1 = makeInstance({ instanceId: 'i1', level: 30, rarity: 'R' });
    const card2 = makeInstance({ instanceId: 'i2', cardId: 'goddess-athena', level: 30, rarity: 'R' });
    const result = evolveCard(card1, card2);
    expect(result.rarity).toBe('HR');
  });

  it('进化后等级重置为 1', () => {
    const card1 = makeInstance({ instanceId: 'i1', level: 30, rarity: 'R' });
    const card2 = makeInstance({ instanceId: 'i2', cardId: 'goddess-athena', level: 30, rarity: 'R' });
    const result = evolveCard(card1, card2);
    expect(result.level).toBe(1);
    expect(result.exp).toBe(0);
  });

  it('进化后基础属性提升 30%', () => {
    const card1 = makeInstance({ instanceId: 'i1', level: 30, rarity: 'R', stats: { atk: 1000, def: 800, hp: 5000, speed: 60 } });
    const card2 = makeInstance({ instanceId: 'i2', cardId: 'goddess-athena', level: 30, rarity: 'R', stats: { atk: 1000, def: 800, hp: 5000, speed: 60 } });
    const result = evolveCard(card1, card2);
    // 新基础属性 = 原始 * 1.3
    expect(result.stats.atk).toBe(1300);
    expect(result.stats.hp).toBe(6500);
  });

  it('N 进化为 HN', () => {
    const card1 = makeInstance({ instanceId: 'i1', level: 20, rarity: 'N' });
    const card2 = makeInstance({ instanceId: 'i2', cardId: 'goddess-athena', level: 20, rarity: 'N' });
    const result = evolveCard(card1, card2);
    expect(result.rarity).toBe('HN');
  });

  it('SR 进化为 HSR', () => {
    const card1 = makeInstance({ instanceId: 'i1', level: 40, rarity: 'SR' });
    const card2 = makeInstance({ instanceId: 'i2', cardId: 'goddess-athena', level: 40, rarity: 'SR' });
    const result = evolveCard(card1, card2);
    expect(result.rarity).toBe('HSR');
  });
});

// === 合体（多卡融合，继承属性） ===

describe('fuseCards', () => {
  it('合体继承素材 10% 属性', () => {
    const target = makeInstance({ stats: { atk: 1000, def: 800, hp: 5000, speed: 60 } });
    const material = makeInstance({ stats: { atk: 2000, def: 1000, hp: 8000, speed: 80 } });
    const result = fuseCards(target, [material]);
    // 1000 + 2000*0.1 = 1200
    expect(result.stats.atk).toBe(1200);
    expect(result.stats.def).toBe(900);
    expect(result.stats.hp).toBe(5800);
  });

  it('多张素材累加', () => {
    const target = makeInstance({ stats: { atk: 1000, def: 800, hp: 5000, speed: 60 } });
    const m1 = makeInstance({ stats: { atk: 1000, def: 500, hp: 3000, speed: 50 } });
    const m2 = makeInstance({ stats: { atk: 1000, def: 500, hp: 3000, speed: 50 } });
    const result = fuseCards(target, [m1, m2]);
    // 1000 + (1000+1000)*0.1 = 1200
    expect(result.stats.atk).toBe(1200);
  });

  it('速度不继承', () => {
    const target = makeInstance({ stats: { atk: 1000, def: 800, hp: 5000, speed: 60 } });
    const material = makeInstance({ stats: { atk: 1000, def: 1000, hp: 5000, speed: 200 } });
    const result = fuseCards(target, [material]);
    expect(result.stats.speed).toBe(60);
  });

  it('无素材时返回原状态', () => {
    const target = makeInstance({ stats: { atk: 1000, def: 800, hp: 5000, speed: 60 } });
    const result = fuseCards(target, []);
    expect(result.stats.atk).toBe(1000);
  });
});
