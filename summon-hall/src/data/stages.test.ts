import { describe, expect, it } from 'vitest';
import { hasStage, stageVisual } from './stages-runtime';
import stagesJson from './stages.json';
import mapsJson from './maps.json';
import bgsJson from './battle-backgrounds.json';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('stages.json 引用链', () => {
  const mapIds = new Set((mapsJson as Array<{ mapId: string }>).map(m => m.mapId));
  const bgIds = new Set((bgsJson as Array<{ battleBgId: string }>).map(b => b.battleBgId));

  it('mapId / battleBackgroundId 无悬空', () => {
    for (const s of stagesJson) {
      expect(mapIds.has(s.mapId), `${s.stageId} mapId=${s.mapId}`).toBe(true);
      expect(bgIds.has(s.battleBackgroundId), `${s.stageId} bg=${s.battleBackgroundId}`).toBe(true);
    }
  });

  it('db.ts STAGE_DEFS 的 8 关全部有绑定', () => {
    const dbSrc = readFileSync(join(__dirname, '../db.ts'), 'utf8');
    const ids = [...dbSrc.matchAll(/stageId: '([^']+)'/g)].map(m => m[1]);
    expect(ids.length).toBeGreaterThanOrEqual(8);
    for (const id of ids) expect(hasStage(id), id).toBe(true);
  });

  it('stageVisual 返回确定的资源路径', () => {
    const v = stageVisual('r1-s1');
    expect(v.mapAsset).toContain('/archive/map/AreaMap_001');
    expect(v.battleBgAsset).toContain('/archive/battle-bg/BattleBG_001');
    // 同一 stageId 两次解析结果一致（非轮换）
    expect(stageVisual('r1-s1')).toEqual(v);
  });

  it('未知 stageId 回退清单首项', () => {
    const v = stageVisual('no-such-stage');
    expect(v.mapAsset).toContain('/archive/map/');
    expect(v.battleBgAsset).toContain('/archive/battle-bg/');
  });

  it('遭遇类型覆盖 normal/boss/round/king', () => {
    const types = new Set(stagesJson.map(s => s.encounterType));
    expect(types).toEqual(new Set(['normal', 'boss', 'round', 'king']));
  });
});
