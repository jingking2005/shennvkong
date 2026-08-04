/**
 * 合成规则测试：
 * - 官方形态卡：UR→HUR→GUR→XUR 形态合卡（同形态素材，formEvolveRate 概率，失败不掉档）
 * - 无官方数据卡（SPECIAL/X 装备）：旧星级体系（保留）
 * - 纯函数：evolveRate / evolveBoostRate / evolveFailureStar
 */
import { describe, expect, it } from 'vitest';
import { seedDB, makeOwnedCard, type DB } from './db';
import { cardsByRarity, ALL_CARDS } from './data';
import {
  evolveRate, evolveBoostRate, evolveFailureStar, prepareEvolve, applyEvolve,
  ownedToCombatant, MAX_STAR, formName, formEvolveRate, FORM_STAR_GLYPH,
} from './logic';

function freshDB(): DB {
  return seedDB((r, n) => cardsByRarity(r).slice(0, n));
}

/** 往库存注入一张指定卡/形态档 */
function addCard(db: DB, rarity: string, evoStage: number, cardIdx = 0): string {
  const card = cardsByRarity(rarity as never)[cardIdx];
  const o = makeOwnedCard(card.id, 1);
  o.evoStage = evoStage;
  db.inventory.cards.push(o);
  return o.instId;
}

/** 找一张官方形态含指定档的卡 */
function cardWithForm(rarity: string, form: string) {
  return cardsByRarity(rarity as never).find(c => c.officialForms?.[form]);
}

describe('evolveRate（旧体系纯函数）', () => {
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

describe('evolveBoostRate（加成卡）', () => {
  it('稀有度差 0:+10 / +1:15 / +2:30 / +3:60 / ≥+4:100；低于主卡不加成', () => {
    expect(evolveBoostRate('UR', 'UR')).toBe(10);
    expect(evolveBoostRate('UR', 'LR')).toBe(15);
    expect(evolveBoostRate('R', 'UR')).toBe(30);
    expect(evolveBoostRate('N', 'SR')).toBe(30);
    expect(evolveBoostRate('N', 'UR')).toBe(60);
    expect(evolveBoostRate('N', 'VR')).toBe(100);
    expect(evolveBoostRate('SR', 'R')).toBe(0);
  });
});

describe('formName / formEvolveRate / FORM_STAR_GLYPH', () => {
  it('形态名按稀有度映射', () => {
    expect(formName('UR', 0)).toBe('UR');
    expect(formName('UR', 1)).toBe('HUR');
    expect(formName('UR', 2)).toBe('GUR');
    expect(formName('UR', 3)).toBe('XUR');
    expect(formName('SR', 1)).toBe('HSR');
    expect(formName('SR', 2)).toBe('GSR');
    expect(formName('LR', 2)).toBe('GLR');
    expect(formName('N', 1)).toBe('HN');
  });
  it('形态成功率：→H★70% / →G★50% / →X★30%', () => {
    expect(formEvolveRate(1)).toBe(70);
    expect(formEvolveRate(2)).toBe(50);
    expect(formEvolveRate(3)).toBe(30);
  });
  it('形态星级视觉：HUR=5 / GUR=7 / XUR=10', () => {
    expect(FORM_STAR_GLYPH.UR).toBe(0);
    expect(FORM_STAR_GLYPH.HUR).toBe(5);
    expect(FORM_STAR_GLYPH.GUR).toBe(7);
    expect(FORM_STAR_GLYPH.XUR).toBe(10);
  });
});

describe('官方形态合卡（prepareEvolve + applyEvolve）', () => {
  it('同名 UR ×1 → HUR（0星主+同名素材：50+25+15=90%），素材消失', () => {
    const db = freshDB();
    const a = addCard(db, 'UR', 0);
    const b = addCard(db, 'UR', 0, 0); // 同名（cardsByRarity 同一张卡）
    const prep = prepareEvolve(db, a, [b], () => 0); // 必成功
    expect(prep.ok).toBe(true);
    expect(prep.rate).toBe(90);
    expect(prep.newEvoStage).toBe(1);
    applyEvolve(db, a, [b], prep);
    expect(db.inventory.cards.find(o => o.instId === a)?.evoStage).toBe(1);
    expect(db.inventory.cards.find(o => o.instId === b)).toBeUndefined();
  });

  it('素材放宽：同稀有度任意星级可合（双素材），低星按比例降成功率', () => {
    const db = freshDB();
    const a = addCard(db, 'UR', 1, 0); // HUR 主卡
    const m1 = addCard(db, 'UR', 0, 1); // 另一张 UR 的 0 星素材（低一档）
    const m2 = addCard(db, 'UR', 0, 2); // 又一张 UR 的 0 星素材
    const prep = prepareEvolve(db, a, [m1, m2], () => 0);
    expect(prep.ok).toBe(true);
    // 1星主 + 2×0星素材：50 + 0 + 0 = 50%（低星素材概率低）
    expect(prep.rate).toBe(50);
    expect(prep.newEvoStage).toBe(2);
  });

  it('同稀有度 ×2 → 下一形态：同星素材 = 100% 必成', () => {
    const db = freshDB();
    const a = addCard(db, 'UR', 1); // HUR
    const m1 = addCard(db, 'UR', 1, 1); // 另一张 UR 的 HUR
    const m2 = addCard(db, 'UR', 1, 2);
    const prep = prepareEvolve(db, a, [m1, m2], () => 0);
    expect(prep.ok).toBe(true);
    expect(prep.rate).toBe(100); // 50 + 25×2（同星素材）
    expect(prep.newEvoStage).toBe(2);
    applyEvolve(db, a, [m1, m2], prep);
    expect(db.inventory.cards.find(o => o.instId === a)?.evoStage).toBe(2);
  });

  it('官方卡失败：素材损毁，主卡保持当前形态（不掉档）', () => {
    const db = freshDB();
    const card = cardWithForm('UR', 'XUR');
    if (!card) throw new Error('需要一张有 XUR 的 UR 卡');
    const a = makeOwnedCard(card.id, 1); a.evoStage = 2; db.inventory.cards.push(a); // GUR
    const b = makeOwnedCard(card.id, 1); b.evoStage = 2; db.inventory.cards.push(b); // 同名 GUR
    const prep = prepareEvolve(db, a.instId, [b.instId], () => 1.1); // 必失败
    expect(prep.ok).toBe(true);
    expect(prep.success).toBe(false);
    applyEvolve(db, a.instId, [b.instId], prep);
    expect(db.inventory.cards.find(o => o.instId === a.instId)?.evoStage).toBe(2); // 不掉档
    expect(db.inventory.cards.find(o => o.instId === b.instId)).toBeUndefined();
  });

  it('无下一形态拒绝合成（SR 到 GSR 后若官方无 XSR 则止步）', () => {
    const db = freshDB();
    // 找一个官方无 X 档的 UR 卡
    const noX = cardsByRarity('UR').find(c => c.officialForms && !c.officialForms.XUR);
    if (!noX) return; // 全部有 XUR 则跳过
    const a = makeOwnedCard(noX.id, 1); a.evoStage = 2; db.inventory.cards.push(a);
    const m1 = makeOwnedCard(noX.id, 1); m1.evoStage = 2; db.inventory.cards.push(m1);
    const prep = prepareEvolve(db, a.instId, [m1.instId], () => 0);
    expect(prep.ok).toBe(false);
  });

  it('加成卡提升成功率：官方卡 base + boost，封顶 100', () => {
    const db = freshDB();
    const a = addCard(db, 'UR', 0, 0);
    const m1 = addCard(db, 'UR', 0, 1); // 双素材（同稀有度）
    const m2 = addCard(db, 'UR', 0, 2);
    const bo = addCard(db, 'LR', 0);
    const prep = prepareEvolve(db, a, [m1, m2], () => 0, 0.08, [bo]);
    expect(prep.ok).toBe(true);
    expect(prep.boost).toBe(15);           // UR→LR +1级
    expect(prep.rate).toBe(100);           // 50 + 25×2 + 15 = 115 → 封顶 100
    expect(prep.success).toBe(true);
  });

  it('失败补偿：每失败 +30%，上限 +90%，成功清零', () => {
    const db = freshDB();
    const a = addCard(db, 'UR', 0);
    let b = addCard(db, 'UR', 0);
    expect(prepareEvolve(db, a, [b], () => 1.1).bonus).toBe(0);
    const f1 = prepareEvolve(db, a, [b], () => 1.1);
    applyEvolve(db, a, [b], f1);
    expect(db.inventory.cards.find(o => o.instId === a)?.evoFailStacks).toBe(1);
    b = addCard(db, 'UR', 0);
    expect(prepareEvolve(db, a, [b], () => 1.1).bonus).toBe(30);
    for (let i = 0; i < 3; i++) {
      b = addCard(db, 'UR', 0);
      const f = prepareEvolve(db, a, [b], () => 1.1);
      applyEvolve(db, a, [b], f);
    }
    b = addCard(db, 'UR', 0);
    expect(prepareEvolve(db, a, [b], () => 1.1).bonus).toBe(90);
    b = addCard(db, 'UR', 0);
    const ok = prepareEvolve(db, a, [b], () => 0);
    applyEvolve(db, a, [b], ok);
    expect(db.inventory.cards.find(o => o.instId === a)?.evoFailStacks).toBe(0);
  });
});

describe('旧体系（无官方数据卡：SPECIAL/X 装备）', () => {
  it('同名×1 成功：+1 星（90%）', () => {
    const db = freshDB();
    const card = ALL_CARDS.find(c => !c.officialForms);
    if (!card) throw new Error('需要无官方数据的卡');
    const a = makeOwnedCard(card.id, 1); a.evoStage = 0; db.inventory.cards.push(a);
    const b = makeOwnedCard(card.id, 1); b.evoStage = 0; db.inventory.cards.push(b);
    const prep = prepareEvolve(db, a.instId, [b.instId], () => 0);
    expect(prep.ok).toBe(true);
    expect(prep.rate).toBe(90);
    expect(prep.newEvoStage).toBe(1);
    applyEvolve(db, a.instId, [b.instId], prep);
    expect(db.inventory.cards.find(o => o.instId === a.instId)?.evoStage).toBe(1);
  });

  it('旧体系失败：降 1 星（0 星不降）', () => {
    const db = freshDB();
    const card = ALL_CARDS.find(c => !c.officialForms);
    if (!card) throw new Error('需要无官方数据的卡');
    const a = makeOwnedCard(card.id, 1); a.evoStage = 2; db.inventory.cards.push(a);
    const b = makeOwnedCard(card.id, 1); b.evoStage = 1; db.inventory.cards.push(b);
    const prep = prepareEvolve(db, a.instId, [b.instId], () => 1.1);
    expect(prep.ok).toBe(true);
    applyEvolve(db, a.instId, [b.instId], prep);
    expect(db.inventory.cards.find(o => o.instId === a.instId)?.evoStage).toBe(1);
  });
});

describe('降星保底（旧体系纯函数）', () => {
  it('≥7 不降（保持原星），5/6 只降到 5，<5 正常降 1（0 不降）', () => {
    expect(evolveFailureStar(0)).toBe(0);
    expect(evolveFailureStar(3)).toBe(2);
    expect(evolveFailureStar(4)).toBe(3);
    expect(evolveFailureStar(5)).toBe(5);
    expect(evolveFailureStar(6)).toBe(5);
    expect(evolveFailureStar(7)).toBe(7);
    expect(evolveFailureStar(9)).toBe(9);
  });
});

describe('官方形态数值（ownedToCombatant）', () => {
  it('官方卡：形态档位用官方 base 值（等级曲线），HUR/GUR/XUR 数值不同', () => {
    const db = freshDB();
    const s0 = addCard(db, 'UR', 0);
    const s1 = addCard(db, 'UR', 1);
    const c0 = ownedToCombatant(db.inventory.cards.find(o => o.instId === s0)!)!;
    const c1 = ownedToCombatant(db.inventory.cards.find(o => o.instId === s1)!)!;
    // 官方卡：不同形态 = 官方不同 base 值（HUR 应大于 UR）
    expect(c1.atk).toBeGreaterThan(c0.atk);
    expect(c1.hpMax).toBeGreaterThan(c0.hpMax);
  });
});
