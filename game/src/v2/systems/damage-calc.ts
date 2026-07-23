/**
 * DamageCalc V2 — 多乘区伤害/治疗计算
 * 参考 spec/v2/combat-system.md 公式
 */

import type { BattleUnit, Element } from '../data/types';
import { StatusEngine } from './status-engine';

// === 配置（应从 JSON 加载，此处为默认值） ===

export interface DamageConfig {
  defConstant: number;       // 防御常数
  elementAdvantage: number;  // 克制倍率
  elementDisadvantage: number; // 被克倍率
  randomVarianceMin: number; // 随机方差下限
  randomVarianceMax: number; // 随机方差上限
  baseCritDamage: number;    // 基础暴击伤害加成
}

export const DEFAULT_DAMAGE_CONFIG: DamageConfig = {
  defConstant: 500,
  elementAdvantage: 1.5,
  elementDisadvantage: 1.5,
  randomVarianceMin: 0.95,
  randomVarianceMax: 1.05,
  baseCritDamage: 0.5,
};

// === 属性克制 ===

/** PASSION ↔ COOL 互克，LIGHT ↔ DARK 互克，SPECIAL 不参与 */
export function getElementMultiplier(attacker: Element, defender: Element, config: DamageConfig): number {
  if (attacker === 'SPECIAL' || defender === 'SPECIAL') return 1.0;
  const advantages: Record<string, string> = {
    PASSION: 'COOL', COOL: 'PASSION',
    LIGHT: 'DARK', DARK: 'LIGHT',
  };
  if (advantages[attacker] === defender) return config.elementAdvantage;
  if (advantages[defender] === attacker) return config.elementDisadvantage;
  return 1.0;
}

// === 伤害计算 ===

export interface DamageInput {
  attacker: BattleUnit;
  defender: BattleUnit;
  skillMultiplier: number;
  randomVariance: number; // 由 RNG 生成 [0.95, 1.05]
  isCrit: boolean;
  config: DamageConfig;
}

export interface DamageResult {
  rawDamage: number;
  mitigation: number;
  elementMultiplier: number;
  buffMultiplier: number;
  vulnerabilityMultiplier: number;
  critMultiplier: number;
  shieldAbsorbed: number;
  finalDamage: number;
  isCrit: boolean;
  killed: boolean;
}

export function calculateDamage(input: DamageInput): DamageResult {
  const { attacker, defender, skillMultiplier, randomVariance, isCrit, config } = input;

  // 原始伤害
  const atkMod = StatusEngine.calculateStatModifier(attacker, 'attack');
  const effectiveAtk = Math.max(0, attacker.currentStats.attack + atkMod);
  const rawDamage = effectiveAtk * skillMultiplier * randomVariance;

  // 防御减伤
  const defMod = StatusEngine.calculateStatModifier(defender, 'defense');
  const effectiveDef = Math.max(0, defender.currentStats.defense + defMod);
  const mitigation = effectiveDef / (effectiveDef + config.defConstant);

  // 属性克制
  const elementMultiplier = getElementMultiplier(
    attacker.cardDef.element, defender.cardDef.element, config
  );

  // Buff 乘区（攻击方增伤）
  let buffMultiplier = 1.0;
  // 可从 attacker 的 BUFF 状态中获取额外增伤

  // 易伤乘区（防守方）
  const vulnerabilityMultiplier = StatusEngine.getVulnerability(defender);

  // 暴击乘区
  const critMultiplier = isCrit ? (1.0 + attacker.currentStats.critDamage + config.baseCritDamage) : 1.0;

  // 减伤
  const damageReduction = StatusEngine.getDamageReduction(defender);

  // 最终伤害（护盾前）
  let finalBeforeShield = Math.floor(
    rawDamage * (1 - mitigation) * elementMultiplier * buffMultiplier * vulnerabilityMultiplier * critMultiplier * (1 - damageReduction)
  );
  finalBeforeShield = Math.max(1, finalBeforeShield);

  // 护盾吸收
  let shieldAbsorbed = 0;
  let finalDamage = finalBeforeShield;
  if (defender.shields > 0) {
    shieldAbsorbed = Math.min(defender.shields, finalDamage);
    defender.shields -= shieldAbsorbed;
    finalDamage -= shieldAbsorbed;
  }

  // 应用伤害
  defender.currentSoldiers -= finalDamage;
  const killed = defender.currentSoldiers <= 0;
  if (killed) {
    defender.currentSoldiers = 0;
    defender.isAlive = false;
  }

  return {
    rawDamage: Math.floor(rawDamage),
    mitigation,
    elementMultiplier,
    buffMultiplier,
    vulnerabilityMultiplier,
    critMultiplier,
    shieldAbsorbed,
    finalDamage,
    isCrit,
    killed,
  };
}

// === 治疗计算 ===

export interface HealInput {
  caster: BattleUnit;
  target: BattleUnit;
  skillMultiplier: number;
  healingBuff: number; // 治疗加成（来自 Buff）
  receivedHealingModifier: number; // 受到的治疗修正（禁疗=0）
}

export interface HealResult {
  rawHeal: number;
  actualHeal: number;
  overheal: number;
}

export function calculateHeal(input: HealInput): HealResult {
  const { caster, target, skillMultiplier, healingBuff, receivedHealingModifier } = input;

  // 禁疗检查
  if (receivedHealingModifier <= 0) {
    return { rawHeal: 0, actualHeal: 0, overheal: 0 };
  }

  const healPower = caster.currentStats.healingPower || caster.currentStats.attack;
  const rawHeal = Math.floor(healPower * skillMultiplier * healingBuff * receivedHealingModifier);

  const missingSoldiers = target.maxSoldiers - target.currentSoldiers;
  const actualHeal = Math.min(rawHeal, missingSoldiers);
  const overheal = rawHeal - actualHeal;

  target.currentSoldiers += actualHeal;

  return { rawHeal, actualHeal, overheal };
}

// === 暴击判定 ===

export function rollCrit(attacker: BattleUnit, rng: () => number): boolean {
  return rng() < attacker.currentStats.critRate;
}
