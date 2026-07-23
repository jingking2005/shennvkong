/**
 * 数据校验器 — 验证 normalized 数据是否符合 Schema
 * 用法: npx tsx src/data/pipeline/validate.ts [input.json]
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Card, Element, Rarity } from '../schema/types';

const VALID_ELEMENTS: Element[] = ['Passion', 'Cool', 'Light', 'Dark', 'Special'];
const VALID_RARITIES: Rarity[] = ['N', 'R', 'SR', 'UR', 'LR', 'HN', 'HR', 'HSR', 'HUR', 'HLR'];

export interface ValidationError {
  index: number;
  id: string;
  field: string;
  message: string;
}

export function validateCards(cards: unknown[]): ValidationError[] {
  const errors: ValidationError[] = [];

  cards.forEach((raw, index) => {
    const card = raw as Partial<Card>;
    const id = card.id || `index_${index}`;

    if (!card.id) errors.push({ index, id, field: 'id', message: '缺少 id' });
    if (!card.names?.en) errors.push({ index, id, field: 'names.en', message: '缺少英文名' });
    if (card.rarity && !VALID_RARITIES.includes(card.rarity)) {
      errors.push({ index, id, field: 'rarity', message: `无效稀有度: ${card.rarity}` });
    }
    if (card.element && !VALID_ELEMENTS.includes(card.element)) {
      errors.push({ index, id, field: 'element', message: `无效属性: ${card.element}` });
    }
    if (card.baseStats) {
      const { atk, def, hp, speed } = card.baseStats;
      if (typeof atk !== 'number' || atk <= 0) errors.push({ index, id, field: 'baseStats.atk', message: `无效 ATK: ${atk}` });
      if (typeof def !== 'number' || def <= 0) errors.push({ index, id, field: 'baseStats.def', message: `无效 DEF: ${def}` });
      if (typeof hp !== 'number' || hp <= 0) errors.push({ index, id, field: 'baseStats.hp', message: `无效 HP: ${hp}` });
      if (typeof speed !== 'number' || speed <= 0) errors.push({ index, id, field: 'baseStats.speed', message: `无效 Speed: ${speed}` });
    } else {
      errors.push({ index, id, field: 'baseStats', message: '缺少 baseStats' });
    }
  });

  return errors;
}

// CLI 入口
const inputPath = process.argv[2] || resolve(import.meta.dirname, '../fixtures/mock-cards.json');
try {
  const data = JSON.parse(readFileSync(inputPath, 'utf-8'));
  const errors = validateCards(data);
  if (errors.length === 0) {
    console.log(`✓ 校验通过: ${data.length} 张卡牌，0 错误`);
  } else {
    console.error(`✗ 校验失败: ${errors.length} 个错误`);
    errors.slice(0, 20).forEach(e => console.error(`  [${e.id}] ${e.field}: ${e.message}`));
    process.exit(1);
  }
} catch (err) {
  console.error(`读取文件失败: ${inputPath}`, err);
  process.exit(1);
}
