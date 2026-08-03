/**
 * 卡牌目录（变更单 §4.3）：cards.runtime.json 的内存查询层。
 * OC-04 由构建脚本填充；本模块只管注册与查询，重复 cardKey 拒绝静默合并。
 */

import type { CardDefinition } from './types';

export class CardCatalog {
  private byKey = new Map<string, CardDefinition>();
  private legacyIndex = new Map<string, string>();

  /** 注册卡牌；cardKey 或 legacyId 冲突时抛错（进 collisions 报告，不静默合并） */
  register(card: CardDefinition): void {
    if (this.byKey.has(card.cardKey)) {
      throw new Error(`cardKey 冲突: ${card.cardKey}`);
    }
    if (card.legacyId) {
      const existing = this.legacyIndex.get(card.legacyId);
      if (existing && existing !== card.cardKey) {
        throw new Error(`legacyId 冲突: ${card.legacyId} → ${existing} / ${card.cardKey}`);
      }
      this.legacyIndex.set(card.legacyId, card.cardKey);
    }
    this.byKey.set(card.cardKey, card);
  }

  get(cardKey: string): CardDefinition | undefined {
    return this.byKey.get(cardKey);
  }

  /** 旧 localStorage 存档迁移：legacyId → 新卡 */
  getByLegacyId(legacyId: string): CardDefinition | undefined {
    const key = this.legacyIndex.get(legacyId);
    return key ? this.byKey.get(key) : undefined;
  }

  byRarity(rarity: CardDefinition['rarity']): CardDefinition[] {
    return [...this.byKey.values()].filter(c => c.rarity === rarity);
  }

  get size(): number {
    return this.byKey.size;
  }
}
