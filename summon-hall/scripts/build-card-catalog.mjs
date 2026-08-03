#!/usr/bin/env node
/**
 * build-card-catalog（OC-04）：RESOURCE_INDEX.csv 驱动的卡牌 catalog 构建。
 *
 * 第一条垂直切片只接 6 张样卡（变更单 §3.2C），打通
 * 「卡池 → 结果 → 图鉴 → 详情 → 形态切换 → 引文」后再扩全量。
 *
 * 输入（只读）：
 *   神女控2/resources_index/RESOURCE_INDEX.csv
 *   神女控2/archive/final-archive/.../Cards/{rarity}/{element}/{name}/
 *   src/cards.json（wiki-data：legacyId / 数值 / 技能）
 * 输出：
 *   public/archive/cards/<cardKey>/…（白名单复制）
 *   src/data/cards.runtime.json
 *   src/data/card-quotes.json
 *   reports/{card-collisions,missing-assets,quotes-parse}.json
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC2 = '/Users/VazeniF/Desktop/神女控2';
const ARCHIVE = join(SRC2, 'archive/final-archive/extracted/Valkyrie Crusade Fan Archive - Final - 2022-09-16');
const INDEX_CSV = join(SRC2, 'resources_index/RESOURCE_INDEX.csv');
const today = new Date().toISOString().slice(0, 10);

/** 垂直切片白名单（变更单 §3.2C） */
const SLICE_PATHS = [
  'Cards/UR/Cool/Fenrir',
  'Cards/LR/Cool/Aisha',
  'Cards/UR/Dark/Mage Emilie',
  'Cards/UR/Light/Seir',
  'Cards/UR/Passion/Madeline',
  'Cards/SR/Passion/Sjofn',
];

const ELEMENTS = new Set(['Cool', 'Dark', 'Light', 'Passion', 'Special']);
const RARITIES = new Set(['N', 'R', 'SR', 'UR', 'LR', 'X', 'VR']);

// ── 容错 CSV 解析（支持引号字段）──
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0]) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function pngSize(path) {
  const fd = readFileSync(path);
  if (fd.length < 24 || fd.readUInt32BE(12) !== 0x49484452) return {};
  return { width: fd.readUInt32BE(16), height: fd.readUInt32BE(20) };
}

function cardKeyOf(name) {
  return name.replace(/[＋+]/g, '-plus').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** 按文件名后缀分类形态（变更单 §3.2A）；无法识别进报告 */
function classifyFile(cardName, file) {
  if (file === `${cardName} Quotes.txt`) return { kind: 'quotes' };
  if (!file.endsWith('.png') || !file.startsWith(cardName)) return { kind: 'unknown' };
  const rest = file.slice(cardName.length);
  const map = {
    '.png': 'main',
    '_H.png': 'h',
    '_X.png': 'x',
    '_icon.png': 'icon',
    '_H_icon.png': 'hIcon',
    '_X_icon.png': 'xIcon',
    '_G_icon.png': 'guildIcon',
  };
  return map[rest] ? { kind: 'asset', role: map[rest] } : { kind: 'unknown' };
}

// ── 引文解析（变更单 §3.3）──
const QUOTE_KEYS = {
  Description: 'description', Login: 'login', Meet: 'meet',
  Friendship: 'friendship', FriendshipMax: 'friendshipMax',
  FriendshipEvent: 'friendshipEvent', BattleStart: 'battleStart',
  BattleEnd: 'battleEnd', Rebirth: 'rebirth',
};
function parseQuotes(text) {
  const out = { raw: text };
  const unknownKeys = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Za-z]+):\s?(.*)$/);
    if (m && (QUOTE_KEYS[m[1]] || /^[A-Z]/.test(m[1]))) {
      const key = QUOTE_KEYS[m[1]];
      if (key) { cur = key; out[key] = m[2]; }
      else { cur = null; unknownKeys.push(m[1]); }
    } else if (cur) {
      out[cur] += '\n' + line;
    }
  }
  for (const k of Object.values(QUOTE_KEYS)) {
    if (typeof out[k] === 'string') {
      out[k] = out[k].replace(/\n{3,}/g, '\n\n').trimEnd();
      if (!out[k]) delete out[k];
    }
  }
  return { quotes: out, unknownKeys };
}

// ── 主流程 ──
const rows = parseCsv(readFileSync(INDEX_CSV, 'utf8'));
const header = rows[0];
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const byPath = new Map();
for (const r of rows.slice(1)) byPath.set(r[idx.path], r);

const wiki = JSON.parse(readFileSync(join(root, 'src/cards.json'), 'utf8'));

const runtime = [];
const quotesOut = {};
const collisions = [];
const missingAssets = [];
const quotesReport = [];

for (const path of SLICE_PATHS) {
  const row = byPath.get(path);
  if (!row) { missingAssets.push({ path, reason: 'RESOURCE_INDEX.csv 中不存在' }); continue; }
  const cardName = row[idx.card_name];
  const rarity = row[idx.rarity];
  const element = row[idx.element];
  const cardKey = cardKeyOf(cardName);
  const cardDir = join(ARCHIVE, path);

  if (!RARITIES.has(rarity) || !ELEMENTS.has(element)) {
    missingAssets.push({ path, reason: `非法 rarity/element: ${rarity}/${element}` });
    continue;
  }
  if (row[idx.has_main_art] !== 'True') {
    missingAssets.push({ path, reason: 'has_main_art=false，不生成可展示卡牌' });
    continue;
  }

  const files = row[idx.files].split(';').map(s => s.trim()).filter(Boolean);
  const dstDir = join(root, 'public/archive/cards', cardKey);
  mkdirSync(dstDir, { recursive: true });

  const forms = [];
  let quotesFile = null;
  for (const f of files) {
    const c = classifyFile(cardName, f);
    if (c.kind === 'quotes') { quotesFile = f; continue; }
    if (c.kind !== 'asset') { missingAssets.push({ path, file: f, reason: '无法识别的文件后缀' }); continue; }
    const srcFile = join(cardDir, f);
    if (!existsSync(srcFile)) { missingAssets.push({ path, file: f, reason: '索引列出但文件不存在' }); continue; }
    copyFileSync(srcFile, join(dstDir, f));
    forms.push({
      role: c.role,
      asset: `/archive/cards/${cardKey}/${f}`,
      sourceFile: `${path}/${f}`,
      ...pngSize(srcFile),
      source: { level: 'direct', verifiedAt: today },
    });
  }
  if (!forms.some(f => f.role === 'icon')) {
    missingAssets.push({ path, reason: '缺 icon（UI 须显示「无缩略图」fallback）' });
  }

  // wiki 合并（legacyId / 数值 / 技能）
  const wikiHits = wiki.filter(c => c.name?.en === cardName);
  if (wikiHits.length > 1) collisions.push({ cardName, ids: wikiHits.map(c => c.id) });
  const w = wikiHits[0];

  // 引文
  if (quotesFile && existsSync(join(cardDir, quotesFile))) {
    const text = readFileSync(join(cardDir, quotesFile), 'utf8');
    const { quotes, unknownKeys } = parseQuotes(text);
    quotesOut[cardKey] = quotes;
    quotesReport.push({
      cardKey, file: `${path}/${quotesFile}`, ok: true,
      keys: Object.keys(quotes).filter(k => k !== 'raw'),
      unknownKeys,
      sourceNote: '英文原版引文（direct）',
    });
  } else {
    quotesReport.push({ cardKey, ok: false, reason: '无 Quotes 文件' });
  }

  runtime.push({
    cardKey,
    legacyId: w?.id,
    name: { en: cardName, cn: w?.name?.cn },
    rarity,
    element,
    stats: {
      attack: w?.baseStats?.attack ?? 0,
      defense: w?.baseStats?.defense ?? 0,
      soldiers: w?.baseStats?.soldiers ?? 0,
      speed: w?.baseStats?.speed ?? 0,
      critRate: w?.baseStats?.critRate ?? 0,
      critDamage: w?.baseStats?.critDamage ?? 0,
    },
    skill: w?.wiki?.skillName
      ? { name: w.wiki.skillName, desc: w.wiki.skillDesc ?? '', source: { level: 'wiki-data' } }
      : undefined,
    forms,
    quotesRef: quotesOut[cardKey] ? cardKey : undefined,
    source: { level: 'wiki-data', sourceNote: 'assets=direct（归档文件）；stats/skill=wiki-data' },
  });
  console.log(`  ✓ ${cardKey}（${forms.length} 个资源${quotesOut[cardKey] ? ' + 引文' : ''}）`);
}

writeFileSync(join(root, 'src/data/cards.runtime.json'), JSON.stringify(runtime, null, 2) + '\n');
writeFileSync(join(root, 'src/data/card-quotes.json'), JSON.stringify(quotesOut, null, 2) + '\n');
mkdirSync(join(root, 'reports'), { recursive: true });
writeFileSync(join(root, 'reports/card-collisions.json'), JSON.stringify(collisions, null, 2) + '\n');
writeFileSync(join(root, 'reports/missing-assets.json'), JSON.stringify(missingAssets, null, 2) + '\n');
writeFileSync(join(root, 'reports/quotes-parse.json'), JSON.stringify(quotesReport, null, 2) + '\n');
console.log(`cards.runtime.json: ${runtime.length} 张；引文 ${Object.keys(quotesOut).length} 份；冲突 ${collisions.length}；缺失 ${missingAssets.length}`);
