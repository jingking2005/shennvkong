/**
 * BattleAnimator — 战斗动画队列生成器（纯逻辑，无 Phaser 依赖）
 *
 * 将 BattleEngine 产出的 actionLog 转换为可顺序播放的动画步骤队列。
 * BattleScene 消费这些步骤，驱动 Phaser Tween / Text 动画。
 */

import type { BattleAction } from '../data/schema/types';

// === 动画步骤类型 ===

export type AnimStepType = 'attack' | 'hit' | 'death' | 'skill_banner' | 'turn_start' | 'victory';

export interface AnimStep {
  type: AnimStepType;
  duration: number; // ms
  actorUid?: string;
  targetUid?: string;
  damage?: number;
  elementBonus?: number;
  skillName?: string;
  killedUids?: string[];
  turn?: number;
}

// === 时间常量 ===

const DURATION = {
  ATTACK_LUNGE: 250,
  HIT_IMPACT: 350,
  DEATH_FADE: 500,
  SKILL_BANNER: 800,
  TURN_PAUSE: 300,
  VICTORY: 1000,
} as const;

// === 核心：将战斗日志转为动画队列 ===

export function buildAnimationQueue(log: BattleAction[]): AnimStep[] {
  const queue: AnimStep[] = [];
  let lastTurn = 0;

  for (const action of log) {
    // 回合切换提示
    if (action.turn > lastTurn) {
      lastTurn = action.turn;
      queue.push({ type: 'turn_start', duration: DURATION.TURN_PAUSE, turn: action.turn });
    }

    // 技能横幅
    if (action.isSkill && action.skillName) {
      queue.push({
        type: 'skill_banner',
        duration: DURATION.SKILL_BANNER,
        actorUid: action.actorUid,
        skillName: action.skillName,
      });
    }

    // 攻击位移
    queue.push({
      type: 'attack',
      duration: DURATION.ATTACK_LUNGE,
      actorUid: action.actorUid,
    });

    // 受击（每个目标一个 hit 步骤）
    const targets = action.targetUids;
    const perTargetDamage = targets.length > 1
      ? Math.round((action.damage ?? 0) / targets.length)
      : (action.damage ?? 0);

    for (const targetUid of targets) {
      queue.push({
        type: 'hit',
        duration: DURATION.HIT_IMPACT,
        actorUid: action.actorUid,
        targetUid,
        damage: perTargetDamage,
        elementBonus: action.elementBonus,
      });
    }

    // 死亡
    if (action.killed && action.killed.length > 0) {
      queue.push({
        type: 'death',
        duration: DURATION.DEATH_FADE,
        killedUids: [...action.killed],
      });
    }
  }

  return queue;
}

// === HP 条颜色 ===

export function getHpColor(ratio: number): number {
  if (ratio > 0.6) return 0x4caf50; // 绿
  if (ratio > 0.3) return 0xffc107; // 黄
  return 0xf44336; // 红
}

// === 攻击位移方向 ===

export function getAttackOffset(side: 'player' | 'enemy'): { x: number; y: number } {
  const LUNGE_DISTANCE = 60;
  return {
    x: side === 'player' ? LUNGE_DISTANCE : -LUNGE_DISTANCE,
    y: 0,
  };
}
