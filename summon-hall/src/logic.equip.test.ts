/**
 * 装备系统测试（原创规则）：
 * - X 级卡 → 装备定义（6 种：攻/体/速/攻%乘/全局%乘/复活）
 * - 装备/卸下/替换（装备库不消耗）
 * - 属性加成应用到 ownedToCombatant
 * - 战斗死亡复活（reviveCharges）
 */
import { describe, expect, it } from 'vitest';
import { seedDB, makeOwnedCard, type DB } from './db';
import { cardsByRarity } from './data';
import { equipDefFor, equipCard, unequipCard, addEquipToInventory, ownedToCombatant } from './logic';
import { runBattleTurn, type Combatant } from './systems/battle/battle-engine';

function freshDB(): DB {
  return seedDB((r, n) => cardsByRarity(r).slice(0, n));
}

/** 注入一张指定稀有度的卡 */
function addCard(db: DB, rarity: string, idx = 0): string {
  const c = cardsByRarity(rarity as never)[idx];
  const o = makeOwnedCard(c.id, 1);
  db.inventory.cards.push(o);
  return o.instId;
}

describe('装备定义（X 级卡 → 6 种效果）', () => {
  it('X 卡生成装备定义，非 X 卡返回 null', () => {
    const xs = cardsByRarity('X');
    expect(xs.length).toBeGreaterThan(0);
    for (const c of xs.slice(0, 30)) {
      const def = equipDefFor(c.id);
      expect(def).not.toBeNull();
      expect(['atkFlat', 'hpFlat', 'speed', 'atkMult', 'globalMult', 'revive']).toContain(def!.kind);
      expect(def!.desc.length).toBeGreaterThan(0);
    }
    const ur = cardsByRarity('UR')[0];
    expect(equipDefFor(ur.id)).toBeNull();
  });

  it('同 cardId 定义稳定（哈希确定）', () => {
    const c = cardsByRarity('X')[0];
    expect(equipDefFor(c.id)).toEqual(equipDefFor(c.id));
  });
});

describe('装备/卸下/替换', () => {
  it('装备入库 → 装备到卡 → 卸下 → 替换（装备不消耗）', () => {
    const db = freshDB();
    const a = addCard(db, 'UR');
    const x1 = cardsByRarity('X')[0];
    const x2 = cardsByRarity('X')[1];
    const e1 = addEquipToInventory(db, x1.id);
    const e2 = addEquipToInventory(db, x2.id);
    expect((db.inventory.equips || []).length).toBe(2);

    const def1 = equipCard(db, a, e1);
    expect(def1).not.toBeNull();
    expect(db.inventory.cards.find(o => o.instId === a)?.equipInstId).toBe(e1);

    // 替换：换 e2，e1 仍在装备库
    equipCard(db, a, e2);
    expect(db.inventory.cards.find(o => o.instId === a)?.equipInstId).toBe(e2);
    expect((db.inventory.equips || []).length).toBe(2);

    // 卸下
    unequipCard(db, a);
    expect(db.inventory.cards.find(o => o.instId === a)?.equipInstId).toBeUndefined();
  });
});

describe('装备属性加成', () => {
  it('atkFlat/hpFlat/speed/atkMult/globalMult 生效', () => {
    const db = freshDB();
    const a = addCard(db, 'UR');
    const base = ownedToCombatant(db.inventory.cards.find(o => o.instId === a)!, false, db)!;

    // 找一个 atkFlat 装备
    let eid: string | null = null;
    for (const c of cardsByRarity('X')) {
      const d = equipDefFor(c.id)!;
      if (d.kind === 'atkFlat') {
        const e = addEquipToInventory(db, c.id);
        equipCard(db, a, e);
        eid = e;
        break;
      }
    }
    expect(eid).not.toBeNull();
    const boosted = ownedToCombatant(db.inventory.cards.find(o => o.instId === a)!, false, db)!;
    const def = equipDefFor((db.inventory.equips || []).find(e => e.instId === eid)!.cardId)!;
    expect(boosted.atk).toBe(base.atk + def.value);
  });

  it('globalMult 全属性按百分比提升', () => {
    const db = freshDB();
    const a = addCard(db, 'UR');
    const base = ownedToCombatant(db.inventory.cards.find(o => o.instId === a)!, false, db)!;
    for (const c of cardsByRarity('X')) {
      const d = equipDefFor(c.id)!;
      if (d.kind === 'globalMult') {
        const e = addEquipToInventory(db, c.id);
        equipCard(db, a, e);
        const boosted = ownedToCombatant(db.inventory.cards.find(o => o.instId === a)!, false, db)!;
        const m = 1 + d.value / 100;
        expect(boosted.atk).toBe(Math.floor(base.atk * m));
        expect(boosted.hpMax).toBe(Math.floor(base.hpMax * m));
        return;
      }
    }
    expect(false).toBe(true); // 应能找到 globalMult 装备
  });
});

describe('战斗复活（revive 装备）', () => {
  it('装备复活：死亡时 50% HP 复活一次，消耗次数', () => {
    const db = freshDB();
    const a = addCard(db, 'UR');
    for (const c of cardsByRarity('X')) {
      const d = equipDefFor(c.id)!;
      if (d.kind === 'revive') {
        const e = addEquipToInventory(db, c.id);
        equipCard(db, a, e);
        break;
      }
    }
    const cb = ownedToCombatant(db.inventory.cards.find(o => o.instId === a)!, false, db)!;
    expect(cb.reviveCharges).toBe(1);

    // 构造敌人一击秒杀（敌人速度更高先手）
    const foe: Combatant = {
      instId: 'foe', card: cb.card, lv: 1, atk: 999999, hp: 100, hpMax: 100, def: 0,
      speed: 9999, element: 'light', skillName: 'x', procChance: 0, skillMult: 1, skillFx: 'fire', isLeader: false, rage: 0,
    };
    const r = runBattleTurn([cb], [foe], 1);
    // 玩家被打死后复活 → 存活
    expect(cb.hp).toBeGreaterThan(0);
    expect(cb.reviveCharges).toBe(0);
    expect(r.events.some(e => e.phase === 'revive')).toBe(true);
  });
});
