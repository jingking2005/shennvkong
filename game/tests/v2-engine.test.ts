import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../src/v2/systems/rng';
import { EventBus, BattleEvents } from '../src/v2/systems/event-bus';
import { StatusEngine } from '../src/v2/systems/status-engine';
import { calculateDamage, calculateHeal, getElementMultiplier, DEFAULT_DAMAGE_CONFIG } from '../src/v2/systems/damage-calc';
import { TargetSelector } from '../src/v2/systems/target-selector';
import { BattleEngine } from '../src/v2/systems/battle-engine';
import type { BattleUnit, CardDefinition, CardInstance, SkillDefinition, Stats, StatusEffect } from '../src/v2/data/types';

// === 辅助函数 ===

function makeStats(overrides: Partial<Stats> = {}): Stats {
  return {
    attack: 1000, defense: 500, soldiers: 5000, speed: 60,
    critRate: 0.1, critDamage: 0.5, healingPower: 800,
    damageReduction: 0, statusAccuracy: 50, statusResistance: 30,
    ...overrides,
  };
}

function makeCardDef(overrides: Partial<CardDefinition> = {}): CardDefinition {
  return {
    id: 'test-card', name: { en: 'Test' }, rarity: 'R', element: 'PASSION',
    symbol: null, cardCost: 10, primaryRole: 'MAIN_DPS', secondaryRole: null,
    combatTags: [], baseStats: makeStats(), skillIds: [], familyId: 'test',
    forms: [], ...overrides,
  };
}

function makeCardInstance(overrides: Partial<CardInstance> = {}): CardInstance {
  return {
    instanceId: 'inst_1', cardId: 'test-card', level: 1, exp: 0,
    enhancement: 0, evolutionStage: 0, skillLevels: [1], friendship: 0,
    locked: false, derivedStats: makeStats(), ...overrides,
  };
}

function makeUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  const cardDef = makeCardDef();
  const cardInstance = makeCardInstance();
  return {
    uid: 'unit_1', cardInstance, cardDef, side: 'player', position: 'FRONT_LEFT',
    currentSoldiers: 5000, maxSoldiers: 5000, currentStats: makeStats(),
    statusEffects: [], shields: 0, isAlive: true,
    skillCooldowns: new Map(), skillProcCounts: new Map(), countdowns: new Map(),
    hasActed: false, tauntTarget: false, ...overrides,
  };
}

// === SeededRNG 测试 ===

describe('SeededRNG', () => {
  it('相同种子产生相同序列', () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(12345);
    for (let i = 0; i < 100; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it('不同种子产生不同序列', () => {
    const rng1 = new SeededRNG(111);
    const rng2 = new SeededRNG(222);
    const results1 = Array.from({ length: 10 }, () => rng1.next());
    const results2 = Array.from({ length: 10 }, () => rng2.next());
    expect(results1).not.toEqual(results2);
  });

  it('next() 返回 [0, 1)', () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('chance(1.0) 总是 true', () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 100; i++) expect(rng.chance(1.0)).toBe(true);
  });

  it('chance(0.0) 总是 false', () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 100; i++) expect(rng.chance(0.0)).toBe(false);
  });

  it('shuffle 不改变原数组', () => {
    const rng = new SeededRNG(42);
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    rng.shuffle(arr);
    expect(arr).toEqual(original);
  });

  it('clone 产生相同后续序列', () => {
    const rng = new SeededRNG(42);
    rng.next(); rng.next(); // 推进状态
    const clone = rng.clone();
    expect(rng.next()).toBe(clone.next());
    expect(rng.next()).toBe(clone.next());
  });
});

// === EventBus 测试 ===

describe('EventBus', () => {
  it('订阅和发布', () => {
    const bus = new EventBus();
    let received = 0;
    bus.on('test', () => received++);
    bus.emit('test');
    bus.emit('test');
    expect(received).toBe(2);
  });

  it('once 只触发一次', () => {
    const bus = new EventBus();
    let received = 0;
    bus.once('test', () => received++);
    bus.emit('test');
    bus.emit('test');
    expect(received).toBe(1);
  });

  it('优先级排序', () => {
    const bus = new EventBus();
    const order: number[] = [];
    bus.on('test', () => order.push(1), 1);
    bus.on('test', () => order.push(3), 3);
    bus.on('test', () => order.push(2), 2);
    bus.emit('test');
    expect(order).toEqual([3, 2, 1]);
  });

  it('off 取消订阅', () => {
    const bus = new EventBus();
    let count = 0;
    const handler = () => count++;
    bus.on('test', handler);
    bus.emit('test');
    bus.off('test', handler);
    bus.emit('test');
    expect(count).toBe(1);
  });

  it('传递数据', () => {
    const bus = new EventBus();
    let data: any = null;
    bus.on('test', (d) => { data = d; });
    bus.emit('test', { value: 42 });
    expect(data.value).toBe(42);
  });
});

// === StatusEngine 测试 ===

describe('StatusEngine', () => {
  it('应用状态效果', () => {
    const unit = makeUnit();
    const effect: StatusEffect = {
      id: 's1', sourceSkillId: 'sk1', sourceUnitId: 'u2',
      type: 'ATTACK_UP', value: 200, duration: 3, stacks: 1,
      maxStacks: 1, isDebuff: false, dispellable: true,
    };
    expect(StatusEngine.apply(unit, effect)).toBe(true);
    expect(unit.statusEffects).toHaveLength(1);
  });

  it('不可叠加状态刷新持续时间', () => {
    const unit = makeUnit();
    const e1: StatusEffect = {
      id: 's1', sourceSkillId: 'sk1', sourceUnitId: 'u2',
      type: 'ATTACK_UP', value: 200, duration: 2, stacks: 1,
      maxStacks: 0, isDebuff: false, dispellable: true,
    };
    const e2: StatusEffect = { ...e1, duration: 5, value: 300 };
    StatusEngine.apply(unit, e1);
    StatusEngine.apply(unit, e2);
    expect(unit.statusEffects).toHaveLength(1);
    expect(unit.statusEffects[0].duration).toBe(5);
    expect(unit.statusEffects[0].value).toBe(300);
  });

  it('tick 递减持续时间', () => {
    const unit = makeUnit();
    StatusEngine.apply(unit, {
      id: 's1', sourceSkillId: 'sk1', sourceUnitId: 'u2',
      type: 'STUN', value: 0, duration: 2, stacks: 1,
      maxStacks: 1, isDebuff: true, dispellable: true,
    });
    StatusEngine.tick(unit);
    expect(unit.statusEffects).toHaveLength(1);
    const expired = StatusEngine.tick(unit);
    expect(expired).toHaveLength(1);
    expect(unit.statusEffects).toHaveLength(0);
  });

  it('cleanse 移除可驱散 Debuff', () => {
    const unit = makeUnit();
    StatusEngine.apply(unit, {
      id: 's1', sourceSkillId: 'sk1', sourceUnitId: 'u2',
      type: 'ATTACK_DOWN', value: 100, duration: 3, stacks: 1,
      maxStacks: 1, isDebuff: true, dispellable: true,
    });
    StatusEngine.apply(unit, {
      id: 's2', sourceSkillId: 'sk1', sourceUnitId: 'u2',
      type: 'ATTACK_UP', value: 100, duration: 3, stacks: 1,
      maxStacks: 1, isDebuff: false, dispellable: true,
    });
    const removed = StatusEngine.cleanse(unit);
    expect(removed).toHaveLength(1);
    expect(unit.statusEffects).toHaveLength(1); // Buff 保留
  });

  it('PROTECT 免疫 Debuff', () => {
    const unit = makeUnit();
    StatusEngine.apply(unit, {
      id: 's1', sourceSkillId: 'sk1', sourceUnitId: 'u1',
      type: 'PROTECT', value: 0, duration: 3, stacks: 1,
      maxStacks: 1, isDebuff: false, dispellable: false,
    });
    const applied = StatusEngine.apply(unit, {
      id: 's2', sourceSkillId: 'sk2', sourceUnitId: 'u2',
      type: 'STUN', value: 0, duration: 1, stacks: 1,
      maxStacks: 1, isDebuff: true, dispellable: true,
    });
    expect(applied).toBe(false);
  });

  it('isControlled 检测 STUN', () => {
    const unit = makeUnit();
    expect(StatusEngine.isControlled(unit)).toBe(false);
    StatusEngine.apply(unit, {
      id: 's1', sourceSkillId: 'sk1', sourceUnitId: 'u2',
      type: 'STUN', value: 0, duration: 1, stacks: 1,
      maxStacks: 1, isDebuff: true, dispellable: true,
    });
    expect(StatusEngine.isControlled(unit)).toBe(true);
  });
});

// === DamageCalc 测试 ===

describe('DamageCalc V2', () => {
  it('属性克制 PASSION vs COOL = 1.5x', () => {
    expect(getElementMultiplier('PASSION', 'COOL', DEFAULT_DAMAGE_CONFIG)).toBe(1.5);
  });

  it('属性被克 COOL vs PASSION = 1.5x', () => {
    expect(getElementMultiplier('COOL', 'PASSION', DEFAULT_DAMAGE_CONFIG)).toBe(1.5);
  });

  it('LIGHT vs DARK 互克', () => {
    expect(getElementMultiplier('LIGHT', 'DARK', DEFAULT_DAMAGE_CONFIG)).toBe(1.5);
    expect(getElementMultiplier('DARK', 'LIGHT', DEFAULT_DAMAGE_CONFIG)).toBe(1.5);
  });

  it('SPECIAL 不参与克制', () => {
    expect(getElementMultiplier('SPECIAL', 'PASSION', DEFAULT_DAMAGE_CONFIG)).toBe(1.0);
    expect(getElementMultiplier('PASSION', 'SPECIAL', DEFAULT_DAMAGE_CONFIG)).toBe(1.0);
  });

  it('同属性无克制', () => {
    expect(getElementMultiplier('PASSION', 'PASSION', DEFAULT_DAMAGE_CONFIG)).toBe(1.0);
  });

  it('伤害计算最低为 1', () => {
    const attacker = makeUnit({ currentStats: makeStats({ attack: 1 }) });
    const defender = makeUnit({ currentStats: makeStats({ defense: 99999 }) });
    const result = calculateDamage({
      attacker, defender, skillMultiplier: 0.1,
      randomVariance: 0.95, isCrit: false, config: DEFAULT_DAMAGE_CONFIG,
    });
    expect(result.finalDamage).toBeGreaterThanOrEqual(1);
  });

  it('护盾优先吸收', () => {
    const attacker = makeUnit({ currentStats: makeStats({ attack: 1000 }) });
    const defender = makeUnit({ shields: 2000, currentSoldiers: 5000 });
    const result = calculateDamage({
      attacker, defender, skillMultiplier: 1.0,
      randomVariance: 1.0, isCrit: false, config: DEFAULT_DAMAGE_CONFIG,
    });
    expect(result.shieldAbsorbed).toBeGreaterThan(0);
    expect(defender.shields).toBe(2000 - result.shieldAbsorbed);
  });

  it('治疗不超过最大士兵值', () => {
    const caster = makeUnit({ currentStats: makeStats({ healingPower: 10000 }) });
    const target = makeUnit({ currentSoldiers: 4900, maxSoldiers: 5000 });
    const result = calculateHeal({
      caster, target, skillMultiplier: 1.0, healingBuff: 1.0, receivedHealingModifier: 1.0,
    });
    expect(target.currentSoldiers).toBe(5000);
    expect(result.overheal).toBeGreaterThan(0);
  });

  it('禁疗时治疗为 0', () => {
    const caster = makeUnit();
    const target = makeUnit({ currentSoldiers: 3000 });
    const result = calculateHeal({
      caster, target, skillMultiplier: 1.0, healingBuff: 1.0, receivedHealingModifier: 0,
    });
    expect(result.actualHeal).toBe(0);
    expect(target.currentSoldiers).toBe(3000);
  });
});

// === TargetSelector 测试 ===

describe('TargetSelector', () => {
  it('SELF 返回自身', () => {
    const unit = makeUnit();
    const result = TargetSelector.select('SELF', unit, [unit]);
    expect(result).toEqual([unit]);
  });

  it('ALL_ENEMIES 返回所有敌人', () => {
    const player = makeUnit({ uid: 'p1', side: 'player' });
    const e1 = makeUnit({ uid: 'e1', side: 'enemy' });
    const e2 = makeUnit({ uid: 'e2', side: 'enemy' });
    const result = TargetSelector.select('ALL_ENEMIES', player, [player, e1, e2]);
    expect(result).toHaveLength(2);
  });

  it('嘲讽优先', () => {
    const player = makeUnit({ uid: 'p1', side: 'player' });
    const e1 = makeUnit({ uid: 'e1', side: 'enemy', position: 'FRONT_LEFT' });
    const e2 = makeUnit({ uid: 'e2', side: 'enemy', position: 'BACK_CENTER',
      statusEffects: [{ id: 't1', sourceSkillId: 'sk', sourceUnitId: 'e2', type: 'TAUNT', value: 0, duration: 3, stacks: 1, maxStacks: 1, isDebuff: false, dispellable: false }]
    });
    const result = TargetSelector.select('SINGLE_ENEMY', player, [player, e1, e2], () => 0.5);
    expect(result[0].uid).toBe('e2'); // 嘲讽单位优先
  });

  it('LOWEST_HP_ENEMY 选最低血', () => {
    const player = makeUnit({ uid: 'p1', side: 'player' });
    const e1 = makeUnit({ uid: 'e1', side: 'enemy', currentSoldiers: 3000, maxSoldiers: 5000 });
    const e2 = makeUnit({ uid: 'e2', side: 'enemy', currentSoldiers: 1000, maxSoldiers: 5000 });
    const result = TargetSelector.select('LOWEST_HP_ENEMY', player, [player, e1, e2]);
    expect(result[0].uid).toBe('e2');
  });
});

// === BattleEngine V2 测试 ===

describe('BattleEngine V2', () => {
  const makeSkill = (id: string, overrides: Partial<SkillDefinition> = {}): SkillDefinition => ({
    id, name: id, description: '', skillCategory: 'active',
    activationType: 'AUTO', trigger: null, targetType: 'SINGLE_ENEMY',
    effectList: [{ type: 'DAMAGE', value: 150, scalingPerLevel: 10, duration: 0, maxStacks: 0 }],
    baseChance: 0.3, levelScaling: {}, cooldown: 0, turnCountdown: 0,
    procLimit: 0, duration: 0, conditions: [], priority: 0,
    animationKey: 'attack', tags: [], ...overrides,
  });

  it('战斗产生胜者', () => {
    const skills = [makeSkill('slash')];
    const playerCards = Array.from({ length: 3 }, (_, i) => ({
      cardDef: makeCardDef({ id: `p${i}`, skillIds: ['slash'], element: 'PASSION', baseStats: makeStats({ attack: 2000, soldiers: 8000 }) }),
      cardInstance: makeCardInstance({ instanceId: `pi${i}`, derivedStats: makeStats({ attack: 2000, soldiers: 8000 }) }),
      position: (['FRONT_LEFT', 'FRONT_RIGHT', 'BACK_CENTER'] as const)[i],
    }));
    const enemyCards = Array.from({ length: 3 }, (_, i) => ({
      cardDef: makeCardDef({ id: `e${i}`, skillIds: ['slash'], element: 'COOL', baseStats: makeStats({ attack: 800, soldiers: 3000 }) }),
      cardInstance: makeCardInstance({ instanceId: `ei${i}`, derivedStats: makeStats({ attack: 800, soldiers: 3000 }) }),
      position: (['FRONT_LEFT', 'FRONT_RIGHT', 'BACK_CENTER'] as const)[i],
    }));

    const engine = new BattleEngine(playerCards, enemyCards, skills, 42);
    const state = engine.runBattle();
    expect(state.phase).not.toBe('ongoing');
    expect(state.log.length).toBeGreaterThan(0);
  });

  it('相同种子产生相同结果', () => {
    const skills = [makeSkill('slash')];
    const makeCards = () => ({
      player: [{ cardDef: makeCardDef({ skillIds: ['slash'] }), cardInstance: makeCardInstance(), position: 'FRONT_LEFT' as const }],
      enemy: [{ cardDef: makeCardDef({ skillIds: ['slash'] }), cardInstance: makeCardInstance(), position: 'FRONT_LEFT' as const }],
    });

    const c1 = makeCards();
    const c2 = makeCards();
    const state1 = new BattleEngine(c1.player, c1.enemy, skills, 999).runBattle();
    const state2 = new BattleEngine(c2.player, c2.enemy, skills, 999).runBattle();
    expect(state1.phase).toBe(state2.phase);
    expect(state1.log.length).toBe(state2.log.length);
  });

  it('EventBus 发出事件', () => {
    const skills = [makeSkill('slash')];
    const engine = new BattleEngine(
      [{ cardDef: makeCardDef({ skillIds: ['slash'] }), cardInstance: makeCardInstance(), position: 'FRONT_LEFT' }],
      [{ cardDef: makeCardDef({ skillIds: ['slash'] }), cardInstance: makeCardInstance(), position: 'FRONT_LEFT' }],
      skills, 42,
    );
    const events: string[] = [];
    engine.getEventBus().on(BattleEvents.BATTLE_START, () => events.push('start'));
    engine.getEventBus().on(BattleEvents.BATTLE_END, () => events.push('end'));
    engine.getEventBus().on(BattleEvents.DAMAGE_DEALT, () => events.push('damage'));
    engine.runBattle();
    expect(events).toContain('start');
    expect(events).toContain('end');
    expect(events).toContain('damage');
  });

  it('STUN 跳过回合', () => {
    const stunSkill = makeSkill('stun', {
      activationType: 'PASSIVE', trigger: 'BATTLE_START',
      targetType: 'SINGLE_ENEMY', baseChance: 1.0,
      effectList: [{ type: 'STUN', value: 0, scalingPerLevel: 0, duration: 99, maxStacks: 1 }],
    });
    const engine = new BattleEngine(
      [{ cardDef: makeCardDef({ skillIds: ['stun'] }), cardInstance: makeCardInstance(), position: 'FRONT_LEFT' }],
      [{ cardDef: makeCardDef({ skillIds: [] }), cardInstance: makeCardInstance(), position: 'FRONT_LEFT' }],
      [stunSkill], 42,
    );
    const state = engine.runBattle();
    // 敌人被眩晕，应该玩家赢
    expect(state.phase).toBe('player_win');
  });

  it('快照和恢复', () => {
    const skills = [makeSkill('slash')];
    const engine = new BattleEngine(
      [{ cardDef: makeCardDef({ skillIds: ['slash'] }), cardInstance: makeCardInstance(), position: 'FRONT_LEFT' }],
      [{ cardDef: makeCardDef({ skillIds: ['slash'] }), cardInstance: makeCardInstance(), position: 'FRONT_LEFT' }],
      skills, 42,
    );
    const snapshot = engine.getSnapshot();
    expect(typeof snapshot).toBe('string');
    engine.restoreSnapshot(snapshot);
    expect(engine.getState().turn).toBe(0);
  });
});
