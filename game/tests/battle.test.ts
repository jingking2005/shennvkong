import { describe, it, expect } from 'vitest';
import { getElementBonus, calculateDamage } from '../src/systems/DamageCalc';
import { rollSkillTrigger } from '../src/systems/SkillSystem';
import { runBattle, initBattle, executeTurn, resetUidCounter } from '../src/systems/BattleEngine';
import type { Card, Skill } from '../src/data/schema/types';
import mockCards from '../src/data/fixtures/mock-cards.json';

// === 属性克制测试 ===
describe('DamageCalc - 属性克制', () => {
  it('Passion 克制 Cool (1.3x)', () => {
    expect(getElementBonus('Passion', 'Cool')).toBe(1.3);
  });
  it('Cool 克制 Light (1.3x)', () => {
    expect(getElementBonus('Cool', 'Light')).toBe(1.3);
  });
  it('Light 克制 Dark (1.3x)', () => {
    expect(getElementBonus('Light', 'Dark')).toBe(1.3);
  });
  it('Dark 克制 Passion (1.3x)', () => {
    expect(getElementBonus('Dark', 'Passion')).toBe(1.3);
  });
  it('被克制返回 0.7', () => {
    expect(getElementBonus('Cool', 'Passion')).toBe(0.7);
  });
  it('同属性返回 1.0', () => {
    expect(getElementBonus('Passion', 'Passion')).toBe(1.0);
  });
  it('Special 对任何属性返回 1.0', () => {
    expect(getElementBonus('Special', 'Passion')).toBe(1.0);
    expect(getElementBonus('Dark', 'Special')).toBe(1.0);
  });
});

// === 伤害公式测试 ===
describe('DamageCalc - 伤害公式', () => {
  it('基础伤害 = ATK * multiplier - DEF * 0.5', () => {
    const dmg = calculateDamage({ atk: 1000, def: 400, multiplier: 1.0, attackerElement: 'Passion', defenderElement: 'Passion' });
    expect(dmg).toBe(800); // 1000 - 200
  });
  it('克制加成正确', () => {
    const dmg = calculateDamage({ atk: 1000, def: 0, multiplier: 1.0, attackerElement: 'Passion', defenderElement: 'Cool' });
    expect(dmg).toBe(1300); // 1000 * 1.3
  });
  it('最小伤害为 1', () => {
    const dmg = calculateDamage({ atk: 1, def: 9999, multiplier: 1.0, attackerElement: 'Passion', defenderElement: 'Passion' });
    expect(dmg).toBe(1);
  });
  it('技能倍率生效', () => {
    const dmg = calculateDamage({ atk: 1000, def: 0, multiplier: 2.5, attackerElement: 'Light', defenderElement: 'Light' });
    expect(dmg).toBe(2500);
  });
});

// === 技能触发测试 ===
describe('SkillSystem - 技能触发', () => {
  const skill: Skill = { id: 'test', name: 'Test', desc: '', rate: 0.5, multiplier: 2.0, target: 'single', effects: [] };

  it('rng < rate 时触发', () => {
    expect(rollSkillTrigger(skill, () => 0.3)).toBe(true);
  });
  it('rng >= rate 时不触发', () => {
    expect(rollSkillTrigger(skill, () => 0.7)).toBe(false);
  });
  it('rate=1 必定触发', () => {
    const alwaysSkill = { ...skill, rate: 1.0 };
    expect(rollSkillTrigger(alwaysSkill, () => 0.99)).toBe(true);
  });
  it('rate=0 必定不触发', () => {
    const neverSkill = { ...skill, rate: 0 };
    expect(rollSkillTrigger(neverSkill, () => 0.01)).toBe(false);
  });
});

// === 战斗引擎测试 ===
describe('BattleEngine', () => {
  const cards = mockCards as Card[];
  const getCard = (id: string) => cards.find(c => c.id === id)!;

  it('initBattle 创建正确数量的单位', () => {
    resetUidCounter();
    const state = initBattle(
      [{ card: getCard('goddess-athena'), skill: null }],
      [{ card: getCard('slime'), skill: null }],
    );
    expect(state.units).toHaveLength(2);
    expect(state.phase).toBe('ongoing');
    expect(state.turn).toBe(0);
  });

  it('runBattle 产生胜者', () => {
    const result = runBattle(
      [{ card: getCard('goddess-athena'), skill: null }, { card: getCard('demon-lucifer'), skill: null }],
      [{ card: getCard('slime'), skill: null }],
      () => 0.99, // 不触发技能
    );
    expect(result.winner).toBe('player');
    expect(result.turns).toBeGreaterThan(0);
    expect(result.log.length).toBeGreaterThan(0);
  });

  it('弱队会输', () => {
    const result = runBattle(
      [{ card: getCard('slime'), skill: null }],
      [{ card: getCard('goddess-athena'), skill: null }, { card: getCard('demon-lucifer'), skill: null }],
      () => 0.99,
    );
    expect(result.winner).toBe('enemy');
  });

  it('战斗不超过 100 回合', () => {
    const result = runBattle(
      [{ card: getCard('slime'), skill: null }],
      [{ card: getCard('goblin'), skill: null }],
      () => 0.99,
    );
    expect(result.turns).toBeLessThanOrEqual(100);
  });
});

// === Mock 数据完整性 ===
describe('Mock Data', () => {
  const cards = mockCards as Card[];

  it('包含 12 张卡', () => {
    expect(cards).toHaveLength(12);
  });
  it('覆盖 4 种属性', () => {
    const elements = new Set(cards.map(c => c.element));
    expect(elements.size).toBeGreaterThanOrEqual(4);
  });
  it('覆盖 3 种稀有度', () => {
    const rarities = new Set(cards.map(c => c.rarity));
    expect(rarities.size).toBeGreaterThanOrEqual(3);
  });
  it('每张卡有有效 stats', () => {
    for (const card of cards) {
      expect(card.baseStats.atk).toBeGreaterThan(0);
      expect(card.baseStats.def).toBeGreaterThan(0);
      expect(card.baseStats.hp).toBeGreaterThan(0);
      expect(card.baseStats.speed).toBeGreaterThan(0);
    }
  });
  it('每张卡有唯一 id', () => {
    const ids = cards.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
