/**
 * StatusEngine — 状态效果生命周期管理
 * 参考 SabberStone 的 Onion 层叠系统
 */

import type { StatusEffect, BattleUnit, EffectType } from '../data/types';

export class StatusEngine {
  /** 应用状态效果 */
  static apply(unit: BattleUnit, effect: StatusEffect): boolean {
    // 检查免疫
    if (effect.isDebuff && this.hasImmunity(unit, effect.type)) return false;

    // 检查抗性
    if (effect.isDebuff && this.resistCheck(unit)) return false;

    // 查找已有同类型状态
    const existing = unit.statusEffects.find(
      s => s.type === effect.type && s.sourceSkillId === effect.sourceSkillId
    );

    if (existing) {
      // 叠加
      if (existing.maxStacks > 0 && existing.stacks < existing.maxStacks) {
        existing.stacks++;
        existing.value = effect.value; // 刷新数值
        existing.duration = Math.max(existing.duration, effect.duration);
      } else if (existing.maxStacks === 0) {
        // 不可叠加，刷新持续时间
        existing.duration = Math.max(existing.duration, effect.duration);
        existing.value = Math.max(existing.value, effect.value);
      }
    } else {
      // 新增
      unit.statusEffects.push({ ...effect });
    }

    return true;
  }

  /** 移除状态效果 */
  static remove(unit: BattleUnit, statusId: string): StatusEffect | null {
    const idx = unit.statusEffects.findIndex(s => s.id === statusId);
    if (idx < 0) return null;
    const [removed] = unit.statusEffects.splice(idx, 1);
    return removed;
  }

  /** 移除指定类型的所有状态 */
  static removeByType(unit: BattleUnit, type: EffectType): StatusEffect[] {
    const removed: StatusEffect[] = [];
    unit.statusEffects = unit.statusEffects.filter(s => {
      if (s.type === type) { removed.push(s); return false; }
      return true;
    });
    return removed;
  }

  /** 净化（移除所有可驱散的 Debuff） */
  static cleanse(unit: BattleUnit): StatusEffect[] {
    const removed: StatusEffect[] = [];
    unit.statusEffects = unit.statusEffects.filter(s => {
      if (s.isDebuff && s.dispellable) { removed.push(s); return false; }
      return true;
    });
    return removed;
  }

  /** 驱散（移除所有可驱散的 Buff） */
  static dispel(unit: BattleUnit): StatusEffect[] {
    const removed: StatusEffect[] = [];
    unit.statusEffects = unit.statusEffects.filter(s => {
      if (!s.isDebuff && s.dispellable) { removed.push(s); return false; }
      return true;
    });
    return removed;
  }

  /** 回合结束：递减持续时间，移除过期状态 */
  static tick(unit: BattleUnit): StatusEffect[] {
    const expired: StatusEffect[] = [];
    unit.statusEffects = unit.statusEffects.filter(s => {
      s.duration--;
      if (s.duration <= 0) { expired.push(s); return false; }
      return true;
    });
    return expired;
  }

  /** 获取指定类型的状态效果 */
  static getByType(unit: BattleUnit, type: EffectType): StatusEffect[] {
    return unit.statusEffects.filter(s => s.type === type);
  }

  /** 检查是否有指定类型状态 */
  static has(unit: BattleUnit, type: EffectType): boolean {
    return unit.statusEffects.some(s => s.type === type);
  }

  /** 计算属性修改（所有 Buff/Debuff 叠加） */
  static calculateStatModifier(unit: BattleUnit, stat: 'attack' | 'defense'): number {
    let flatBonus = 0;
    let percentBonus = 0;

    for (const s of unit.statusEffects) {
      if (stat === 'attack') {
        if (s.type === 'ATTACK_UP') { flatBonus += s.value * s.stacks; }
        if (s.type === 'ATTACK_DOWN') { flatBonus -= s.value * s.stacks; }
      } else {
        if (s.type === 'DEFENSE_UP') { flatBonus += s.value * s.stacks; }
        if (s.type === 'DEFENSE_DOWN') { flatBonus -= s.value * s.stacks; }
      }
    }

    return flatBonus;
  }

  /** 计算伤害减免百分比 */
  static getDamageReduction(unit: BattleUnit): number {
    let reduction = 0;
    for (const s of unit.statusEffects) {
      if (s.type === 'DAMAGE_REDUCTION') reduction += s.value * s.stacks;
    }
    return Math.min(reduction, 0.9); // 最高 90% 减伤
  }

  /** 计算易伤倍率 */
  static getVulnerability(unit: BattleUnit): number {
    let vuln = 1.0;
    for (const s of unit.statusEffects) {
      if (s.type === 'VULNERABILITY') vuln += s.value * s.stacks;
    }
    return vuln;
  }

  /** 检查是否被控制（跳过回合） */
  static isControlled(unit: BattleUnit): boolean {
    return unit.statusEffects.some(s =>
      s.type === 'STUN' || s.type === 'TURN_SKIP'
    );
  }

  /** 检查是否被沉默 */
  static isSilenced(unit: BattleUnit): boolean {
    return unit.statusEffects.some(s => s.type === 'SILENCE');
  }

  /** 检查是否有嘲讽 */
  static hasTaunt(unit: BattleUnit): boolean {
    return unit.statusEffects.some(s => s.type === 'TAUNT');
  }

  /** 检查是否有技能无效 */
  static hasSkillNullify(unit: BattleUnit): boolean {
    return unit.statusEffects.some(s => s.type === 'SKILL_NULLIFY');
  }

  // === 内部方法 ===

  private static hasImmunity(unit: BattleUnit, type: EffectType): boolean {
    // PROTECT 免疫所有 Debuff
    if (unit.statusEffects.some(s => s.type === 'PROTECT')) return true;
    return false;
  }

  private static resistCheck(unit: BattleUnit): boolean {
    // 简化：statusResistance > 50 时有概率抵抗
    const resist = unit.currentStats.statusResistance;
    if (resist > 50) {
      // 这里不直接调用 RNG，由外部传入判定结果
      // 返回 false 表示不抵抗（默认通过）
      // 实际抵抗判定在 BattleEngine 中通过 RNG 完成
    }
    return false;
  }
}
