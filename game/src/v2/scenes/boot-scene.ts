import Phaser from 'phaser';
import { getV2CardImageUrl, getV2CardTextureKey } from '../data/card-images';
import cardsData from '../../../data/v2/fixtures/cards.json';

export class V2BootScene extends Phaser.Scene {
  constructor() { super({ key: 'V2BootScene' }); }

  preload(): void {
    const { width, height } = this.scale;

    // 加载背景
    this.add.text(width / 2, height / 2 - 20, '神女控 V2', {
      fontSize: '32px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5);

    const barBg = this.add.graphics();
    barBg.fillStyle(0x333333, 1);
    barBg.fillRoundedRect(width / 2 - 150, height / 2 + 20, 300, 12, 6);

    const barFill = this.add.graphics();
    const loadText = this.add.text(width / 2, height / 2 + 50, '加载卡图中...', {
      fontSize: '12px', color: '#888',
    }).setOrigin(0.5);

    // 加载所有真实卡图
    const cards = cardsData as any[];
    for (const card of cards) {
      const url = getV2CardImageUrl(card.id);
      if (url) {
        this.load.image(getV2CardTextureKey(card.id), url);
      }
    }

    this.load.on('progress', (value: number) => {
      barFill.clear();
      barFill.fillStyle(0xffd700, 1);
      barFill.fillRoundedRect(width / 2 - 150, height / 2 + 20, 300 * value, 12, 6);
      loadText.setText(`加载卡图中... ${Math.round(value * 100)}%`);
    });

    this.load.on('complete', () => {
      loadText.setText('加载完成!');
    });
  }

  create(): void {
    this.scene.start('V2HubScene');
  }
}
