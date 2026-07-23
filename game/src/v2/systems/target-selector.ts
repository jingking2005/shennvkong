/**
 * TargetSelector — 声明式目标筛选
 * 参考 Fireplace 的声明式目标选择器
 */

import type { BattleUnit, TargetType, Side } from '../data/types';
import { StatusEngine } from './status-engine';

export class TargetSelector {
  /**
   * 根据目标类型选择目标单位
   * @param targetType 目标类型
   * @param actor 行动者
   * @param allUnits 所有存活单位
   * @param rng 随机函数（用于 RANDOM_ENEMIES）
   * @param count 随机目标数量（默认1）
   */
  static select(
    targetType: TargetType,
    actor: BattleUnit,
    allUnits: BattleUnit[],
    rng: () => number = Math.random,
    count = 1,
  ): BattleUnit[] {
    const allies = allUnits.filter(u => u.isAlive && u.side === actor.side && u.uid !== actor.uid);
    const enemies = allUnits.filter(u => u.isAlive && u.side !== actor.side);

    // 嘲讽优先：如果敌方有嘲讽单位，单体攻击必须打嘲讽
    const tauntEnemies = enemies.filter(u => StatusEngine.hasTaunt(u));

    switch (targetType) {
      case 'SELF':
        return [actor];

      case 'SINGLE_ALLY':
        return allies.length > 0 ? [allies[Math.floor(rng() * allies.length)]] : [];

      case 'LOWEST_HP_ALLY': {
        if (allies.length === 0) return [actor]; // 没有队友就治自己
        const sorted = [...allies, actor].sort((a, b) =>
          (a.currentSoldiers / a.maxSoldiers) - (b.currentSoldiers / b.maxSoldiers)
        );
        return [sorted[0]];
      }

      case 'ALL_ALLIES':
        return [actor, ...allies];

      case 'SAME_ELEMENT_ALLIES':
        return [actor, ...allies].filter(u => u.cardDef.element === actor.cardDef.element);

      case 'SINGLE_ENEMY': {
        if (enemies.length === 0) return [];
        // 嘲讽优先
        if (tauntEnemies.length > 0) {
          return [tauntEnemies[Math.floor(rng() * tauntEnemies.length)]];
        }
        // 默认打前排
        const frontRow = this.getFrontRow(enemies);
        const pool = frontRow.length > 0 ? frontRow : enemies;
        return [pool[Math.floor(rng() * pool.length)]];
      }

      case 'HIGHEST_ATK_ENEMY': {
        if (enemies.length === 0) return [];
        const sorted = [...enemies].sort((a, b) => b.currentStats.attack - a.currentStats.attack);
        return [sorted[0]];
      }

      case 'LOWEST_HP_ENEMY': {
        if (enemies.length === 0) return [];
        const sorted = [...enemies].sort((a, b) =>
          (a.currentSoldiers / a.maxSoldiers) - (b.currentSoldiers / b.maxSoldiers)
        );
        return [sorted[0]];
      }

      case 'FRONT_ROW':
        return this.getFrontRow(enemies);

      case 'BACK_ROW':
        return this.getBackRow(enemies);

      case 'ALL_ENEMIES':
        return enemies;

      case 'RANDOM_ENEMIES': {
        if (enemies.length === 0) return [];
        const shuffled = [...enemies].sort(() => rng() - 0.5);
        return shuffled.slice(0, Math.min(count, shuffled.length));
      }

      default:
        return [];
    }
  }

  /** 获取前排单位 */
  private static getFrontRow(units: BattleUnit[]): BattleUnit[] {
    const front = units.filter(u =>
      u.position === 'FRONT_LEFT' || u.position === 'FRONT_RIGHT'
    );
    // 如果前排全灭，返回中排
    if (front.length === 0) {
      const mid = units.filter(u =>
        u.position === 'MID_LEFT' || u.position === 'MID_RIGHT'
      );
      return mid.length > 0 ? mid : units; // 中排也全灭则返回所有
    }
    return front;
  }

  /** 获取后排单位 */
  private static getBackRow(units: BattleUnit[]): BattleUnit[] {
    return units.filter(u => u.position === 'BACK_CENTER');
  }
}
