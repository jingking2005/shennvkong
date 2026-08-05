/**
 * 进军（探索）测试：
 * - 固定步数：每关 totalSteps 决定步数，每步推进 100%/N（早期 5 步→后期 10 步）
 * - 通关步（100%）必遇魔女
 * - 途中随机事件：金币/物品/宝箱/魔女
 * - 前期减弱：spawnWitch 按关卡 targetRounds 定强度（早期回合数少→弱）
 */
import { describe, expect, it } from 'vitest';
import { seedDB, type DB } from './db';
import { cardsByRarity } from './data';
import { ExploreStage, spawnWitch, estimateTeamDPT } from './logic';

function freshDB(): DB {
  return seedDB((r, n) => cardsByRarity(r).slice(0, n));
}

describe('ExploreStage 固定步数', () => {
  it('关卡 1 为 5 步：每步固定推进 20%', () => {
    const db = freshDB();
    const stage = db.stages[0];
    expect(stage.totalSteps).toBe(5);
    const r = ExploreStage(db, stage, 12345);
    expect(r.ok).toBe(true);
    expect(r.progressGain).toBeCloseTo(0.2, 5);
    expect(r.newProgress).toBeCloseTo(0.2, 5);
  });

  it('走满 totalSteps 步正好到 100%', () => {
    const db = freshDB();
    const stage = db.stages[0];
    const n = stage.totalSteps;
    let last = null;
    for (let i = 0; i < n; i++) last = ExploreStage(db, stage, 1000 + i);
    expect(last!.newProgress).toBeCloseTo(1, 5);
    expect(last!.completed).toBe(true);
  });

  it('关卡步数由早到晚递增（5 步起步，最高 10 步）', () => {
    const db = freshDB();
    const steps = db.stages.map(s => s.totalSteps);
    expect(steps[0]).toBe(5);
    expect(steps[steps.length - 1]).toBe(10);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]);
  });

  it('通关那一步必遇魔女', () => {
    for (let seedBase = 0; seedBase < 8; seedBase++) {
      const db = freshDB();
      const stage = db.stages[0];
      let last = null;
      for (let i = 0; i < stage.totalSteps; i++) last = ExploreStage(db, stage, seedBase * 97 + i);
      expect(last!.event).toBe('witch');
      expect(last!.witchRaidId).toBeTruthy();
    }
  });

  it('途中事件只会是 loot/mob/chest/witch 之一', () => {
    const db = freshDB();
    const stage = db.stages[0];
    for (let i = 0; i < stage.totalSteps - 1; i++) {
      const r = ExploreStage(db, stage, 777 + i * 31);
      expect(['loot', 'mob', 'chest', 'witch']).toContain(r.event);
    }
  });

  it('宝箱事件会出现且发放奖励（多 seed 扫描）', () => {
    let chestSeen = false;
    for (let seed = 1; seed <= 200 && !chestSeen; seed++) {
      const db = freshDB();
      const stage = db.stages[0];
      for (let i = 0; i < stage.totalSteps - 1; i++) {
        const goldBefore = db.user.gold;
        const r = ExploreStage(db, stage, seed * 1000 + i);
        if (r.event === 'chest') {
          chestSeen = true;
          expect(r.lootGold).toBeGreaterThan(0);
          expect(db.user.gold).toBe(goldBefore + r.lootGold);
          break;
        }
      }
    }
    expect(chestSeen).toBe(true);
  });
});

describe('spawnWitch 前期减弱（按关卡目标回合数）', () => {
  it('早期关卡魔女 HP 低于后期关卡（同为普通魔女）', () => {
    const db = freshDB();
    const early = db.stages[0];
    const late = db.stages[db.stages.length - 1];
    const rng = () => 0.5; // 固定随机消除波动
    const rid1 = spawnWitch(db, early, rng, '', false);
    const rid2 = spawnWitch(db, late, rng, '', false);
    const w1 = db.raids.find(r => r.raidId === rid1)!;
    const w2 = db.raids.find(r => r.raidId === rid2)!;
    expect(w1.hpMax).toBeLessThan(w2.hpMax);
  });

  it('早期关卡魔女按 targetRounds 回合可被击败（HP ≈ 队伍 DPT × 回合数）', () => {
    const db = freshDB();
    const stage = db.stages[0];
    const dpt = estimateTeamDPT(db);
    const rng = () => 0.5;
    const rid = spawnWitch(db, stage, rng, '', false);
    const w = db.raids.find(r => r.raidId === rid)!;
    // HP 上界不超过 dpt × targetRounds × 1.1（1.0 是 rng=0.5 时的波动系数上限附近）
    expect(w.hpMax).toBeLessThanOrEqual(dpt * stage.targetRounds * 1.11);
  });
});
