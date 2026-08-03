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
import { evolveRate, evolveBoostRate, evolveFailureStar, prepareEvolve, applyEvolve, ownedToCombatant, MAX_STAR, STAR_STAT_MULT, EVOLVE_FAIL_BONUS } from './logic';

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

describe('evolveBoostRate', () => {
  it('稀有度差 0:+10 / +1:15 / +2:30 / +3:60 / ≥+4:100；低于主卡不加成', () => {
    expect(evolveBoostRate('UR', 'UR')).toBe(10);      // 同稀有度
    expect(evolveBoostRate('UR', 'LR')).toBe(15);      // +1 级
    expect(evolveBoostRate('R', 'UR')).toBe(30);       // +2 级
    expect(evolveBoostRate('N', 'SR')).toBe(30);       // +2 级（N→SR）
    expect(evolveBoostRate('N', 'UR')).toBe(60);       // +3 级
    expect(evolveBoostRate('N', 'VR')).toBe(100);      // ≥+4 级
    expect(evolveBoostRate('SR', 'R')).toBe(0);        // 低于主卡
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

  it('加成卡提升成功率：rate=base+boost，0 级 +10 / 1级 +15 / 2级 +30 / 3级 +60 / ≥4级 +100', () => {
    const db = freshDB();
    const a = addCard(db, 'UR', 0);
    const b = addCard(db, 'UR', 0);         // 同名素材
    const bo = addCard(db, 'LR', 0);       // 加成卡 UR→LR +1级 → +15
    const prep = prepareEvolve(db, a, [b], () => 0, 0.08, [bo]);
    expect(prep.ok).toBe(true);
    expect(prep.rate).toBe(100);           // 90 + 15 > 100 封顶
    expect(prep.boost).toBe(15);
  });

  it('低级加成卡不加成（boost=0，rate 不变，结果仍算成功/失败正常）', () => {
    const db = freshDB();
    const a = addCard(db, 'UR', 2);
    const b = addCard(db, 'UR', 1);
    const n = addCard(db, 'N', 0);         // 低于主卡
    const prep = prepareEvolve(db, a, [b], () => 0, 0.08, [n]);
    expect(prep.ok).toBe(true);
    expect(prep.boost).toBe(0);
    expect(prep.rate).toBe(evolveRate(2, 1));     // 混星 (10-3)*10-10=60? 实际由 evolveRate 决定
  });

  it('加成卡校验：重复选择 / 与素材重复 / 与主卡重复 → 拒绝', () => {
    const db = freshDB();
    const a = addCard(db, 'UR', 0);
    const b = addCard(db, 'UR', 0, 1);
    const bo = addCard(db, 'UR', 0, 2);
    expect(prepareEvolve(db, a, [b], () => 0, 0.08, [bo, bo]).ok).toBe(false);    // 同一张重复
    expect(prepareEvolve(db, a, [b], () => 0, 0.08, [b]).ok).toBe(false);         // 与素材重复
    expect(prepareEvolve(db, a, [b], () => 0, 0.08, [a]).ok).toBe(false);         // 与主卡重复
  });

  it('applyEvolve 消耗加成卡（无论成功失败）', () => {
    const db = freshDB();
    const a = addCard(db, 'UR', 0);
    const b = addCard(db, 'UR', 0);         // 同名素材
    const bo = addCard(db, 'LR', 0);
    const prep = prepareEvolve(db, a, [b], () => 0, 0.08, [bo]);  // 成功
    expect(prep.ok).toBe(true);
    applyEvolve(db, a, [b], prep, [bo]);
    expect(db.inventory.cards.find(o => o.instId === bo)).toBeUndefined();  // 加成卡已消耗

    const db2 = freshDB();
    const c = addCard(db2, 'UR', 0);
    const d = addCard(db2, 'UR', 0);        // 同名素材
    const bo2 = addCard(db2, 'LR', 0);
    const prep2 = prepareEvolve(db2, c, [d], () => 1.1, 0.08, [bo2]);  // 必失败（1.1*100 > 100）
    expect(prep2.ok).toBe(true);
    expect(prep2.success).toBe(false);
    applyEvolve(db2, c, [d], prep2, [bo2]);
    expect(db2.inventory.cards.find(o => o.instId === bo2)).toBeUndefined(); // 失败也消耗
  });
});

describe('失败补偿 + 降星保底', () => {
  it('失败补偿：同一主卡每失败 +30%，上限 +90%（3 次封顶），成功清零', () => {
    const db = freshDB();
    const a = addCard(db, 'UR', 0);
    let b = addCard(db, 'UR', 0);
    // 初始无补偿
    expect(prepareEvolve(db, a, [b], () => 1.1, 0.08).bonus).toBe(0);
    // 失败 1 次 → 下次 +30%（失败损毁素材，重新补一张）
    const f1 = prepareEvolve(db, a, [b], () => 1.1);
    applyEvolve(db, a, [b], f1);
    expect(db.inventory.cards.find(o => o.instId === a)?.evoFailStacks).toBe(1);
    b = addCard(db, 'UR', 0);
    expect(prepareEvolve(db, a, [b], () => 1.1).bonus).toBe(30);
    // 失败到第 3 次 → +90%（封顶）
    for (let i = 0; i < 3; i++) {
      b = addCard(db, 'UR', 0);
      const f = prepareEvolve(db, a, [b], () => 1.1);
      applyEvolve(db, a, [b], f);
    }
    expect(db.inventory.cards.find(o => o.instId === a)?.evoFailStacks).toBe(4);
    b = addCard(db, 'UR', 0);
    expect(prepareEvolve(db, a, [b], () => 1.1).bonus).toBe(90);
    // 成功清零
    b = addCard(db, 'UR', 0);
    const ok = prepareEvolve(db, a, [b], () => 0);
    applyEvolve(db, a, [b], ok);
    expect(db.inventory.cards.find(o => o.instId === a)?.evoFailStacks).toBe(0);
  });

  it('降星保底：≥7 不降（保持原星），5/6 只降到 5，<5 正常降 1（0 不降）', () => {
    expect(evolveFailureStar(0)).toBe(0);
    expect(evolveFailureStar(3)).toBe(2);
    expect(evolveFailureStar(4)).toBe(3);
    expect(evolveFailureStar(5)).toBe(5);
    expect(evolveFailureStar(6)).toBe(5);
    expect(evolveFailureStar(7)).toBe(7);
    expect(evolveFailureStar(9)).toBe(9);
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
