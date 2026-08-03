#!/usr/bin/env node
/**
 * data:validate（OC-02 骨架，OC-03/04/05 逐步扩展检查面）
 *
 * 当前检查：
 *  - src/cards.json：id 唯一、rarity/element 合法、必填字段非空
 *  - src/data/ 下已存在的 manifest（maps/battle-backgrounds/audio/...）：
 *    id 唯一、asset URL 唯一、无路径穿越、引用文件存在于 public/、
 *    provenance level 合法
 *  - src/data/stages.json（若存在）：mapId/battleBackgroundId 引用无悬空
 *
 * 退出码：0 通过；1 有错误。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const notes = [];

const RARITIES = new Set(['N', 'R', 'SR', 'UR', 'LR', 'X', 'VR']);
const PROVENANCE = new Set(['direct', 'wiki-data', 'native-schema', 'inferred', 'original-fill']);

function err(msg) { errors.push(msg); }
function note(msg) { notes.push(msg); }

function checkIdUnique(items, idField, label) {
  const seen = new Map();
  for (const it of items) {
    const id = it[idField];
    if (!id) { err(`${label}: 存在空 ${idField}`); continue; }
    if (seen.has(id)) err(`${label}: ${idField} 重复 "${id}"（${seen.get(id)} / ${it.name ?? '?'}）`);
    else seen.set(id, it.name ?? '?');
  }
}

function checkAssetUrl(url, label) {
  if (typeof url !== 'string' || !url) { err(`${label}: 空 asset URL`); return; }
  if (url.split('/').includes('..')) { err(`${label}: 路径穿越 "${url}"`); return; }
  if (!url.startsWith('/')) { err(`${label}: 非根相对路径 "${url}"`); return; }
  if (!existsSync(join(root, 'public', url))) err(`${label}: 文件不存在 "${url}"`);
}

function checkProvenance(p, label) {
  if (!p || !PROVENANCE.has(p.level)) err(`${label}: provenance level 非法 (${JSON.stringify(p)})`);
}

// ── cards.json（wiki-data 兼容层源头）──
const cardsPath = join(root, 'src/cards.json');
if (existsSync(cardsPath)) {
  const cards = JSON.parse(readFileSync(cardsPath, 'utf8'));
  checkIdUnique(cards, 'id', 'cards.json');
  for (const c of cards) {
    if (!RARITIES.has(c.rarity)) err(`cards.json: ${c.id} rarity 非法 "${c.rarity}"`);
    if (!c.element) err(`cards.json: ${c.id} element 为空`);
    if (!c.name?.en && !c.name?.cn) err(`cards.json: ${c.id} name 为空`);
  }
  note(`cards.json: ${cards.length} 条记录`);
} else {
  note('cards.json 不存在，跳过');
}

// ── data manifest（存在才检查，OC-03/04 生成）──
const dataDir = join(root, 'src/data');
const manifestIdField = {
  'maps.json': 'mapId',
  'battle-backgrounds.json': 'battleBgId',
  'audio.json': 'id',
  'battle-effects.json': 'effectId',
  'items.json': 'id',
  'navi.json': 'id',
};
const manifests = {};
if (existsSync(dataDir)) {
  for (const [file, idField] of Object.entries(manifestIdField)) {
    const p = join(dataDir, file);
    if (!existsSync(p)) { note(`${file}: 未生成（OC-03/04 后纳入检查）`); continue; }
    const items = JSON.parse(readFileSync(p, 'utf8'));
    if (!Array.isArray(items)) { err(`${file}: 顶层必须是数组`); continue; }
    manifests[file] = items;
    checkIdUnique(items, idField, file);
    const urls = new Set();
    for (const it of items) {
      const label = `${file}:${it[idField] ?? '?'}`;
      if (it.asset) {
        if (urls.has(it.asset)) err(`${label}: asset URL 重复 "${it.asset}"`);
        urls.add(it.asset);
        checkAssetUrl(it.asset, label);
      }
      if (it.source) checkProvenance(it.source, label);
    }
    note(`${file}: ${items.length} 条`);
  }
}

// ── stages.json 引用链（OC-05 生成）──
const stagesPath = join(dataDir, 'stages.json');
if (existsSync(stagesPath)) {
  const stages = JSON.parse(readFileSync(stagesPath, 'utf8'));
  const mapIds = new Set((manifests['maps.json'] ?? []).map(m => m.mapId));
  const bgIds = new Set((manifests['battle-backgrounds.json'] ?? []).map(b => b.battleBgId));
  for (const s of stages) {
    if (!mapIds.has(s.mapId)) err(`stages.json:${s.stageId}: mapId 悬空 "${s.mapId}"`);
    if (!bgIds.has(s.battleBackgroundId)) err(`stages.json:${s.stageId}: battleBackgroundId 悬空 "${s.battleBackgroundId}"`);
    if (s.source) checkProvenance(s.source, `stages.json:${s.stageId}`);
  }
  note(`stages.json: ${stages.length} 条`);
}

for (const n of notes) console.log(`  · ${n}`);
if (errors.length) {
  console.error(`\ndata:validate FAIL（${errors.length} 个错误）:`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log('\ndata:validate PASS');
