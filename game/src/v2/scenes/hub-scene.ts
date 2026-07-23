import Phaser from 'phaser';
import { BackgroundFX } from '../../ui/BackgroundFX';
import { loadSave } from '../systems/save-economy';
import type { PlayerSave } from '../data/types';

export class V2HubScene extends Phaser.Scene {
  private save!: PlayerSave;

  constructor() { super({ key: 'V2HubScene' }); }

  create(): void {
    new BackgroundFX(this, 'menu');
    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.save = loadSave();
    const { width, height } = this.scale;

    // === 顶部状态栏 ===
    const topBar = this.add.graphics();
    topBar.fillStyle(0x0a0a2a, 0.9);
    topBar.fillRect(0, 0, width, 50);
    topBar.lineStyle(1, 0x333366, 0.5);
    topBar.lineBetween(0, 50, width, 50);

    this.add.text(20, 15, `💰 ${this.save.currencies.gold}`, { fontSize: '13px', color: '#ffdd44' });
    this.add.text(160, 15, `💎 ${this.save.currencies.jewels}`, { fontSize: '13px', color: '#ff88ff' });
    this.add.text(300, 15, `🤝 ${this.save.currencies.friendship_points}`, { fontSize: '13px', color: '#88ff88' });
    this.add.text(460, 15, `🎖 ${this.save.currencies.rare_medals}`, { fontSize: '13px', color: '#88ccff' });
    this.add.text(width - 120, 15, `📦 ${this.save.inventory.length}张`, { fontSize: '13px', color: '#aaa' });

    // === 标题 ===
    this.add.text(width / 2, 80, '神 女 控', {
      fontSize: '36px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#442200', strokeThickness: 3,
      shadow: { offsetX: 0, offsetY: 2, color: '#ff8800', blur: 10, fill: true },
    }).setOrigin(0.5);

    // === 主按钮网格 ===
    const buttons = [
      { label: '⚔️\n出 战', x: width * 0.2, y: 200, scene: 'V2TeamScene', color: '#ff6644' },
      { label: '🎰\n召 唤', x: width * 0.5, y: 200, scene: 'V2GachaScene', color: '#ff44ff' },
      { label: '📖\n卡 牌', x: width * 0.8, y: 200, scene: 'V2CollectionScene', color: '#44aaff' },
      { label: '🏰\n王 国', x: width * 0.2, y: 380, scene: 'V2KingdomScene', color: '#44ff88' },
      { label: '🔧\n养 成', x: width * 0.5, y: 380, scene: 'V2GrowthScene', color: '#ffaa44' },
      { label: '📊\n图 鉴', x: width * 0.8, y: 380, scene: 'V2CollectionScene', color: '#aaaaff' },
    ];

    for (const btn of buttons) {
      this.createNavButton(btn.x, btn.y, btn.label, btn.color, btn.scene);
    }

    // === 底部信息 ===
    this.add.text(width / 2, height - 30, 'V2 Engine · EventBus · 16 Cards · 24 Skills · Seeded RNG', {
      fontSize: '10px', color: '#444466',
    }).setOrigin(0.5);

    // === 装饰：左右魔法阵 ===
    this.drawMagicCircle(80, height / 2, 60, 0x4422aa);
    this.drawMagicCircle(width - 80, height / 2, 60, 0x2244aa);
  }

  private createNavButton(x: number, y: number, label: string, color: string, targetScene: string): void {
    const size = 120;

    // 按钮背景
    const bg = this.add.graphics();
    bg.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 0.15);
    bg.fillRoundedRect(x - size / 2, y - size / 2, size, size, 12);
    bg.lineStyle(2, Phaser.Display.Color.HexStringToColor(color).color, 0.6);
    bg.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 12);

    // 按钮文字
    const text = this.add.text(x, y, label, {
      fontSize: '16px', color, align: 'center', fontStyle: 'bold',
    }).setOrigin(0.5);

    // 交互区域
    const zone = this.add.zone(x, y, size, size).setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 0.3);
      bg.fillRoundedRect(x - size / 2, y - size / 2, size, size, 12);
      bg.lineStyle(2, Phaser.Display.Color.HexStringToColor(color).color, 1);
      bg.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 12);
      text.setScale(1.1);
    });

    zone.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 0.15);
      bg.fillRoundedRect(x - size / 2, y - size / 2, size, size, 12);
      bg.lineStyle(2, Phaser.Display.Color.HexStringToColor(color).color, 0.6);
      bg.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 12);
      text.setScale(1);
    });

    zone.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.start(targetScene));
    });
  }

  private drawMagicCircle(x: number, y: number, radius: number, color: number): void {
    const g = this.add.graphics();
    g.setAlpha(0.2);
    g.lineStyle(1, color, 0.5);
    g.strokeCircle(x, y, radius);
    g.strokeCircle(x, y, radius * 0.7);
    // 六芒星
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60) * Math.PI / 180;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      g.lineBetween(x, y, px, py);
    }

    // 旋转动画
    this.tweens.add({
      targets: g,
      angle: 360,
      duration: 20000,
      repeat: -1,
    });
  }
}
