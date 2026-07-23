import Phaser from 'phaser';
import { BackgroundFX } from '../../ui/BackgroundFX';
import { getV2CardTextureKey } from '../data/card-images';
import cardsData from '../../../data/v2/fixtures/cards.json';
import type { CardDefinition } from '../data/types';

const RARITY_COLORS: Record<string, string> = {
  N: '#9e9e9e', R: '#42a5f5', SR: '#ffa726', UR: '#ef5350', LR: '#ab47bc',
};
const ROLE_LABELS: Record<string, string> = {
  MAIN_DPS: '主C', SUB_DPS: '副C', TANK: '坦克', HEALER: '奶妈',
  BUFF_SUPPORT: '增益', DEBUFF_SUPPORT: '减益', CONTROLLER: '控制', HYBRID: '混合',
};

export class V2CollectionScene extends Phaser.Scene {
  private cards: CardDefinition[];
  private detailContainer!: Phaser.GameObjects.Container;

  constructor() { super({ key: 'V2CollectionScene' }); this.cards = cardsData as CardDefinition[]; }

  create(): void {
    new BackgroundFX(this, 'team');
    this.cameras.main.fadeIn(400, 0, 0, 0);
    const { width } = this.scale;

    // 顶栏
    const topBar = this.add.graphics();
    topBar.fillStyle(0x0a0a2a, 0.9);
    topBar.fillRect(0, 0, width, 45);
    this.add.text(width / 2, 22, '卡牌收藏', { fontSize: '18px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5);

    // 返回
    const back = this.add.text(30, 22, '← 返回', { fontSize: '14px', color: '#aaa' }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => { this.cameras.main.fadeOut(200, 0, 0, 0); this.time.delayedCall(200, () => this.scene.start('V2HubScene')); });

    // 卡牌网格 (4列)
    const cols = 4;
    const cardW = 140;
    const cardH = 180;
    const gapX = 20;
    const gapY = 15;
    const startX = (width - (cols * cardW + (cols - 1) * gapX)) / 2 + cardW / 2;
    const startY = 70;

    this.cards.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY) + cardH / 2;

      this.createCardSlot(card, x, y, cardW, cardH);
    });

    // 详情面板（右侧弹出）
    this.detailContainer = this.add.container(width + 200, 320);
  }

  private createCardSlot(card: CardDefinition, x: number, y: number, w: number, h: number): void {
    const container = this.add.container(x, y);
    const texKey = getV2CardTextureKey(card.id);
    const hasImage = this.textures.exists(texKey);

    // 卡框背景
    const frame = this.add.graphics();
    const rarityColor = Phaser.Display.Color.HexStringToColor(RARITY_COLORS[card.rarity] || '#888').color;
    frame.fillStyle(0x111122, 0.9);
    frame.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    frame.lineStyle(2, rarityColor, 0.8);
    frame.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    container.add(frame);

    if (hasImage) {
      // 真实卡图
      const img = this.add.image(0, -15, texKey);
      img.setDisplaySize(w - 10, h - 50);
      // 裁剪圆角效果用mask
      container.add(img);
    } else {
      // 占位色块
      const placeholder = this.add.graphics();
      placeholder.fillStyle(rarityColor, 0.3);
      placeholder.fillRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 50, 4);
      container.add(placeholder);
    }

    // 卡名
    const name = card.name.cn || card.name.en;
    const shortName = name.length > 6 ? name.slice(0, 6) + '..' : name;
    const nameText = this.add.text(0, h / 2 - 30, shortName, {
      fontSize: '11px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(nameText);

    // 稀有度 + 属性
    const infoText = this.add.text(0, h / 2 - 14, `${card.rarity} · ${card.element} · ${ROLE_LABELS[card.primaryRole] || card.primaryRole}`, {
      fontSize: '9px', color: RARITY_COLORS[card.rarity] || '#888',
    }).setOrigin(0.5);
    container.add(infoText);

    // 交互
    const zone = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    container.add(zone);

    zone.on('pointerover', () => { container.setScale(1.05); frame.lineStyle(3, rarityColor, 1); frame.strokeRoundedRect(-w / 2, -h / 2, w, h, 8); });
    zone.on('pointerout', () => { container.setScale(1); frame.lineStyle(2, rarityColor, 0.8); frame.strokeRoundedRect(-w / 2, -h / 2, w, h, 8); });
    zone.on('pointerdown', () => this.showDetail(card));
  }

  private showDetail(card: CardDefinition): void {
    this.detailContainer.removeAll(true);
    const { width } = this.scale;

    // 背景面板
    const panel = this.add.graphics();
    panel.fillStyle(0x0a0a2a, 0.95);
    panel.fillRoundedRect(-180, -280, 360, 560, 12);
    panel.lineStyle(2, 0x4444aa, 0.8);
    panel.strokeRoundedRect(-180, -280, 360, 560, 12);
    this.detailContainer.add(panel);

    // 大图
    const texKey = getV2CardTextureKey(card.id);
    if (this.textures.exists(texKey)) {
      const img = this.add.image(0, -120, texKey);
      img.setDisplaySize(200, 250);
      this.detailContainer.add(img);
    }

    // 信息
    const name = card.name.cn || card.name.en;
    this.detailContainer.add(this.add.text(0, 50, name, { fontSize: '18px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5));
    this.detailContainer.add(this.add.text(0, 75, `${card.rarity} · ${card.element} · ${ROLE_LABELS[card.primaryRole]}`, { fontSize: '12px', color: RARITY_COLORS[card.rarity] }).setOrigin(0.5));

    // 属性
    const stats = card.baseStats;
    const statsText = [
      `ATK: ${stats.attack}  DEF: ${stats.defense}`,
      `HP: ${stats.soldiers}  SPD: ${stats.speed}`,
      `暴击: ${(stats.critRate * 100).toFixed(0)}%  暴伤: ${(stats.critDamage * 100).toFixed(0)}%`,
      `Cost: ${card.cardCost}`,
    ].join('\n');
    this.detailContainer.add(this.add.text(0, 110, statsText, { fontSize: '11px', color: '#ccc', lineSpacing: 4 }).setOrigin(0.5));

    // 技能
    const skillText = card.skillIds.map((id, i) => `技能${i + 1}: ${id}`).join('\n');
    this.detailContainer.add(this.add.text(0, 180, skillText, { fontSize: '10px', color: '#88aaff', lineSpacing: 3 }).setOrigin(0.5));

    // 关闭按钮
    const closeBtn = this.add.text(0, 250, '[ 关闭 ]', { fontSize: '14px', color: '#ff6666' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.detailContainer.add(closeBtn);
    closeBtn.on('pointerdown', () => this.hideDetail());

    // 滑入动画
    this.detailContainer.x = width + 200;
    this.tweens.add({ targets: this.detailContainer, x: width - 200, duration: 300, ease: 'Power2' });
  }

  private hideDetail(): void {
    const { width } = this.scale;
    this.tweens.add({ targets: this.detailContainer, x: width + 200, duration: 200, ease: 'Power2' });
  }
}
