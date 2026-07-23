/**
 * CardImageResolver — 卡图路径解析与颜色映射（纯逻辑，无 Phaser 依赖）
 *
 * 职责：
 * 1. 将卡牌 slug 解析为标准图片路径
 * 2. 提供稀有度/属性对应的颜色值
 * 3. 判断是否需要使用占位纹理
 */

import type { Element, Rarity } from '../data/schema/types';

// === 路径解析 ===

/** 根据 slug 返回标准卡图路径 */
export function resolveCardImagePath(slug: string): string {
  return `assets/cards/${slug}.png`;
}

// === 稀有度边框颜色 ===

const RARITY_COLORS: Record<string, number> = {
  N: 0x9e9e9e,
  R: 0x42a5f5,
  SR: 0xffa726,
  UR: 0xef5350,
  LR: 0xab47bc,
};

/** 获取稀有度对应的边框颜色（H 前缀变体映射到基础色） */
export function getRarityBorderColor(rarity: Rarity): number {
  // 直接匹配
  if (RARITY_COLORS[rarity]) return RARITY_COLORS[rarity];

  // H 前缀变体：HN→N, HR→R, HSR→SR, HUR→UR, HLR→LR
  if (rarity.startsWith('H')) {
    const base = rarity.slice(1);
    if (RARITY_COLORS[base]) return RARITY_COLORS[base];
  }

  return 0xffffff; // 未知稀有度
}

// === 属性底色 ===

const ELEMENT_COLORS: Record<Element, number> = {
  Passion: 0xc62828,
  Cool: 0x1565c0,
  Light: 0x2e7d32,
  Dark: 0x6a1b9a,
  Special: 0xf57f17,
};

/** 获取属性对应的底色 */
export function getElementBaseColor(element: Element): number {
  return ELEMENT_COLORS[element] ?? 0x424242;
}

// === 占位判断 ===

/** 判断某张卡是否需要使用占位纹理（无真实图片可用） */
export function shouldUsePlaceholder(slug: string, availableTextures: string[]): boolean {
  return !availableTextures.includes(slug);
}
