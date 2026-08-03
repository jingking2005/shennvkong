/**
 * 运行时卡牌 catalog（OC-04）：加载 cards.runtime.json + card-quotes.json。
 * 垂直切片阶段只有 6 张样卡；查询不到时调用方回退旧 wiki 数据。
 */

import { CardCatalog } from './catalog';
import type { CardDefinition, CardQuotes } from './types';
import runtimeJson from './cards.runtime.json';
import quotesJson from './card-quotes.json';

const catalog = new CardCatalog();
for (const c of runtimeJson as unknown as CardDefinition[]) {
  catalog.register(c);
}

const quotes = quotesJson as unknown as Record<string, CardQuotes>;

export function runtimeCatalog(): CardCatalog {
  return catalog;
}

/** 旧 Card.id（wiki-xxx）→ 新 catalog 卡牌 */
export function runtimeByLegacyId(legacyId: string): CardDefinition | undefined {
  return catalog.getByLegacyId(legacyId);
}

export function quotesFor(cardKey: string): CardQuotes | undefined {
  return quotes[cardKey];
}
