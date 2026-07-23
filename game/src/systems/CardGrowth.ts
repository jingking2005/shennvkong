/**
 * CardGrowth — 卡牌养成引擎（纯逻辑，无 Phaser 依赖）
 *
 * 实现原版神女控核心养成循环：强化 / 进化 / 合体
 */

import type { CardInstance, Rarity, Stats } from '../data/schema/types';

// === 经验曲线 ===

/** 从 level 升到 level+1 所需经验 */
export function getExpForLevel(level: number): number {
  if (level <= 0) return 0;
  // 曲线: 100 * level^1.3
  return Math.floor(100 * Math.pow(level, 1.3));
}

// === 满级上限 ===

const MAX_LEVELS: Record<string, number> = {
  N: 20, R: 30, SR: 40, UR: 50, LR: 60,
};

/** 获取稀有度对应的满级上限（H 前缀与基础相同） */
export function getMaxLevel(rarity: Rarity): number {
  if (MAX_LEVELS[rarity]) return MAX_LEVELS[rarity];
  // H 前缀变体
  if (rarity.startsWith('H')) {
    const base = rarity.slice(1);
    if (MAX_LEVELS[base]) return MAX_LEVELS[base];
  }
  return 30; // 默认
}

// === 属性成长 ===

/**
 * 根据等级计算当前属性
 * 线性成长：满级时属性 = 基础 × 2
 * 速度不成长
 */
export function calculateStatGrowth(baseStats: Stats, level: number, maxLevel: number): Stats {
  if (maxLevel <= 1) return { ...baseStats };
  const growthFactor = 1 + (level - 1) / (maxLevel - 1); // 1.0 → 2.0
  return {
    atk: Math.floor(baseStats.atk * growthFactor),
    def: Math.floor(baseStats.def * growthFactor),
    hp: Math.floor(baseStats.hp * growthFactor),
    speed: baseStats.speed, // 速度固定
  };
}

// === 强化（吞噬素材获得经验） ===

/** 素材卡提供的经验值 */
function getMaterialExp(material: CardInstance): number {
  const rarityBonus: Record<string, number> = {
    N: 50, HN: 80, R: 150, HR: 250, SR: 500, HSR: 800, UR: 1500, HUR: 2500, LR: 5000, HLR: 8000,
  };
  const base = rarityBonus[material.rarity] || 50;
  // 等级加成：素材等级越高经验越多
  return Math.floor(base * (1 + material.level * 0.1));
}

/**
 * 强化：目标卡吞噬素材卡获得经验，可能升级
 * 返回新的目标卡状态（不修改原对象）
 */
export function enhanceCard(target: CardInstance, materials: CardInstance[]): CardInstance {
  if (materials.length === 0) return { ...target };

  const maxLevel = getMaxLevel(target.rarity);
  let totalExp = target.exp + materials.reduce((sum, m) => sum + getMaterialExp(m), 0);
  let level = target.level;

  // 消耗经验升级
  while (level < maxLevel) {
    const needed = getExpForLevel(level);
    if (totalExp >= needed) {
      totalExp -= needed;
      level++;
    } else {
      break;
    }
  }

  // 满级时清空溢出经验
  if (level >= maxLevel) {
    totalExp = 0;
  }

  // 计算新属性（需要知道基础属性 — 这里用 level 1 时的属性反推）
  // 简化：直接用当前 stats 按等级比例成长
  const baseStats: Stats = {
    atk: Math.floor(target.stats.atk / (1 + (target.level - 1) / Math.max(getMaxLevel(target.rarity) - 1, 1))),
    def: Math.floor(target.stats.def / (1 + (target.level - 1) / Math.max(getMaxLevel(target.rarity) - 1, 1))),
    hp: Math.floor(target.stats.hp / (1 + (target.level - 1) / Math.max(getMaxLevel(target.rarity) - 1, 1))),
    speed: target.stats.speed,
  };

  return {
    ...target,
    level,
    exp: totalExp,
    stats: calculateStatGrowth(baseStats, level, maxLevel),
  };
}

// === 进化 ===

/** 稀有度升阶映射 */
const EVOLUTION_MAP: Partial<Record<Rarity, Rarity>> = {
  N: 'HN', HN: 'R', R: 'HR', HR: 'SR', SR: 'HSR', HSR: 'UR', UR: 'HUR', HUR: 'LR',
};

/**
 * 判断是否可以进化
 * 条件：满级 + 背包中有同 cardId 同稀有度的另一张卡
 */
export function canEvolve(card: CardInstance, inventory: CardInstance[]): boolean {
  const maxLevel = getMaxLevel(card.rarity);
  if (card.level < maxLevel) return false;
  if (!EVOLUTION_MAP[card.rarity]) return false; // LR 无法再进化

  // 查找同名同稀有度的另一张卡
  const material = inventory.find(
    c => c.instanceId !== card.instanceId
      && c.cardId === card.cardId
      && c.rarity === card.rarity
  );
  return !!material;
}

/**
 * 进化：两张满级同名卡 → 升阶
 * 新卡等级重置为 1，基础属性提升 30%
 */
export function evolveCard(card1: CardInstance, card2: CardInstance): CardInstance {
  const newRarity = EVOLUTION_MAP[card1.rarity] || card1.rarity;
  const newMaxLevel = getMaxLevel(newRarity);

  // 基础属性提升 30%
  const newBaseStats: Stats = {
    atk: Math.floor(card1.stats.atk * 1.3),
    def: Math.floor(card1.stats.def * 1.3),
    hp: Math.floor(card1.stats.hp * 1.3),
    speed: card1.stats.speed,
  };

  return {
    instanceId: card1.instanceId,
    cardId: card1.cardId,
    level: 1,
    exp: 0,
    rarity: newRarity,
    stats: calculateStatGrowth(newBaseStats, 1, newMaxLevel),
    skillLevel: Math.max(card1.skillLevel, card2.skillLevel),
    affection: Math.max(card1.affection, card2.affection),
  };
}

// === 合体（多卡融合，继承属性） ===

const FUSE_INHERIT_RATE = 0.1; // 继承 10%

/**
 * 合体：目标卡吸收素材卡的 10% 属性（速度不继承）
 */
export function fuseCards(target: CardInstance, materials: CardInstance[]): CardInstance {
  if (materials.length === 0) return { ...target };

  let bonusAtk = 0;
  let bonusDef = 0;
  let bonusHp = 0;

  for (const mat of materials) {
    bonusAtk += Math.floor(mat.stats.atk * FUSE_INHERIT_RATE);
    bonusDef += Math.floor(mat.stats.def * FUSE_INHERIT_RATE);
    bonusHp += Math.floor(mat.stats.hp * FUSE_INHERIT_RATE);
  }

  return {
    ...target,
    stats: {
      atk: target.stats.atk + bonusAtk,
      def: target.stats.def + bonusDef,
      hp: target.stats.hp + bonusHp,
      speed: target.stats.speed, // 速度不继承
    },
  };
}
