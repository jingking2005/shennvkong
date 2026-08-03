/**
 * OC-06 战斗引擎测试：确定性回放、四模式 fixture、1/5/0 单位边界。
 */
import { describe, expect, it } from 'vitest';
import { runBattleTurn, type Combatant } from './battle-engine';
import { computeHit, elementalMultiplier } from './damage-calc';
import { deathCheck, orderBySpeed } from './status-engine';
import { mulberry32 } from './rng';

function mk(over: Partial<Combatant> & { instId: string }): Combatant {
  return {
    card: {
      id: over.instId, name: over.instId, rarity: 'SR', element: 'passion',
      stats: { attack: 100, defense: 50, soldiers: 100, speed: 100, critRate: 20, critDamage: 150 },
    } as Combatant['card'],
    lv: 1, atk: 100, hp: 1000, hpMax: 1000, def: 50, speed: 100,
    element: 'passion', skillName: '测试技能', procChance: 0.5, skillMult: 3.0,
    skillFx: 'fire', isLeader: false,
    ...over,
  } as Combatant;
}

describe('seed 确定性', () => {
  const team = [mk({ instId: 'p1' }), mk({ instId: 'p2', speed: 120 })];
  const enemies = [mk({ instId: 'e1', element: 'cool' }), mk({ instId: 'e2', element: 'cool', speed: 80 })];

  it('相同 seed 产生完全一致的行动序列与事件日志', () => {
    const a = runBattleTurn(team.map(c => ({ ...c })), enemies.map(c => ({ ...c })), 42);
    const b = runBattleTurn(team.map(c => ({ ...c })), enemies.map(c => ({ ...c })), 42);
    expect(a.actions).toEqual(b.actions);
    expect(a.events).toEqual(b.events);
    expect(a.events.length).toBeGreaterThan(0);
  });

  it('不同 seed 产生不同结果', () => {
    const a = runBattleTurn(team.map(c => ({ ...c })), enemies.map(c => ({ ...c })), 1);
    const b = runBattleTurn(team.map(c => ({ ...c })), enemies.map(c => ({ ...c })), 999);
    expect(a.actions.map(x => x.damage)).not.toEqual(b.actions.map(x => x.damage));
  });
});

describe('状态引擎边界', () => {
  it('速度降序：玩家与敌人混排', () => {
    const order = orderBySpeed([mk({ instId: 'p', speed: 50 })], [mk({ instId: 'e', speed: 200 })]);
    expect(order[0].unit.instId).toBe('e');
    expect(order[1].side).toBe('player');
  });

  it('1 单位：单挑可行动', () => {
    const r = runBattleTurn([mk({ instId: 'solo' })], [mk({ instId: 'boss', hp: 100000, hpMax: 100000 })], 7);
    expect(r.actions.length).toBe(2);
    expect(r.finished).toBe(false);
  });

  it('0 单位：一方全灭立即终局', () => {
    const dead = mk({ instId: 'corpse', hp: 0 });
    const check = deathCheck([dead], [mk({ instId: 'alive' })]);
    expect(check.finished).toBe(true);
    expect(check.playerWon).toBe(false);
    const r = runBattleTurn([dead], [mk({ instId: 'winner' })], 1);
    expect(r.playerWon).toBe(false);
    expect(r.finished).toBe(true);
    expect(r.events.some(e => e.phase === 'battle-end')).toBe(true);
  });

  it('5 单位满编：全部存活者行动', () => {
    const team5 = Array.from({ length: 5 }, (_, i) => mk({ instId: `t${i}`, speed: 100 + i }));
    const foe = [mk({ instId: 'foe', hp: 999999, hpMax: 999999 })];
    const r = runBattleTurn(team5, foe, 3);
    expect(r.actions.length).toBe(6);
    expect(r.playerAlive).toBe(5);
  });
});

describe('伤害计算', () => {
  it('元素克制：光↔暗 1.5、火↔cool 1.4、同系 1.0', () => {
    expect(elementalMultiplier('light', 'dark')).toBe(1.5);
    expect(elementalMultiplier('dark', 'light')).toBe(1.5);
    expect(elementalMultiplier('passion', 'cool')).toBeCloseTo(1.4);
    expect(elementalMultiplier('fire', 'cool')).toBeCloseTo(1.4);
    expect(elementalMultiplier('light', 'light')).toBe(1.0);
  });

  it('伤害 ≥1 且受防御减免', () => {
    const rng = mulberry32(1);
    const hit = computeHit({ atk: 100, targetDef: 5000, elementMult: 1, critRate: 0, critDamage: 150, skillMult: 1, sideBonus: 1 }, rng);
    expect(hit.damage).toBeGreaterThanOrEqual(1);
    expect(hit.crit).toBe(false);
  });
});
