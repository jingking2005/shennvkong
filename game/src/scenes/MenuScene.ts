import Phaser from 'phaser';
import { BackgroundFX } from '../ui/BackgroundFX';

export class MenuScene extends Phaser.Scene {
  private bgfx!: BackgroundFX;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // 氛围背景
    this.bgfx = new BackgroundFX(this, 'menu');

    // 装饰性光环
    const ring = this.add.graphics();
    ring.setAlpha(0.15);
    ring.lineStyle(2, 0x8866ff, 0.5);
    ring.strokeCircle(width / 2, height * 0.3, 120);
    ring.strokeCircle(width / 2, height * 0.3, 160);
    ring.setDepth(1);

    // 标题 — 带发光效果
    const titleGlow = this.add.text(width / 2, height * 0.22, '神女控', {
      fontSize: '64px',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#ff8800',
      strokeThickness: 8,
    }).setOrigin(0.5).setAlpha(0.3);
    titleGlow.setDepth(2);

    const title = this.add.text(width / 2, height * 0.22, '神女控', {
      fontSize: '64px',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#664400',
      strokeThickness: 4,
      shadow: { offsetX: 0, offsetY: 0, color: '#ffaa00', blur: 20, fill: true },
    }).setOrigin(0.5);
    title.setDepth(3);

    // 副标题
    const subtitle = this.add.text(width / 2, height * 0.33, 'V A L K Y R I E   C R U S A D E', {
      fontSize: '16px',
      color: '#9988cc',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    subtitle.setDepth(3);

    // 分隔线
    const divider = this.add.graphics();
    divider.setDepth(3);
    divider.lineStyle(1, 0x6644aa, 0.5);
    divider.lineBetween(width * 0.3, height * 0.38, width * 0.7, height * 0.38);

    // 按钮组
    const btnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '24px',
      color: '#ccbbee',
      backgroundColor: '#1a1a3a',
      padding: { x: 40, y: 14 },
      stroke: '#4422aa',
      strokeThickness: 1,
    };

    // 开始冒险
    const startBtn = this.add.text(width / 2, height * 0.52, '⚔  开始冒险', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(5);

    startBtn.on('pointerover', () => {
      startBtn.setColor('#ffffff');
      startBtn.setScale(1.05);
    });
    startBtn.on('pointerout', () => {
      startBtn.setColor('#ccbbee');
      startBtn.setScale(1.0);
    });
    startBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(400, () => this.scene.start('StageSelectScene'));
    });

    // 卡牌图鉴
    const galleryBtn = this.add.text(width / 2, height * 0.64, '📖  卡牌图鉴', {
      ...btnStyle, fontSize: '20px', color: '#8899aa',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(5);

    galleryBtn.on('pointerover', () => galleryBtn.setColor('#bbccdd'));
    galleryBtn.on('pointerout', () => galleryBtn.setColor('#8899aa'));
    galleryBtn.on('pointerdown', () => this.scene.start('TeamScene'));

    // 底部版本信息
    this.add.text(width / 2, height * 0.92, 'Web Remake v0.2  ·  Mock Data 12 Cards  ·  Phaser 3', {
      fontSize: '11px', color: '#444466',
    }).setOrigin(0.5).setDepth(5);

    // 标题呼吸动画
    this.tweens.add({
      targets: [title, titleGlow],
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 入场动画
    this.cameras.main.fadeIn(600, 0, 0, 0);
    title.setAlpha(0);
    subtitle.setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 800, delay: 200, ease: 'Power2' });
    this.tweens.add({ targets: titleGlow, alpha: 0.3, duration: 800, delay: 200 });
    this.tweens.add({ targets: subtitle, alpha: 1, duration: 600, delay: 500 });
    this.tweens.add({ targets: [startBtn, galleryBtn], alpha: { from: 0, to: 1 }, duration: 500, delay: 700 });
  }
}
