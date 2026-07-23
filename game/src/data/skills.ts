import type { Skill } from './schema/types';

export const SKILLS: Skill[] = [
  { id: 'holy-judgment', name: 'Holy Judgment', name_cn: '神圣审判', desc: '对单体造成 2.5 倍光属性伤害', rate: 0.35, multiplier: 2.5, target: 'single', effects: [{ type: 'damage', value: 2.5 }] },
  { id: 'abyss-flame', name: 'Abyss Flame', name_cn: '深渊之焰', desc: '对全体造成 1.8 倍暗属性伤害', rate: 0.30, multiplier: 1.8, target: 'all', effects: [{ type: 'damage', value: 1.8 }] },
  { id: 'flame-strike', name: 'Flame Strike', name_cn: '烈焰斩', desc: '对单体造成 2.2 倍火属性伤害', rate: 0.35, multiplier: 2.2, target: 'single', effects: [{ type: 'damage', value: 2.2 }] },
  { id: 'frozen-coffin', name: 'Frozen Coffin', name_cn: '冰棺', desc: '对单体造成 2.0 倍伤害并冻结', rate: 0.30, multiplier: 2.0, target: 'single', effects: [{ type: 'damage', value: 2.0 }, { type: 'stun', value: 1, duration: 1 }] },
  { id: 'divine-heal', name: 'Divine Heal', name_cn: '神圣治愈', desc: '恢复全体队友 HP', rate: 0.40, multiplier: 0.5, target: 'all', effects: [{ type: 'heal', value: 0.5 }] },
  { id: 'blood-drain', name: 'Blood Drain', name_cn: '吸血', desc: '对单体造成 2.0 倍伤害并回复自身', rate: 0.35, multiplier: 2.0, target: 'single', effects: [{ type: 'damage', value: 2.0 }] },
  { id: 'power-slash', name: 'Power Slash', name_cn: '力量斩', desc: '对单体造成 1.8 倍伤害', rate: 0.30, multiplier: 1.8, target: 'single', effects: [{ type: 'damage', value: 1.8 }] },
  { id: 'ice-shard', name: 'Ice Shard', name_cn: '冰碎片', desc: '对单体造成 1.7 倍伤害', rate: 0.30, multiplier: 1.7, target: 'single', effects: [{ type: 'damage', value: 1.7 }] },
  { id: 'minor-heal', name: 'Minor Heal', name_cn: '初级治愈', desc: '恢复单体队友 HP', rate: 0.35, multiplier: 0.3, target: 'single', effects: [{ type: 'heal', value: 0.3 }] },
  { id: 'shadow-bolt', name: 'Shadow Bolt', name_cn: '暗影箭', desc: '对单体造成 1.9 倍暗属性伤害', rate: 0.30, multiplier: 1.9, target: 'single', effects: [{ type: 'damage', value: 1.9 }] },
];

export function getSkillById(id: string): Skill | null {
  return SKILLS.find(s => s.id === id) ?? null;
}
