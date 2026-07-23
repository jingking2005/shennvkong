/**
 * CardTextureGenerator — 运行时生成卡牌占位纹理
 *
 * 用 Graphics 生成属性底色 + 稀有度边框的纹理。
 * 文字信息通过 CardSprite 的 Container 叠加显示。
 */

import Phaser from 'phaser';
import type { Card } from '../data/schema/types';
import { getRarityBorderColor, getElementBaseColor } from './CardImageResolver';

const TEX_W = 80;
const TEX_H = 100;

/**
 * 为一张卡生成占位纹理（仅在无真实卡图时使用）
 * 纹理 key: `card-{slug}`
 */
export function generateCardTexture(scene: Phaser.Scene, card: Card): string {
  // 优先使用真实卡图
  const imgKey = `card-img-${card.slug}`;
  if (scene.textures.exists(imgKey)) return imgKey;

  const key = `card-${card.slug}`;
  if (scene.textures.exists(key)) return key;

  const g = scene.make.graphics({}, false);
  const baseColor = getElementBaseColor(card.element);
  const borderColor = getRarityBorderColor(card.rarity);

  // 底色
  g.fillStyle(baseColor, 1);
  g.fillRoundedRect(0, 0, TEX_W, TEX_H, 8);

  // 上部高光
  g.fillStyle(0xffffff, 0.15);
  g.fillRoundedRect(4, 4, TEX_W - 8, TEX_H * 0.35, 6);

  // 下部暗部
  g.fillStyle(0x000000, 0.2);
  g.fillRect(4, TEX_H * 0.7, TEX_W - 8, TEX_H * 0.25);

  // 稀有度边框
  g.lineStyle(3, borderColor, 1);
  g.strokeRoundedRect(1.5, 1.5, TEX_W - 3, TEX_H - 3, 8);

  g.generateTexture(key, TEX_W, TEX_H);
  g.destroy();

  return key;
}

/** 批量生成 */
export function generateAllCardTextures(scene: Phaser.Scene, cards: Card[]): void {
  for (const card of cards) {
    generateCardTexture(scene, card);
  }
}

/** 获取纹理 key */
export function getCardTextureKey(slug: string): string {
  return `card-${slug}`;
}
