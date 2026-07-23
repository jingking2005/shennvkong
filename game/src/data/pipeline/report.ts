/**
 * 数据报告 — 生成清洗统计
 * 用法: npx tsx src/data/pipeline/report.ts [normalized.json]
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { Card } from '../schema/types';

const inputPath = process.argv[2] || resolve(import.meta.dirname, '../../../data/normalized/cards.json');

if (!existsSync(inputPath)) {
  console.log('尚未生成 normalized 数据。请先运行: npm run data:normalize');
  process.exit(0);
}

const cards = JSON.parse(readFileSync(inputPath, 'utf-8')) as Card[];

const byRarity: Record<string, number> = {};
const byElement: Record<string, number> = {};
let withSkill = 0;
let totalAtk = 0;

for (const card of cards) {
  byRarity[card.rarity] = (byRarity[card.rarity] || 0) + 1;
  byElement[card.element] = (byElement[card.element] || 0) + 1;
  if (card.skillIds.length > 0) withSkill++;
  totalAtk += card.baseStats.atk;
}

console.log('=== 神女控 数据报告 ===');
console.log(`总卡牌数: ${cards.length}`);
console.log(`有技能: ${withSkill} (${(withSkill / cards.length * 100).toFixed(1)}%)`);
console.log(`平均 ATK: ${Math.floor(totalAtk / cards.length)}`);
console.log('\n按稀有度:');
Object.entries(byRarity).sort().forEach(([r, n]) => console.log(`  ${r}: ${n}`));
console.log('\n按属性:');
Object.entries(byElement).sort().forEach(([e, n]) => console.log(`  ${e}: ${n}`));
