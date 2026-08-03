/**
 * 升星合成规则测试（原创规则，非原版数值）：
 * - 同名×1（星级差≤1）：rate=(10-(max+1))*10，混星-10，保底5%
 * - 同稀有度×2：rate=同星基准，结果=主星+1
 * - 成功：主卡加星+继承，素材消耗；失败：素材损毁，主卡降 1 星（0 星不降）
 * - 每星全属性 ×1.2 复利（ownedToCombatant）
 */
import { describe, expect, it } from 'vitest';
import { seedDB, makeOwnedCard, type DB } from './db';
import { cardsByRarity } from './data';
import { evolveRate, prepareEvolve, applyEvolve, ownedToCombatant, MAX_STAR, STAR_STAT_MULT } from './logic';

function freshDB(): DB {
  return seedDB((r, n) => cardsByRarity(r).slice(0, n));
}

/** 往库存注入一张指定卡/星级 */
function addCard(db: DB, rarity: string, evoStage: number, cardIdx = 0): string {
  const card = cardsByRarity(rarity as never)[cardIdx];
  const o = makeOwnedCard(card.id, 1);
  o.evoStage = evoStage;
  db.inventory.cards.push(o);
  return o.instId;
}

describe('evolveRate', () => {
  it('同星基准：(10-结果星)*10%', () => {
    expect(evolveRate(0, 0)).toBe(90);
    expect(evolveRate(1, 1)).toBe(80);
    expect(evolveRate(8, 8)).toBe(10);
    expect(evolveRate(9, 9)).toBe(5); // 保底 5%
  });
  it('混星 -10%，星级差>1 不可合', () => {
    expect(evolveRate(1, 0)).toBe(70);
    expect(evolveRate(0, 2)).toBeNull();
    expect(evolveRate(2, 0)).toBeNull();
  });
});

describe('prepareEvolve + applyEvolve', () => {
  it('同名×1 成功：主卡 +1 星、素材消失、主卡保留', () => {
    const db = freshDB();
    const a = addCard(db, 'UR', 0);
    const b = addCard(db, 'UR', 0);
    const prep = prepareEvolve(db, a, [b], () => 0); // 必成功
    expect(prep.ok).toBe(true);
    expect(prep.rate).toBe(90);
    expect(prep.newEvoStage).toBe(1);
    applyEvolve(db, a, [b], prep);
    const target = db.inventory.cards.find(o => o.instId === a);
    expect(target?.evoStage).toBe(1);
    expect(db.inventory.cards.find(o => o.instId === b)).toBeUndefined();
  });

  it('同名×1 失败：素材损毁，主卡降 1 星保留（0 星不降）', () => {
    const db = freshDB();
    const a = addCard(db, 'UR', 2);
    const b = addCard(db, 'UR', 1);
    const prep = prepareEvolve(db, a, [b], () => 0.9999); // 必失败
    expect(prep.ok).toBe(true);
    expect(prep.success).toBe(false);
    applyEvolve(db, a, [b], prep);
    expect(db.inventory.cards.find(o => o.instId === a)?.evoStage).toBe(1);
    expect(db.inventory.cards.find(o => o.instId === b)).toBeUndefined();

    // 0 星主卡失败不降为负
    const db2 = freshDB();
    const c = addCard(db2, 'UR', 0);
    const d = addCard(db2, 'UR', 0);
    const prep2 = prepareEvolve(db2, c, [d], () => 0.9999);
    applyEvolve(db2, c, [d], prep2);
    expect(db2.inventory.cards.find(o => o.instId === c)?.evoStage).toBe(0);
  });

  it('同稀有度×2 成功：无需同名，主卡 +1 星、两张素材消耗', () => {
    const db = freshDB();
    const a = addCard(db, 'LR', 2, 0);
    const m1 = addCard(db, 'LR', 0, 1);
    const m2 = addCard(db, 'LR', 5, 0); // 同卡不同星也允许
    const prep = prepareEvolve(db, a, [m1, m2], () => 0);
    expect(prep.ok).toBe(true);
    expect(prep.rate).toBe(70); // 同星基准：(10-3)*10
    expect(prep.newEvoStage).toBe(3);
    applyEvolve(db, a, [m1, m2], prep);
    expect(db.inventory.cards.find(o => o.instId === a)?.evoStage).toBe(3);
    expect(db.inventory.cards.find(o => o.instId === m1)).toBeUndefined();
    expect(db.inventory.cards.find(o => o.instId === m2)).toBeUndefined();
  });

  it('同稀有度×2 拒绝：稀有度不一致 / 素材重复 / 单张非同名', () => {
    const db = freshDB();
    const a = addCard(db, 'UR', 0);
    const ur = addCard(db, 'UR', 0, 1);
    const sr = addCard(db, 'SR', 0);
    expect(prepareEvolve(db, a, [ur, sr]).ok).toBe(false);
    expect(prepareEvolve(db, a, [ur, ur]).ok).toBe(false);
    expect(prepareEvolve(db, a, [ur]).ok).toBe(false); // 单素材必须同名
  });

  it('满星拒绝合成', () => {
    const db = freshDB();
    const a = addCard(db, 'UR', MAX_STAR);
    const b = addCard(db, 'UR', 0);
    const prep = prepareEvolve(db, a, [b]);
    expect(prep.ok).toBe(false);
  });
});

describe('星级属性倍率（每星 ×1.2 复利）', () => {
  it('n 星 = 基础 × 1.2^n（攻击/体力/速度）', () => {
    const db = freshDB();
    const s0 = addCard(db, 'UR', 0);
    const s1 = addCard(db, 'UR', 1);
    const s2 = addCard(db, 'UR', 2);
    const c0 = ownedToCombatant(db.inventory.cards.find(o => o.instId === s0)!)!;
    const c1 = ownedToCombatant(db.inventory.cards.find(o => o.instId === s1)!)!;
    const c2 = ownedToCombatant(db.inventory.cards.find(o => o.instId === s2)!)!;
    expect(c1.atk).toBe(Math.floor(c0.atk * STAR_STAT_MULT));
    expect(c1.hpMax).toBe(Math.floor(c0.hpMax * STAR_STAT_MULT));
    expect(c1.speed).toBe(Math.floor(c0.speed * STAR_STAT_MULT));
    expect(c2.atk).toBe(Math.floor(c0.atk * STAR_STAT_MULT * STAR_STAT_MULT));
  });
});
