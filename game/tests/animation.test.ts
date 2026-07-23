import { describe, it, expect } from 'vitest';
import {
  buildAnimationQueue,
  getHpColor,
  getAttackOffset,
  type AnimStep,
} from '../src/ui/BattleAnimator';
import type { BattleAction } from '../src/data/schema/types';

// === 辅助：构造 BattleAction ===

function makeAction(overrides: Partial<BattleAction> = {}): BattleAction {
  return {
    turn: 1,
    actorUid: 'unit_1',
    actorName: '测试角色',
    type: 'attack',
    targetUids: ['unit_2'],
    damage: 100,
    isSkill: false,
    elementBonus: 1.0,
    killed: [],
    ...overrides,
  };
}

// === BattleAnimator: buildAnimationQueue ===

describe('BattleAnimator - buildAnimationQueue', () => {
  it('普通攻击产生 attack + hit 两步', () => {
    const log: BattleAction[] = [makeAction()];
    const queue = buildAnimationQueue(log);

    const types = queue.map(s => s.type);
    expect(types).toContain('attack');
    expect(types).toContain('hit');
  });

  it('技能攻击产生 skill_banner + attack + hit', () => {
    const log: BattleAction[] = [makeAction({
      type: 'skill',
      isSkill: true,
      skillName: '烈焰风暴',
    })];
    const queue = buildAnimationQueue(log);

    const types = queue.map(s => s.type);
    expect(types).toContain('skill_banner');
    expect(types).toContain('attack');
    expect(types).toContain('hit');

    // skill_banner 在 attack 之前
    const bannerIdx = types.indexOf('skill_banner');
    const attackIdx = types.indexOf('attack');
    expect(bannerIdx).toBeLessThan(attackIdx);
  });

  it('击杀时产生 death 步骤', () => {
    const log: BattleAction[] = [makeAction({ killed: ['unit_2'] })];
    const queue = buildAnimationQueue(log);

    const types = queue.map(s => s.type);
    expect(types).toContain('death');
  });

  it('多目标技能为每个目标产生 hit', () => {
    const log: BattleAction[] = [makeAction({
      type: 'skill',
      isSkill: true,
      skillName: '全体攻击',
      targetUids: ['unit_2', 'unit_3', 'unit_4'],
      damage: 300,
    })];
    const queue = buildAnimationQueue(log);

    const hitSteps = queue.filter(s => s.type === 'hit');
    expect(hitSteps.length).toBe(3);
  });

  it('空日志产生空队列', () => {
    const queue = buildAnimationQueue([]);
    expect(queue).toHaveLength(0);
  });

  it('每个 AnimStep 都有 duration > 0', () => {
    const log: BattleAction[] = [
      makeAction(),
      makeAction({ type: 'skill', isSkill: true, skillName: 'X', killed: ['unit_2'] }),
    ];
    const queue = buildAnimationQueue(log);
    for (const step of queue) {
      expect(step.duration).toBeGreaterThan(0);
    }
  });

  it('attack 步骤包含 actorUid', () => {
    const log: BattleAction[] = [makeAction({ actorUid: 'unit_7' })];
    const queue = buildAnimationQueue(log);
    const atkStep = queue.find(s => s.type === 'attack');
    expect(atkStep?.actorUid).toBe('unit_7');
  });

  it('hit 步骤包含 targetUid 和 damage', () => {
    const log: BattleAction[] = [makeAction({ targetUids: ['unit_5'], damage: 42 })];
    const queue = buildAnimationQueue(log);
    const hitStep = queue.find(s => s.type === 'hit');
    expect(hitStep?.targetUid).toBe('unit_5');
    expect(hitStep?.damage).toBe(42);
  });

  it('克制攻击的 hit 步骤标记 elementBonus', () => {
    const log: BattleAction[] = [makeAction({ elementBonus: 1.3 })];
    const queue = buildAnimationQueue(log);
    const hitStep = queue.find(s => s.type === 'hit');
    expect(hitStep?.elementBonus).toBe(1.3);
  });
});

// === HealthBar 颜色逻辑 ===

describe('getHpColor', () => {
  it('HP > 60% 返回绿色', () => {
    expect(getHpColor(1.0)).toBe(0x4caf50);
    expect(getHpColor(0.61)).toBe(0x4caf50);
  });

  it('HP 30%-60% 返回黄色', () => {
    expect(getHpColor(0.6)).toBe(0xffc107);
    expect(getHpColor(0.31)).toBe(0xffc107);
  });

  it('HP <= 30% 返回红色', () => {
    expect(getHpColor(0.3)).toBe(0xf44336);
    expect(getHpColor(0.0)).toBe(0xf44336);
  });
});

// === 攻击位移方向 ===

describe('getAttackOffset', () => {
  it('player 方向向上（负 y）', () => {
    const offset = getAttackOffset('player');
    expect(offset.y).toBeLessThan(0);
    expect(offset.x).toBe(0);
  });

  it('enemy 方向向下（正 y）', () => {
    const offset = getAttackOffset('enemy');
    expect(offset.y).toBeGreaterThan(0);
    expect(offset.x).toBe(0);
  });
});
