/**
 * BattleEngine V2 — 回合制战斗引擎
 * 参考 OpenDuelyst ActionQueue + SabberStone 状态管理 + Fireplace 事件队列
 *
 * 设计原则：
 * 1. 纯逻辑，无 Phaser 依赖
 * 2. 通过 EventBus 发事件，渲染层订阅
 * 3. 所有随机通过 SeededRNG
 * 4. 支持手动/自动模式
 * 5. 支持快照/回滚
 */

import type {
  BattleState, BattleUnit, BattleAction, CardDefinition, CardInstance,
  SkillDefinition, Position, Side, Stats,
} from '../data/types';
import { EventBus, BattleEvents } from './event-bus';
import { SeededRNG } from './rng';
import { StatusEngine } from './status-engine';
import { calculateDamage, calculateHeal, rollCrit, DEFAULT_DAMAGE_CONFIG, type DamageConfig } from './damage-calc';
import { TargetSelector } from './target-selector';

export interface BattleConfig {
  maxTurns: number;
  damageConfig: DamageConfig;
  autoBattle: boolean;
}

const DEFAULT_BATTLE_CONFIG: BattleConfig = {
  maxTurns: 50,
  damageConfig: DEFAULT_DAMAGE_CONFIG,
  autoBattle: true,
};

export class BattleEngine {
  private state: BattleState;
  private rng: SeededRNG;
  private bus: EventBus;
  private config: BattleConfig;
  private skillDefs: Map<string, SkillDefinition>;
  private uidCounter = 0;

  constructor(
    playerUnits: { cardDef: CardDefinition; cardInstance: CardInstance; position: Position }[],
    enemyUnits: { cardDef: CardDefinition; cardInstance: CardInstance; position: Position }[],
    skillDefs: SkillDefinition[],
    seed: number = 42,
    config: Partial<BattleConfig> = {},
  ) {
    this.config = { ...DEFAULT_BATTLE_CONFIG, ...config };
    this.rng = new SeededRNG(seed);
    this.bus = new EventBus();
    this.skillDefs = new Map(skillDefs.map(s => [s.id, s]));

    // 创建战斗单位
    const units: BattleUnit[] = [
      ...playerUnits.map(u => this.createUnit(u.cardDef, u.cardInstance, 'player', u.position)),
      ...enemyUnits.map(u => this.createUnit(u.cardDef, u.cardInstance, 'enemy', u.position)),
    ];

    this.state = {
      turn: 0,
      phase: 'ongoing',
      units,
      log: [],
      rngState: this.rng.getState(),
    };
  }

  getEventBus(): EventBus { return this.bus; }
  getState(): BattleState { return this.state; }

  /** 运行完整战斗（自动模式） */
  runBattle(): BattleState {
    this.bus.emit(BattleEvents.BATTLE_START, { state: this.state });

    // 战斗开始触发
    this.triggerSkills('BATTLE_START');

    while (this.state.phase === 'ongoing' && this.state.turn < this.config.maxTurns) {
      this.executeTurn();
    }

    // 超时判定
    if (this.state.phase === 'ongoing') {
      this.resolveTimeout();
    }

    this.bus.emit(BattleEvents.BATTLE_END, { state: this.state });
    return this.state;
  }

  /** 执行一个回合 */
  private executeTurn(): void {
    this.state.turn++;
    this.bus.emit(BattleEvents.TURN_START, { turn: this.state.turn });

    // 回合开始触发
    this.triggerSkills('ALLY_TURN_START');
    this.triggerSkills('ENEMY_TURN_START');

    // 按速度排序
    const sorted = this.getAliveUnitsSorted();

    for (const unit of sorted) {
      if (this.state.phase !== 'ongoing') break;
      if (!unit.isAlive) continue;

      // 检查控制
      if (StatusEngine.isControlled(unit)) {
        this.bus.emit(BattleEvents.STATUS_APPLIED, { unit: unit.uid, type: 'TURN_SKIP' });
        continue;
      }

      // 执行单位行动
      this.executeUnitAction(unit);

      // 检查胜负
      this.checkVictory();
    }

    // 回合结束：状态 tick
    for (const unit of this.state.units) {
      if (!unit.isAlive) continue;
      const expired = StatusEngine.tick(unit);
      for (const s of expired) {
        this.bus.emit(BattleEvents.STATUS_EXPIRED, { unit: unit.uid, status: s });
      }
      unit.hasActed = false;
    }

    this.bus.emit(BattleEvents.TURN_END, { turn: this.state.turn });
  }

  /** 执行单个单位的行动 */
  private executeUnitAction(unit: BattleUnit): void {
    // 1. 行动前被动触发
    this.triggerSkillsForUnit(unit, 'BEFORE_ATTACK');

    // 2. 尝试释放技能（自动模式下概率触发）
    if (!StatusEngine.isSilenced(unit)) {
      this.tryAutoSkills(unit);
    }

    // 3. 普通攻击
    if (unit.isAlive && !unit.hasActed) {
      this.executeNormalAttack(unit);
    }

    // 4. 行动后被动触发
    this.triggerSkillsForUnit(unit, 'AFTER_ATTACK');
  }

  /** 普通攻击 */
  private executeNormalAttack(unit: BattleUnit): void {
    const enemies = this.state.units.filter(u => u.isAlive && u.side !== unit.side);
    if (enemies.length === 0) return;

    // 选择目标（嘲讽优先 → 前排 → 随机）
    const targets = TargetSelector.select('SINGLE_ENEMY', unit, this.state.units, () => this.rng.next());
    if (targets.length === 0) return;
    const target = targets[0];

    // 暴击判定
    const isCrit = rollCrit(unit, () => this.rng.next());

    // 随机方差
    const variance = this.config.damageConfig.randomVarianceMin +
      this.rng.next() * (this.config.damageConfig.randomVarianceMax - this.config.damageConfig.randomVarianceMin);

    this.bus.emit(BattleEvents.BEFORE_ACTION, { actor: unit.uid, type: 'normal_attack' });

    const result = calculateDamage({
      attacker: unit,
      defender: target,
      skillMultiplier: 1.0,
      randomVariance: variance,
      isCrit,
      config: this.config.damageConfig,
    });

    const action: BattleAction = {
      type: 'normal_attack',
      actorUid: unit.uid,
      targetUids: [target.uid],
      damage: result.finalDamage,
      isCrit: result.isCrit,
      elementBonus: result.elementMultiplier,
      killed: result.killed ? [target.uid] : [],
    };

    this.state.log.push(action);
    unit.hasActed = true;

    this.bus.emit(BattleEvents.DAMAGE_DEALT, {
      actor: unit.uid, target: target.uid, damage: result.finalDamage,
      isCrit: result.isCrit, elementBonus: result.elementMultiplier,
    });

    if (result.killed) {
      this.bus.emit(BattleEvents.UNIT_DIED, { unit: target.uid, killer: unit.uid });
      this.triggerSkillsForUnit(target, 'ALLY_DEATH');
    }

    this.bus.emit(BattleEvents.AFTER_ACTION, action);
  }

  /** 尝试自动释放技能 */
  private tryAutoSkills(unit: BattleUnit): void {
    for (const skillId of unit.cardDef.skillIds) {
      const skill = this.skillDefs.get(skillId);
      if (!skill) continue;
      if (skill.activationType !== 'AUTO' && skill.activationType !== 'PASSIVE') continue;

      // 检查冷却
      const cd = unit.skillCooldowns.get(skillId) || 0;
      if (cd > 0) continue;

      // 检查使用次数
      const procs = unit.skillProcCounts.get(skillId) || 0;
      if (skill.procLimit > 0 && procs >= skill.procLimit) continue;

      // 概率判定
      if (!this.rng.chance(skill.baseChance)) continue;

      // 检查条件
      if (!this.checkConditions(skill, unit)) continue;

      // 释放技能
      this.executeSkill(unit, skill);
    }
  }

  /** 执行技能 */
  private executeSkill(unit: BattleUnit, skill: SkillDefinition): void {
    // 检查技能无效
    if (StatusEngine.hasSkillNullify(unit)) {
      this.bus.emit(BattleEvents.SKILL_BLOCKED, { unit: unit.uid, skillId: skill.id });
      return;
    }

    this.bus.emit(BattleEvents.SKILL_TRIGGERED, { unit: unit.uid, skillId: skill.id, skillName: skill.name });

    // 选择目标
    const targets = TargetSelector.select(
      skill.targetType, unit, this.state.units, () => this.rng.next()
    );

    // 执行效果列表
    for (const effect of skill.effectList) {
      const value = effect.value + effect.scalingPerLevel * (unit.cardInstance.skillLevels[0] || 0);

      switch (effect.type) {
        case 'DAMAGE':
        case 'AOE_DAMAGE': {
          for (const target of targets) {
            const isCrit = rollCrit(unit, () => this.rng.next());
            const variance = 0.95 + this.rng.next() * 0.1;
            const result = calculateDamage({
              attacker: unit, defender: target,
              skillMultiplier: value / 100, randomVariance: variance,
              isCrit, config: this.config.damageConfig,
            });
            this.bus.emit(BattleEvents.DAMAGE_DEALT, {
              actor: unit.uid, target: target.uid, damage: result.finalDamage,
              isCrit, skillId: skill.id,
            });
            if (result.killed) {
              this.bus.emit(BattleEvents.UNIT_DIED, { unit: target.uid, killer: unit.uid });
            }
          }
          break;
        }
        case 'HEAL': {
          for (const target of targets) {
            const healResult = calculateHeal({
              caster: unit, target,
              skillMultiplier: value / 100,
              healingBuff: 1.0,
              receivedHealingModifier: 1.0,
            });
            this.bus.emit(BattleEvents.HEAL_APPLIED, {
              caster: unit.uid, target: target.uid, heal: healResult.actualHeal, skillId: skill.id,
            });
          }
          break;
        }
        case 'SHIELD': {
          for (const target of targets) {
            target.shields += Math.floor(value);
          }
          break;
        }
        case 'ATTACK_UP': case 'DEFENSE_UP': case 'CRIT_UP':
        case 'ATTACK_DOWN': case 'DEFENSE_DOWN': case 'VULNERABILITY':
        case 'DAMAGE_REDUCTION': case 'STUN': case 'SILENCE':
        case 'TAUNT': case 'TURN_SKIP': case 'SKILL_NULLIFY':
        case 'PROTECT': {
          for (const target of targets) {
            const statusEffect = {
              id: `${skill.id}_${Date.now()}_${this.rng.next()}`,
              sourceSkillId: skill.id,
              sourceUnitId: unit.uid,
              type: effect.type,
              value,
              duration: effect.duration || skill.duration || 2,
              stacks: 1,
              maxStacks: effect.maxStacks || 1,
              isDebuff: ['ATTACK_DOWN', 'DEFENSE_DOWN', 'VULNERABILITY', 'STUN', 'SILENCE', 'TURN_SKIP'].includes(effect.type),
              dispellable: true,
            };
            const applied = StatusEngine.apply(target, statusEffect);
            if (applied) {
              this.bus.emit(BattleEvents.STATUS_APPLIED, { unit: target.uid, status: statusEffect });
            }
          }
          break;
        }
        case 'CLEANSE': {
          for (const target of targets) {
            const removed = StatusEngine.cleanse(target);
            for (const s of removed) {
              this.bus.emit(BattleEvents.STATUS_REMOVED, { unit: target.uid, status: s });
            }
          }
          break;
        }
        case 'DISPEL': {
          for (const target of targets) {
            const removed = StatusEngine.dispel(target);
            for (const s of removed) {
              this.bus.emit(BattleEvents.STATUS_REMOVED, { unit: target.uid, status: s });
            }
          }
          break;
        }
        // 更多效果类型可在此扩展
      }
    }

    // 设置冷却
    if (skill.cooldown > 0) {
      unit.skillCooldowns.set(skill.id, skill.cooldown);
    }
    // 增加使用计数
    unit.skillProcCounts.set(skill.id, (unit.skillProcCounts.get(skill.id) || 0) + 1);

    // 记录日志
    this.state.log.push({
      type: 'skill',
      actorUid: unit.uid,
      skillId: skill.id,
      targetUids: targets.map(t => t.uid),
    });
  }

  /** 触发指定类型技能 */
  private triggerSkills(trigger: string): void {
    for (const unit of this.state.units) {
      if (!unit.isAlive) continue;
      this.triggerSkillsForUnit(unit, trigger as any);
    }
  }

  private triggerSkillsForUnit(unit: BattleUnit, trigger: string): void {
    for (const skillId of unit.cardDef.skillIds) {
      const skill = this.skillDefs.get(skillId);
      if (!skill || skill.trigger !== trigger) continue;
      if (skill.activationType !== 'PASSIVE' && skill.activationType !== 'REACTION') continue;
      if (this.rng.chance(skill.baseChance)) {
        this.executeSkill(unit, skill);
      }
    }
  }

  /** 检查技能条件 */
  private checkConditions(skill: SkillDefinition, unit: BattleUnit): boolean {
    for (const cond of skill.conditions) {
      switch (cond.type) {
        case 'hp_below':
          if (unit.currentSoldiers / unit.maxSoldiers >= (cond.value as number) / 100) return false;
          break;
        case 'hp_above':
          if (unit.currentSoldiers / unit.maxSoldiers <= (cond.value as number) / 100) return false;
          break;
      }
    }
    return true;
  }

  /** 检查胜负 */
  private checkVictory(): void {
    const playerAlive = this.state.units.some(u => u.side === 'player' && u.isAlive);
    const enemyAlive = this.state.units.some(u => u.side === 'enemy' && u.isAlive);
    if (!enemyAlive) this.state.phase = 'player_win';
    else if (!playerAlive) this.state.phase = 'enemy_win';
  }

  /** 超时判定 */
  private resolveTimeout(): void {
    const playerHp = this.state.units.filter(u => u.side === 'player').reduce((s, u) => s + u.currentSoldiers, 0);
    const enemyHp = this.state.units.filter(u => u.side === 'enemy').reduce((s, u) => s + u.currentSoldiers, 0);
    this.state.phase = playerHp >= enemyHp ? 'player_win' : 'enemy_win';
  }

  /** 获取存活单位按速度排序 */
  private getAliveUnitsSorted(): BattleUnit[] {
    return this.state.units.filter(u => u.isAlive).sort((a, b) => b.currentStats.speed - a.currentStats.speed);
  }

  /** 创建战斗单位 */
  private createUnit(cardDef: CardDefinition, cardInstance: CardInstance, side: Side, position: Position): BattleUnit {
    const stats = { ...cardInstance.derivedStats };
    return {
      uid: `unit_${++this.uidCounter}`,
      cardInstance,
      cardDef,
      side,
      position,
      currentSoldiers: stats.soldiers,
      maxSoldiers: stats.soldiers,
      currentStats: stats,
      statusEffects: [],
      shields: 0,
      isAlive: true,
      skillCooldowns: new Map(),
      skillProcCounts: new Map(),
      countdowns: new Map(),
      hasActed: false,
      tauntTarget: false,
    };
  }

  /** 获取快照（用于回滚） */
  getSnapshot(): string {
    return JSON.stringify({
      state: this.state,
      rngState: this.rng.getState(),
    });
  }

  /** 从快照恢复 */
  restoreSnapshot(snapshot: string): void {
    const data = JSON.parse(snapshot);
    this.state = data.state;
    this.rng.setState(data.rngState);
  }
}
