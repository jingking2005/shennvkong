/**
 * 关卡视觉/音频绑定（OC-05）：stageId → 地图 + 战斗背景 + BGM。
 * 引用链全部走 manifest；缺失进 missingAssets 诊断并回退到清单首项，
 * 不再用 stageId % 数组长度 的隐式轮换。
 */

import { reportMissingAsset } from './asset-resolver';
import stagesJson from './stages.json';
import mapsJson from './maps.json';
import bgsJson from './battle-backgrounds.json';

export interface StageBinding {
  stageId: string;
  mapId: string;
  battleBackgroundId: string;
  musicId?: string;
  encounterType: 'normal' | 'boss' | 'round' | 'king';
}

interface MapEntry { mapId: string; asset: string; }
interface BgEntry { battleBgId: string; asset: string; }

const stages = stagesJson as unknown as StageBinding[];
const maps = mapsJson as unknown as MapEntry[];
const bgs = bgsJson as unknown as BgEntry[];

const byStage = new Map(stages.map(s => [s.stageId, s]));
const mapAsset = new Map(maps.map(m => [m.mapId, m.asset]));
const bgAsset = new Map(bgs.map(b => [b.battleBgId, b.asset]));

export interface StageVisual {
  mapAsset: string;
  battleBgAsset: string;
  musicId?: string;
}

/** 取关卡的确定视觉绑定；引用悬空时诊断 + 回退清单首项 */
export function stageVisual(stageId: string): StageVisual {
  const s = byStage.get(stageId);
  if (!s) {
    reportMissingAsset(`stages.json 缺 stageId=${stageId}`);
    return { mapAsset: maps[0].asset, battleBgAsset: bgs[0].asset };
  }
  let ma = mapAsset.get(s.mapId);
  if (!ma) { reportMissingAsset(`maps.json 缺 mapId=${s.mapId}`); ma = maps[0].asset; }
  let ba = bgAsset.get(s.battleBackgroundId);
  if (!ba) { reportMissingAsset(`battle-backgrounds.json 缺 ${s.battleBackgroundId}`); ba = bgs[0].asset; }
  return { mapAsset: ma, battleBgAsset: ba, musicId: s.musicId };
}

export function hasStage(stageId: string): boolean {
  return byStage.has(stageId);
}
