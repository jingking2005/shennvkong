import Phaser from 'phaser';
import { BackgroundFX } from '../../ui/BackgroundFX';

export class V2MenuScene extends Phaser.Scene {
  constructor() { super({ key: 'V2MenuScene' }); }

  create(): void {
    new BackgroundFX(this, 'menu');
    this.cameras.main.fadeIn(600, 0, 0, 0);
    const { width, height } = this.scale;

    // 标题
    this.add.text(width / 2, height * 0.2, '神女控 V2', {
      fontSize: '48px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#664400', strokeThickness: 4,
      shadow: { offsetX: 0, offsetY: 0, color: '#ffaa00', blur: 15, fill: true },
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.3, 'V A L K Y R I E   C R U S A D E', {
      fontSize: '14px', color: '#9988cc', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.36, '回合制策略卡牌RPG', {
      fontSize: '12px', color: '#666688',
    }).setOrigin(0.5);

    // 按钮
    const btnStyle = { fontSize: '22px', color: '#ccbbee', backgroundColor: '#1a1a3a', padding: { x: 30, y: 12 }, stroke: '#4422aa', strokeThickness: 1 };

    const startBtn = this.add.text(width / 2, height * 0.52, '⚔  编队出战', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    startBtn.on('pointerover', () => { startBtn.setColor('#fff'); startBtn.setScale(1.05); });
    startBtn.on('pointerout', () => { startBtn.setColor('#ccbbee'); startBtn.setScale(1); });
    startBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.start('V2TeamScene'));
    });

    const galleryBtn = this.add.text(width / 2, height * 0.64, '📖  卡牌图鉴', { ...btnStyle, fontSize: '18px', color: '#8899aa' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    galleryBtn.on('pointerover', () => galleryBtn.setColor('#bbccdd'));
    galleryBtn.on('pointerout', () => galleryBtn.setColor('#8899aa'));

    this.add.text(width / 2, height * 0.9, 'V2 Engine · 16 Cards · 24 Skills · EventBus Architecture', {
      fontSize: '10px', color: '#444466',
    }).setOrigin(0.5);
  }
}
