import Phaser from 'phaser';
import type { Card } from '../data/schema/types';
import mockCards from '../data/fixtures/mock-cards.json';
import { getCardImageUrl } from '../data/card-image-map';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const cards = mockCards as Card[];

    // 加载真实卡图
    for (const card of cards) {
      const url = getCardImageUrl(card.slug);
      if (url) {
        // 纹理 key: card-img-{slug}
        this.load.image(`card-img-${card.slug}`, url);
      }
    }

    // 加载提示
    const { width, height } = this.scale;
    const text = this.add.text(width / 2, height / 2, '加载中...', {
      fontSize: '18px', color: '#888888',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      text.setText(`加载中... ${Math.round(value * 100)}%`);
    });
  }

  create(): void {
    // 将 Mock 数据存入全局 registry
    this.registry.set('cards', mockCards as Card[]);
    this.registry.set('playerDeck', [] as string[]);

    // 记录哪些卡牌有真实图片可用
    const cards = mockCards as Card[];
    const availableImages: string[] = [];
    for (const card of cards) {
      if (this.textures.exists(`card-img-${card.slug}`)) {
        availableImages.push(card.slug);
      }
    }
    this.registry.set('availableCardImages', availableImages);

    // 加载存档
    const saveRaw = localStorage.getItem('valkyrie-crusade-save');
    if (saveRaw) {
      try {
        this.registry.set('save', JSON.parse(saveRaw));
      } catch { /* 忽略损坏存档 */ }
    }

    this.scene.start('MenuScene');
  }
}
