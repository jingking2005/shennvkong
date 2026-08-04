/**
 * 官方复刻测试：5 张 wiki 复刻卡（Fenrir/Aegis/Odin/Ymir/Lilith）
 * 数值与技能文本必须与官方 wiki 完全一致。
 */
import { describe, expect, it } from 'vitest';
import { getCard, WIKI_EXACT_IDS } from './data';

describe('官方复刻（wikiExact）', () => {
  it('WIKI_EXACT_IDS 恰为 5 张', () => {
    expect([...WIKI_EXACT_IDS].sort()).toEqual(
      ['wiki-aegis', 'wiki-fenrir', 'wiki-lilith', 'wiki-odin', 'wiki-ymir'].sort(),
    );
  });

  const CASES = [
    { id: 'wiki-fenrir', atk: 6550, def: 6500, soldiers: 6650, skillName: 'Chain Release', skillDesc: "All Cool allies' ATK 350% up" },
    { id: 'wiki-aegis', atk: 6600, def: 6650, soldiers: 7150, skillName: 'Ultimate Guard', skillDesc: 'Reduce gain damage 60% / Counter attack 500%' },
    { id: 'wiki-odin', atk: 8000, def: 6500, soldiers: 7000, skillName: 'Ragnarok Spear', skillDesc: 'Deal 40% Passion DMG 7 times to the enemy' },
    { id: 'wiki-ymir', atk: 10080, def: 9648, soldiers: 10512, skillName: 'Abyss Reaper', skillDesc: 'Deal 800% Dark DMG to all enemies / Paralysis for 4 turns' },
    { id: 'wiki-lilith', atk: 6800, def: 6400, soldiers: 7800, skillName: 'Master Essence', skillDesc: '【Autoskill】 Skill nullification of any enemy skills / 30% chance' },
  ];

  for (const c of CASES) {
    it(`${c.id} 数值与技能 = 官方 wiki`, () => {
      const card = getCard(c.id);
      expect(card).toBeDefined();
      expect(card!.stats.attack).toBe(c.atk);
      expect(card!.stats.defense).toBe(c.def);
      expect(card!.stats.soldiers).toBe(c.soldiers);
      expect(card!.skillName).toBe(c.skillName);
      expect(card!.skillDesc).toBe(c.skillDesc);
    });
  }
});
