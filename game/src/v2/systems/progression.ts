/**
 * V2 养成系统 — 升级/进化/FIFA式强化
 * 参考 spec/v2/progression-system.md + spec/v2/enhancement-system.md
 */

import type { CardInstance, CardDefinition, Rarity, Stats } from '../data/types';

// === 配置 ===

const MAX_LEVELS: Record<string, number> = { N: 20, R: 30, SR: 40, UR: 50, LR: 60 };
const EVOLUTION_STAGES = 4; // 0→1→2→3→4

// 强化成功率表
const ENHANCE_RATES = [1.0, 0.9, 0.75, 0.6, 0.45, 0.3, 0.2, 0.12, 0.07, 0.03];
// 强化属性加成表（百分比）
const ENHANCE_BONUS = [0, 0.02, 0.04, 0.07, 0.10, 0.14, 0.18, 0.23, 0.28, 0.34, 0.40];

// === 经验曲线 ===

export function getExpForLevel(level: number): number {
  if (level <= 0) return 0;
  return Math.floor(100 * Math.pow(level, 1.3));
}

export function getMaxLevel(rarity: Rarity): number {
  return MAX_LEVELS[rarity] || 30;
}

// === 属性成长 ===

export function calculateDerivedStats(baseStats: Stats, level: number, maxLevel: number, enhancement: number): Stats {
  const growthFactor = 1 + (level - 1) / Math.max(maxLevel - 1, 1); // 1.0 → 2.0
  const enhanceBonus = 1 + (ENHANCE_BONUS[enhancement] || 0);

  return {
    attack: Math.floor(baseStats.attack * growthFactor * enhanceBonus),
    defense: Math.floor(baseStats.defense * growthFactor * enhanceBonus),
    soldiers: Math.floor(baseStats.soldiers * growthFactor * enhanceBonus),
    speed: baseStats.speed, // 速度不成长
    critRate: baseStats.critRate,
    critDamage: baseStats.critDamage,
    healingPower: Math.floor(baseStats.healingPower * growthFactor),
    damageReduction: baseStats.damageReduction,
    statusAccuracy: baseStats.statusAccuracy,
    statusResistance: baseStats.statusResistance,
  };
}

// === 升级 ===

export interface LevelUpResult {
  instance: CardInstance;
  levelsGained: number;
  expOverflow: number;
}

export function levelUp(instance: CardInstance, cardDef: CardDefinition, expGained: number): LevelUpResult {
  const maxLevel = getMaxLevel(cardDef.rarity);
  let level = instance.level;
  let exp = instance.exp + expGained;
  let levelsGained = 0;

  while (level < maxLevel) {
    const needed = getExpForLevel(level);
    if (exp >= needed) {
      exp -= needed;
      level++;
      levelsGained++;
    } else break;
  }

  if (level >= maxLevel) exp = 0;

  const newStats = calculateDerivedStats(cardDef.baseStats, level, maxLevel, instance.enhancement);

  return {
    instance: { ...instance, level, exp, derivedStats: newStats },
    levelsGained,
    expOverflow: level >= maxLevel ? exp : 0,
  };
}

// === 素材经验值 ===

export function getMaterialExp(material: CardInstance, rarity: Rarity): number {
  const baseExp: Record<string, number> = { N: 50, R: 150, SR: 500, UR: 1500, LR: 5000 };
  const base = baseExp[rarity] || 50;
  return Math.floor(base * (1 + material.level * 0.1));
}

// === 进化 ===

export function canEvolve(instance: CardInstance, cardDef: CardDefinition, inventory: CardInstance[]): boolean {
  if (instance.evolutionStage >= EVOLUTION_STAGES) return false;
  const maxLevel = getMaxLevel(cardDef.rarity);
  if (instance.level < maxLevel) return false;
  // 需要同 familyId 的另一张卡
  return inventory.some(c => c.instanceId !== instance.instanceId && c.cardId === instance.cardId);
}

export function evolve(instance: CardInstance, cardDef: CardDefinition, material: CardInstance): CardInstance {
  const newStage = instance.evolutionStage + 1;
  const statsMultiplier = 1 + newStage * 0.15; // 每阶+15%基础
  const newBaseStats: Stats = {
    attack: Math.floor(cardDef.baseStats.attack * statsMultiplier),
    defense: Math.floor(cardDef.baseStats.defense * statsMultiplier),
    soldiers: Math.floor(cardDef.baseStats.soldiers * statsMultiplier),
    speed: cardDef.baseStats.speed,
    critRate: cardDef.baseStats.critRate + newStage * 0.02,
    critDamage: cardDef.baseStats.critDamage + newStage * 0.05,
    healingPower: Math.floor(cardDef.baseStats.healingPower * statsMultiplier),
    damageReduction: cardDef.baseStats.damageReduction,
    statusAccuracy: cardDef.baseStats.statusAccuracy,
    statusResistance: cardDef.baseStats.statusResistance,
  };

  const maxLevel = getMaxLevel(cardDef.rarity);
  const newDerived = calculateDerivedStats(newBaseStats, 1, maxLevel, instance.enhancement);

  return {
    ...instance,
    evolutionStage: newStage,
    level: 1,
    exp: 0,
    derivedStats: newDerived,
    // 继承材料的部分亲密度
    friendship: Math.min(100, instance.friendship + Math.floor(material.friendship * 0.1)),
  };
}

// === FIFA 式强化 ===

export interface EnhanceResult {
  success: boolean;
  newLevel: number;
  rate: number;
  degraded: boolean;
}

export function enhance(instance: CardInstance, cardDef: CardDefinition, materialEnhanceLevel: number, rng: () => number): EnhanceResult {
  const current = instance.enhancement;
  if (current >= 10) return { success: false, newLevel: current, rate: 0, degraded: false };

  // 基础成功率
  let rate = ENHANCE_RATES[current] || 0.03;

  // +0→+1 必定成功
  if (current === 0) return { success: true, newLevel: 1, rate: 1.0, degraded: false };

  // 材料强化等级加成
  if (materialEnhanceLevel >= current) rate += 0.15;
  else if (materialEnhanceLevel >= current - 1) rate += 0.08;
  else rate += 0.03;

  rate = Math.min(rate, 0.95); // 最高95%

  const roll = rng();
  const success = roll < rate;

  if (success) {
    const newLevel = current + 1;
    const maxLevel = getMaxLevel(cardDef.rarity);
    const newStats = calculateDerivedStats(cardDef.baseStats, instance.level, maxLevel, newLevel);
    return { success: true, newLevel, rate, degraded: false };
  } else {
    // 失败惩罚
    let degraded = false;
    let newLevel = current;
    if (current >= 8) {
      newLevel = Math.max(0, current - 1);
      degraded = true;
    } else if (current >= 5 && rng() < 0.3) {
      newLevel = Math.max(0, current - 1);
      degraded = true;
    }
    // +1~+4 失败不降级
    return { success: false, newLevel, rate, degraded };
  }
}

export function applyEnhance(instance: CardInstance, cardDef: CardDefinition, result: EnhanceResult): CardInstance {
  const maxLevel = getMaxLevel(cardDef.rarity);
  const newStats = calculateDerivedStats(cardDef.baseStats, instance.level, maxLevel, result.newLevel);
  return { ...instance, enhancement: result.newLevel, derivedStats: newStats };
}

// === 技能升级 ===

export function upgradeSkill(instance: CardInstance, skillIndex: number): CardInstance {
  const levels = [...instance.skillLevels];
  if (skillIndex < levels.length && levels[skillIndex] < 10) {
    levels[skillIndex]++;
  }
  return { ...instance, skillLevels: levels };
}
