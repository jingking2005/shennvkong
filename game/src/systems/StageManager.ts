/**
 * StageManager — 关卡管理（纯逻辑，无 Phaser 依赖）
 *
 * 职责：
 * 1. 关卡解锁判定（连续通关制）
 * 2. 根据关卡配置构建敌方队伍
 * 3. 难度标签
 */

import type { Card, Stage } from '../data/schema/types';
import { getSkillById } from '../data/skills';

// === 关卡解锁 ===

/**
 * 获取已解锁的关卡列表
 * 规则：必须按顺序连续通关，跳关无效
 */
export function getUnlockedStages(allStages: Stage[], clearedIds: string[]): Stage[] {
  const unlocked: Stage[] = [];

  for (const stage of allStages) {
    // 第一关始终解锁
    if (unlocked.length === 0) {
      unlocked.push(stage);
      continue;
    }

    // 前一关必须已通关
    const prevStage = allStages[unlocked.length - 1];
    if (clearedIds.includes(prevStage.id)) {
      unlocked.push(stage);
    } else {
      break;
    }
  }

  return unlocked;
}

// === 关卡查询 ===

export function getStageById(allStages: Stage[], id: string): Stage | undefined {
  return allStages.find(s => s.id === id);
}

// === 敌方队伍构建 ===

export interface EnemyEntry {
  card: Card;
  skill: ReturnType<typeof getSkillById>;
}

/**
 * 根据关卡配置从卡池中取出敌方队伍
 * 如果卡池中找不到对应 cardId，则跳过
 */
export function buildEnemyTeam(stage: Stage, cardPool: Card[]): EnemyEntry[] {
  const team: EnemyEntry[] = [];

  for (const enemy of stage.enemies) {
    const card = cardPool.find(c => c.id === enemy.cardId);
    if (card) {
      team.push({
        card,
        skill: getSkillById(card.skillIds[0] || ''),
      });
    }
  }

  return team;
}

// === 难度标签 ===

const DIFFICULTY_LABELS: Record<number, string> = {
  1: '简单',
  2: '普通',
  3: '普通',
  4: '困难',
  5: '地狱',
};

export function getStageDifficultyLabel(difficulty: number): string {
  return DIFFICULTY_LABELS[difficulty] || '未知';
}
