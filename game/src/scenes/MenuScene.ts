import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.text(width / 2, height * 0.25, '神女控', {
      fontSize: '48px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.35, 'Valkyrie Crusade', {
      fontSize: '20px',
      color: '#aaaacc',
    }).setOrigin(0.5);

    // 开始战斗按钮
    const btn = this.add.text(width / 2, height * 0.55, '[ 编队出战 ]', {
      fontSize: '28px',
      color: '#66ccff',
      backgroundColor: '#2a2a4e',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#ffffff'));
    btn.on('pointerout', () => btn.setColor('#66ccff'));
    btn.on('pointerdown', () => this.scene.start('StageSelectScene'));

    // 卡牌图鉴按钮
    const galleryBtn = this.add.text(width / 2, height * 0.70, '[ 卡牌图鉴 ]', {
      fontSize: '22px',
      color: '#88aa88',
      backgroundColor: '#2a2a4e',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    galleryBtn.on('pointerdown', () => this.scene.start('TeamScene')); // MVP: 图鉴复用编队界面

    this.add.text(width / 2, height * 0.90, 'Mock Data v0.1 — 12 cards', {
      fontSize: '12px',
      color: '#666688',
    }).setOrigin(0.5);
  }
}
