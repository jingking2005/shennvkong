import { describe, it, expect } from 'vitest';
import {
  getUnlockedStages,
  getStageById,
  buildEnemyTeam,
  getStageDifficultyLabel,
} from '../src/systems/StageManager';
import type { Stage } from '../src/data/schema/types';
import { stages } from '../src/data/stages';

describe('StageManager - stages 数据', () => {
  it('包含 5 个关卡', () => {
    expect(stages).toHaveLength(5);
  });

  it('每个关卡有唯一 id', () => {
    const ids = stages.map(s => s.id);
    expect(new Set(ids).size).toBe(5);
  });

  it('难度递增 1-5', () => {
    const difficulties = stages.map(s => s.difficulty);
    expect(difficulties).toEqual([1, 2, 3, 4, 5]);
  });

  it('每个关卡有 2-5 个敌人', () => {
    for (const stage of stages) {
      expect(stage.enemies.length).toBeGreaterThanOrEqual(2);
      expect(stage.enemies.length).toBeLessThanOrEqual(5);
    }
  });
});

describe('getUnlockedStages', () => {
  it('新玩家只解锁第一关', () => {
    const unlocked = getUnlockedStages(stages, []);
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0].id).toBe('stage-1');
  });

  it('通关第一关后解锁前两关', () => {
    const unlocked = getUnlockedStages(stages, ['stage-1']);
    expect(unlocked).toHaveLength(2);
  });

  it('通关全部后解锁全部', () => {
    const cleared = ['stage-1', 'stage-2', 'stage-3', 'stage-4', 'stage-5'];
    const unlocked = getUnlockedStages(stages, cleared);
    expect(unlocked).toHaveLength(5);
  });

  it('解锁逻辑基于连续通关（跳关无效）', () => {
    // 只通了 stage-2 但没通 stage-1 → 仍只解锁第一关
    const unlocked = getUnlockedStages(stages, ['stage-2']);
    expect(unlocked).toHaveLength(1);
  });
});

describe('getStageById', () => {
  it('返回对应关卡', () => {
    const stage = getStageById(stages, 'stage-3');
    expect(stage?.difficulty).toBe(3);
  });

  it('不存在返回 undefined', () => {
    expect(getStageById(stages, 'nonexistent')).toBeUndefined();
  });
});

describe('buildEnemyTeam', () => {
  it('返回指定数量的敌人卡牌', () => {
    const stage = stages[0];
    const team = buildEnemyTeam(stage, mockCardPool());
    expect(team.length).toBe(stage.enemies.length);
  });

  it('敌人来自卡池', () => {
    const pool = mockCardPool();
    const stage = stages[2];
    const team = buildEnemyTeam(stage, pool);
    for (const entry of team) {
      expect(pool.some(c => c.id === entry.card.id)).toBe(true);
    }
  });
});

describe('getStageDifficultyLabel', () => {
  it('难度 1 返回 简单', () => {
    expect(getStageDifficultyLabel(1)).toBe('简单');
  });

  it('难度 3 返回 普通', () => {
    expect(getStageDifficultyLabel(3)).toBe('普通');
  });

  it('难度 5 返回 地狱', () => {
    expect(getStageDifficultyLabel(5)).toBe('地狱');
  });
});

// === 辅助 ===

function mockCardPool() {
  return [
    makeCard('slime', 'Special', 500, 500),
    makeCard('goblin', 'Passion', 1200, 800),
    makeCard('frost-fairy', 'Cool', 1100, 850),
    makeCard('ice-queen', 'Cool', 1300, 750),
    makeCard('dark-mage', 'Dark', 900, 900),
    makeCard('vampire-carmilla', 'Dark', 1500, 1000),
    makeCard('demon-lucifer', 'Dark', 1800, 1200),
    makeCard('priestess-light', 'Light', 800, 1000),
    makeCard('angel-raphael', 'Light', 1400, 1100),
    makeCard('goddess-athena', 'Light', 2000, 1500),
    makeCard('knight-nova', 'Passion', 1000, 900),
    makeCard('valkyrie-brynhildr', 'Passion', 1600, 1100),
  ];
}

function makeCard(id: string, element: any, atk: number, def: number) {
  return {
    id,
    slug: id,
    names: { en: `Card ${id}` },
    rarity: 'R' as const,
    element,
    cost: 10,
    baseStats: { atk, def, hp: atk * 3, speed: 60 },
    skillIds: [],
    forms: [],
    tags: [],
    dataVersion: 1,
  };
}
