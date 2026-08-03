import { describe, expect, it } from 'vitest';
import { isProvenance, prov, PROVENANCE_LEVELS } from './provenance';
import { CardCatalog } from './catalog';
import { formOf, getMissingAssets, reportMissingAsset, resetAssetResolver } from './asset-resolver';
import type { CardDefinition } from './types';

const P = prov('original-fill', undefined, '测试');

function makeCard(over: Partial<CardDefinition> = {}): CardDefinition {
  return {
    cardKey: 'fenrir',
    name: { en: 'Fenrir' },
    rarity: 'UR',
    element: 'Cool',
    stats: { attack: 100, defense: 80, soldiers: 50, speed: 60, critRate: 0.1, critDamage: 1.5 },
    forms: [
      { role: 'icon', asset: '/archive/cards/fenrir_icon.png', sourceFile: 'x', source: prov('direct') },
      { role: 'main', asset: '/archive/cards/fenrir.png', sourceFile: 'x', source: prov('direct') },
    ],
    source: P,
    ...over,
  };
}

describe('provenance', () => {
  it('五个合法等级', () => {
    expect(PROVENANCE_LEVELS).toEqual(['direct', 'wiki-data', 'native-schema', 'inferred', 'original-fill']);
  });
  it('isProvenance 校验', () => {
    expect(isProvenance(prov('direct'))).toBe(true);
    expect(isProvenance({ level: 'original' })).toBe(false);
    expect(isProvenance(null)).toBe(false);
  });
});

describe('CardCatalog', () => {
  it('注册与查询', () => {
    const c = new CardCatalog();
    c.register(makeCard());
    expect(c.get('fenrir')?.name.en).toBe('Fenrir');
    expect(c.size).toBe(1);
  });
  it('cardKey 冲突抛错（不静默合并）', () => {
    const c = new CardCatalog();
    c.register(makeCard());
    expect(() => c.register(makeCard())).toThrow(/cardKey 冲突/);
  });
  it('legacyId 迁移索引', () => {
    const c = new CardCatalog();
    c.register(makeCard({ legacyId: 'old-123' }));
    expect(c.getByLegacyId('old-123')?.cardKey).toBe('fenrir');
  });
  it('legacyId 指向不同 cardKey 抛错', () => {
    const c = new CardCatalog();
    c.register(makeCard({ legacyId: 'old-123' }));
    expect(() => c.register(makeCard({ cardKey: 'other', legacyId: 'old-123' }))).toThrow(/legacyId 冲突/);
  });
  it('byRarity 过滤', () => {
    const c = new CardCatalog();
    c.register(makeCard());
    c.register(makeCard({ cardKey: 'aisha', rarity: 'LR' }));
    expect(c.byRarity('LR').map(x => x.cardKey)).toEqual(['aisha']);
  });
});

describe('asset-resolver', () => {
  it('formOf 命中与缺失', () => {
    const card = makeCard();
    expect(formOf(card, 'icon')?.asset).toContain('fenrir_icon');
    expect(formOf(card, 'x')).toBeNull(); // 缺形态返回 null，不造假路径
  });
  it('reportMissingAsset 登记', () => {
    resetAssetResolver();
    reportMissingAsset('/archive/cards/ghost.png');
    expect(getMissingAssets()).toContain('/archive/cards/ghost.png');
  });
});
