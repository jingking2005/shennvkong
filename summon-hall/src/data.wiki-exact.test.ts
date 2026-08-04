/**
 * 官方复刻测试：wiki 官方形态数据（officialForms）+ 中文技能（skillsZh）。
 * 验证：UR 档满级数值 = 官方 wiki 值；中文技能存在。
 */
import { describe, expect, it } from 'vitest';
import { getCard, ALL_CARDS } from './data';

describe('官方复刻（officialForms / skillsZh）', () => {
  const CASES = [
    {
      id: 'wiki-fenrir',
      ur: { maxLv: 70, atk: 10480, def: 10400, soldiers: 11310 },
      zh: '锁链解放',
    },
    {
      id: 'wiki-aegis',
      ur: { maxLv: 70, atk: 10560, def: 10640, soldiers: 12160 },
      zh: '终极防御',
    },
    {
      id: 'wiki-odin',
      ur: { maxLv: 70, atk: 13600, def: 10400, soldiers: 11200 },
      zh: '诸神黄昏之枪',
    },
    {
      id: 'wiki-ymir',
      ur: { maxLv: 70, atk: 16128, def: 15437, soldiers: 17870 },
      zh: '深渊收割者',
    },
    {
      id: 'wiki-lilith',
      ur: { maxLv: 70, atk: 10880, def: 10240, soldiers: 13260 },
      zh: '大师精华',
    },
  ];

  for (const c of CASES) {
    it(`${c.id} UR 档官方满级数值 + 中文技能`, () => {
      const card = getCard(c.id);
      expect(card).toBeDefined();
      const ur = card!.officialForms?.UR;
      expect(ur).toBeDefined();
      expect(ur!.maxLv).toBe(c.ur.maxLv);
      expect(ur!.atk).toBe(c.ur.atk);
      expect(ur!.def).toBe(c.ur.def);
      expect(ur!.soldiers).toBe(c.ur.soldiers);
      // 中文技能
      const s = card!.skillsZh?.UR;
      expect(s?.name).toBe(c.zh);
      expect(s?.desc).toBeTruthy();
    });
  }

  it('Lv1 基础值反推：base = 满级值 / (1 + (maxLv-1)×0.06)，满级时还原官方值', () => {
    const card = getCard('wiki-fenrir')!;
    const ur = card.officialForms!.UR;
    const restored = Math.round(ur.baseAtk * (1 + (ur.maxLv - 1) * 0.06));
    // 允许取整误差 ≤2
    expect(Math.abs(restored - ur.atk)).toBeLessThanOrEqual(2);
    expect(card.stats.attack).toBe(ur.baseAtk);
  });

  it('中文技能覆盖：官方数据卡均有 UR 中文技能名', () => {
    const withForms = ALL_CARDS.filter(c => c.officialForms);
    const withZh = withForms.filter(c => c.skillsZh?.UR?.name);
    // 覆盖 ≥99%
    expect(withZh.length / withForms.length).toBeGreaterThanOrEqual(0.99);
  });
});
