/**
 * 状态引擎：行动顺序、存活判定、死亡检查。
 * 当前无 buff/debuff 系统，本模块只管回合生命周期。
 */

export interface HasHpSpeed {
  hp: number;
  speed: number;
}

/** 双方存活单位按速度降序排列（玩家在前，同速稳定） */
export function orderBySpeed<T extends HasHpSpeed>(
  team: T[],
  enemies: T[],
): Array<{ unit: T; side: 'player' | 'enemy' }> {
  return [
    ...team.filter(c => c.hp > 0).map(c => ({ unit: c, side: 'player' as const })),
    ...enemies.filter(c => c.hp > 0).map(c => ({ unit: c, side: 'enemy' as const })),
  ].sort((x, y) => y.unit.speed - x.unit.speed);
}

export function aliveCount<T extends HasHpSpeed>(units: T[]): number {
  return units.filter(c => c.hp > 0).length;
}

/** 死亡检查：一方全灭即终局 */
export function deathCheck<T extends HasHpSpeed>(
  team: T[],
  enemies: T[],
): { finished: boolean; playerWon: boolean } {
  const p = aliveCount(team), e = aliveCount(enemies);
  return { finished: p === 0 || e === 0, playerWon: e === 0 && p > 0 };
}
