/**
 * 数据标准化器 — 将 Hermes 原始 cards.json 转换为 normalized 格式
 * 用法: npx tsx src/data/pipeline/normalize.ts [raw_input] [output_dir]
 *
 * 数据流: output/cards.json (raw, 只读) → game/data/normalized/cards.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { Card, Element, Rarity, RawCard } from '../schema/types';

// === 字段映射 ===

const ELEMENT_MAP: Record<string, Element> = {
  passion: 'Passion', cool: 'Cool', light: 'Light', dark: 'Dark', special: 'Special',
  'passion': 'Passion', 'cool': 'Cool', 'light': 'Light', 'dark': 'Dark',
};

const RARITY_MAP: Record<string, Rarity> = {
  n: 'N', r: 'R', sr: 'SR', ur: 'UR', lr: 'LR',
  hn: 'HN', hr: 'HR', hsr: 'HSR', hur: 'HUR', hlr: 'HLR',
};

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseNum(val: number | string | undefined): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // 处理 "9999 / 9999" 格式（取第一个数值）
    const first = val.split('/')[0].trim();
    const n = parseInt(first.replace(/[,，]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

/** 适配 Hermes 实际输出格式 */
interface HermesRawCard {
  title?: string;
  name?: string;
  element?: string;
  rarity?: string;
  skill_name?: string;
  stats_base?: { cost?: string; atk?: string; def?: string; soldiers?: string };
  url?: string;
  images?: string[];
  [key: string]: unknown;
}

function normalizeElement(raw: string | undefined): Element {
  if (!raw) return 'Special';
  return ELEMENT_MAP[raw.toLowerCase().trim()] || 'Special';
}

function normalizeRarity(raw: string | undefined): Rarity {
  if (!raw) return 'N';
  return RARITY_MAP[raw.toLowerCase().trim()] || 'N';
}

// === 主转换 ===

export function normalizeCard(rawInput: RawCard | HermesRawCard): Card | null {
  const raw = rawInput as HermesRawCard;
  const name = raw.title || raw.name;
  if (!name) return null;

  const slug = slugify(name);
  const stats = raw.stats_base || {};
  const atk = parseNum(stats.atk as string | undefined);
  const def = parseNum(stats.def as string | undefined);
  const cost = parseNum(stats.cost as string | undefined);

  // HP 推算: DEF * 4 + 基础值（按稀有度）
  const rarity = normalizeRarity(raw.rarity);
  const rarityHpBase: Record<string, number> = { N: 2000, R: 8000, SR: 16000, UR: 28000, LR: 40000 };
  const hp = def * 4 + (rarityHpBase[rarity] || 5000);

  // Speed 推算: 基础 + 稀有度加成
  const raritySpeed: Record<string, number> = { N: 30, R: 50, SR: 65, UR: 80, LR: 90 };
  const speed = (raritySpeed[rarity] || 40) + Math.floor(atk / 500);

  return {
    id: slug,
    slug,
    names: { en: name, cn: (raw as RawCard).name_cn },
    rarity,
    element: normalizeElement(raw.element),
    cost: cost || Math.floor((atk + def) / 1000),
    baseStats: { atk, def, hp, speed },
    skillIds: raw.skill_name ? [slugify(raw.skill_name)] : [],
    forms: [{ formType: 'normal', stats: { atk, def, hp, speed }, assetRefs: [] }],
    tags: [],
    dataVersion: 1,
  };
}

export function normalizeAll(rawCards: (RawCard | HermesRawCard)[]): { cards: Card[]; skipped: number } {
  const cards: Card[] = [];
  let skipped = 0;
  const seen = new Set<string>();

  for (const raw of rawCards) {
    const card = normalizeCard(raw);
    if (!card) { skipped++; continue; }
    if (card.baseStats.atk === 0 && card.baseStats.def === 0) { skipped++; continue; } // 无效数据
    if (seen.has(card.id)) { skipped++; continue; } // 去重
    seen.add(card.id);
    cards.push(card);
  }

  return { cards, skipped };
}

// CLI 入口
const rawPath = process.argv[2] || resolve(import.meta.dirname, '../../../../output/cards.json');
const outDir = process.argv[3] || resolve(import.meta.dirname, '../../../data/normalized');

if (!existsSync(rawPath)) {
  console.log(`原始数据不存在: ${rawPath}`);
  console.log('提示: Hermes 抓取完成后，output/cards.json 将可用。');
  console.log('当前可使用 Mock 数据: npx tsx src/data/pipeline/validate.ts');
  process.exit(0);
}

const raw = JSON.parse(readFileSync(rawPath, 'utf-8')) as HermesRawCard[];
const { cards, skipped } = normalizeAll(raw);

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'cards.json'), JSON.stringify(cards, null, 2));
console.log(`标准化完成: ${cards.length} 张卡牌, 跳过 ${skipped} 条`);
console.log(`输出: ${resolve(outDir, 'cards.json')}`);
