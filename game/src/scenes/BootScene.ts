import Phaser from 'phaser';
import type { Card } from '../data/schema/types';
import mockCards from '../data/fixtures/mock-cards.json';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    // 将 Mock 数据存入全局 registry
    this.registry.set('cards', mockCards as Card[]);
    this.registry.set('playerDeck', [] as string[]);

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
