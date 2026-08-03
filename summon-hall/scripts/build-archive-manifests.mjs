#!/usr/bin/env node
/**
 * data:build（OC-03）：从白名单资源子集生成运行时 manifest。
 *
 * 输入：
 *   - public/archive/{map,battle-bg,bgm,items,navi}（此前已显式复制的白名单）
 *   - 归档只读源（Battle/Effects 的 eff_*.png，本脚本复制到 public/archive/battle-effects）
 * 输出（src/data/）：
 *   maps.json / battle-backgrounds.json / audio.json / items.json /
 *   battle-effects.json / navi.json
 *
 * 原则：显式选择、记录 sourceFile 与实际尺寸、可复现；不做全目录扫描进首屏。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVE = '/Users/VazeniF/Desktop/神女控2/archive/final-archive/extracted/Valkyrie Crusade Fan Archive - Final - 2022-09-16';

const DIRECT = { level: 'direct' };
const today = new Date().toISOString().slice(0, 10);

function pngSize(path) {
  const fd = readFileSync(path);
  // PNG: 8 字节签名 + 4 长度 + "IHDR" + 宽(4) + 高(4)，大端
  if (fd.length < 24 || fd.readUInt32BE(12) !== 0x49484452) return {};
  return { width: fd.readUInt32BE(16), height: fd.readUInt32BE(20) };
}

function listPng(dir) {
  return readdirSync(dir).filter(f => f.toLowerCase().endsWith('.png')).sort();
}

function write(name, items) {
  const p = join(root, 'src/data', name);
  writeFileSync(p, JSON.stringify(items, null, 2) + '\n');
  console.log(`  ✓ ${name}: ${items.length} 条`);
}

// ── maps.json（活动/世界地图，≠ 战斗背景）──
{
  const dir = join(root, 'public/archive/map');
  const items = listPng(dir).map(f => {
    const m = f.match(/^(AreaMap_[^.]+)\.(.+)\.png$/);
    const id = (m ? m[1] : f.replace(/\.png$/, '')).toLowerCase().replace(/_/g, '-');
    return {
      mapId: id,
      title: m ? m[2] : f,
      asset: `/archive/map/${f}`,
      sourceFile: `Battle/Map/${f}`,
      isEventMap: true,
      ...pngSize(join(dir, f)),
      source: { ...DIRECT, verifiedAt: today },
    };
  });
  write('maps.json', items);
}

// ── battle-backgrounds.json（闯关战斗背景，≠ 地图）──
{
  const dir = join(root, 'public/archive/battle-bg');
  const items = listPng(dir).map(f => {
    const num = f.match(/BattleBG_(\d+)/)?.[1] ?? f;
    return {
      battleBgId: `battlebg-${num}`,
      asset: `/archive/battle-bg/${f}`,
      sourceFile: `Battle/Background/${f}`,
      modes: ['normal', 'boss', 'round', 'king'],
      ...pngSize(join(dir, f)),
      source: { ...DIRECT, verifiedAt: today },
    };
  });
  write('battle-backgrounds.json', items);
}

// ── audio.json（BGM 全量 25 首登记，usedBy 标注当前用途）──
{
  const dir = join(root, 'public/archive/bgm');
  const usedBy = {
    'bgm_001': ['hall'],
    'bgm_002': ['kingdom', 'team'],
    'bgm_003': ['sortie'],
    'bgm_004': ['battle'],
    'bgm_005': ['archwitch'],
    'bgm_006': ['fantasyArchwitch'],
    'bgm_007': ['map', 'event', 'records'],
  };
  const items = readdirSync(dir).filter(f => f.endsWith('.ogg')).sort().map(f => {
    const key = f.match(/^(bgm_?\d+|bgm_loading)/)?.[1] ?? f;
    return {
      id: key.replace(/_/g, '-'),
      title: f.replace(/\.ogg$/, ''),
      asset: `/archive/bgm/${f}`,
      loop: true,
      usedBy: usedBy[key] ?? [],
      sourceFile: `Audio/stream/${f}`,
      source: { ...DIRECT, verifiedAt: today },
    };
  });
  write('audio.json', items);
}

// ── se.json（APK 启动 SE 4 个；用途映射按时长推断，标注 inferred）──
{
  const dir = join(root, 'public/archive/se');
  if (existsSync(dir)) {
    // APK 仅解出 4 个启动用 SE；文件无语义名，按播放时长推断用途（provenance 不冒充原版映射）
    const inferredUse = {
      'se_007.wav': ['ui-click'],   // 0.46s 短促
      'se_004.wav': ['attack'],     // 0.51s 短促
      'se_003.wav': ['skill'],      // 0.82s 中
      'se_001.wav': ['win-lose'],   // 3.19s 长
    };
    const items = readdirSync(dir).filter(f => f.endsWith('.wav')).sort().map(f => ({
      id: f.replace(/\.wav$/, '').replace(/_/g, '-'),
      title: f.replace(/\.wav$/, ''),
      asset: `/archive/se/${f}`,
      loop: false,
      usedBy: inferredUse[f] ?? [],
      mappingNote: 'APK 原始文件无语义名，usedBy 为按时长推断的用途映射（inferred）',
      sourceFile: `apk assets/sound/${f}`,
      source: { ...DIRECT, verifiedAt: today },
    }));
    write('se.json', items);
  }
}

// ── items.json（强化道具/卡包/掉落物）──
{
  const dir = join(root, 'public/archive/items');
  const usedBy = {
    'Upgrade Potion.png': ['enhance-potion'],
    'Card Bag (R).png': ['chest-bronze'],
    'Card Bag (SR).png': ['chest-silver'],
    'Card Bag (UR).png': ['chest-gold'],
  };
  const items = listPng(dir).map(f => ({
    id: f.replace(/\.png$/, '').replace(/[＋+]/g, '-plus').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    title: f.replace(/\.png$/, ''),
    asset: `/archive/items/${f}`,
    usedBy: usedBy[f] ?? [],
    sourceFile: `Items/**/${f}`,
    ...pngSize(join(dir, f)),
    source: { ...DIRECT, verifiedAt: today },
  }));
  write('items.json', items);
}

// ── battle-effects.json（归档 Battle/Effects 的 eff_*，复制后登记）──
{
  const srcDir = join(ARCHIVE, 'Battle/Effects');
  const dstDir = join(root, 'public/archive/battle-effects');
  mkdirSync(dstDir, { recursive: true });
  const effects = readdirSync(srcDir).filter(f => f.startsWith('eff_') && f.endsWith('.png')).sort();
  const items = [];
  for (const f of effects) {
    copyFileSync(join(srcDir, f), join(dstDir, f));
    items.push({
      effectId: f.replace(/\.png$/, '').replace(/_/g, '-'),
      asset: `/archive/battle-effects/${f}`,
      trigger: 'manual',           // 用途待 OC-06 接线时指定
      durationMs: 600,             // 无原始证据 → original-fill
      sourceFile: `Battle/Effects/${f}`,
      ...pngSize(join(srcDir, f)),
      source: { ...DIRECT, verifiedAt: today, sourceNote: 'trigger/durationMs 为 original-fill' },
    });
  }
  write('battle-effects.json', items);
}

// ── navi.json（看板娘立绘）──
{
  const dir = join(root, 'public/archive/navi');
  const items = listPng(dir).map(f => ({
    id: f.replace(/\.png$/, ''),
    asset: `/archive/navi/${f}`,
    sourceFile: `Navi-Sprites/${f}`,
    ...pngSize(join(dir, f)),
    source: { ...DIRECT, verifiedAt: today },
  }));
  write('navi.json', items);
}

console.log('data:build 完成');
