import Phaser from 'phaser';
import { BackgroundFX } from '../../ui/BackgroundFX';
import { getV2CardTextureKey } from '../data/card-images';
import type { CardDefinition, Position } from '../data/types';
import cardsData from '../../../data/v2/fixtures/cards.json';

const POSITIONS: { pos: Position; label: string; x: number; y: number }[] = [
  { pos: 'FRONT_LEFT', label: '前排左', x: 300, y: 180 },
  { pos: 'FRONT_RIGHT', label: '前排右', x: 660, y: 180 },
  { pos: 'MID_LEFT', label: '中排左', x: 220, y: 300 },
  { pos: 'MID_RIGHT', label: '中排右', x: 740, y: 300 },
  { pos: 'BACK_CENTER', label: '后排', x: 480, y: 400 },
];

const ROLE_COLORS: Record<string, string> = {
  MAIN_DPS: '#ff4444', SUB_DPS: '#ff8844', TANK: '#4488ff',
  HEALER: '#44ff88', BUFF_SUPPORT: '#ffff44', DEBUFF_SUPPORT: '#ff44ff',
  CONTROLLER: '#44ffff', HYBRID: '#aaaaaa',
};

const RARITY_COLORS: Record<string, string> = {
  N: '#9e9e9e', R: '#42a5f5', SR: '#ffa726', UR: '#ef5350', LR: '#ab47bc',
};

export class V2TeamScene extends Phaser.Scene {
  private selectedIds: string[] = [];
  private cards: CardDefinition[];
  private slotImages: (Phaser.GameObjects.Image | Phaser.GameObjects.Graphics)[] = [];
  private slotTexts: Phaser.GameObjects.Text[] = [];

  constructor() { super({ key: 'V2TeamScene' }); this.cards = cardsData as CardDefinition[]; }

  create(): void {
    new BackgroundFX(this, 'battle');
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.selectedIds = [];
    this.slotImages = [];
    this.slotTexts = [];

    const { width } = this.scale;

    // 顶栏
    const topBar = this.add.graphics();
    topBar.fillStyle(0x0a0a2a, 0.9);
    topBar.fillRect(0, 0, width, 45);
    this.add.text(width / 2, 22, '⚔️ 编队出战', { fontSize: '18px', color: '#ff6644', fontStyle: 'bold' }).setOrigin(0.5);

    const back = this.add.text(30, 22, '← 返回', { fontSize: '14px', color: '#aaa' }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => { this.cameras.main.fadeOut(200, 0, 0, 0); this.time.delayedCall(200, () => this.scene.start('V2HubScene')); });

    // 位置槽位
    for (const p of POSITIONS) {
      const slot = this.add.graphics();
      slot.fillStyle(0x222244, 0.5);
      slot.fillRoundedRect(p.x - 40, p.y - 50, 80, 100, 8);
      slot.lineStyle(1, 0x444466, 0.8);
      slot.strokeRoundedRect(p.x - 40, p.y - 50, 80, 100, 8);
      this.add.text(p.x, p.y + 55, p.label, { fontSize: '9px', color: '#555' }).setOrigin(0.5);
      this.slotImages.push(slot);
    }

    // 信息栏
    this.add.text(width / 2, 470, '', { fontSize: '12px', color: '#aaa' }).setOrigin(0.5).setName('info');

    // 卡牌选择列表（底部滚动区）
    const listBg = this.add.graphics();
    listBg.fillStyle(0x0a0a1a, 0.8);
    listBg.fillRect(0, 490, width, 150);
    listBg.lineStyle(1, 0x333355, 0.5);
    listBg.lineBetween(0, 490, width, 490);

    this.cards.forEach((card, i) => {
      const col = i % 8;
      const row = Math.floor(i / 8);
      const x = 65 + col * 110;
      const y = 520 + row * 60;

      this.createCardButton(card, x, y);
    });

    // 开始战斗按钮
    const btn = this.add.text(width / 2, 460, '[ 开始战斗 ]', {
      fontSize: '16px', color: '#666', backgroundColor: '#2a2a4e', padding: { x: 16, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setName('battleBtn');

    btn.on('pointerdown', () => {
      if (this.selectedIds.length > 0) {
        this.registry.set('v2PlayerDeck', this.selectedIds);
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.time.delayedCall(300, () => this.scene.start('V2BattleScene'));
      }
    });

    this.updateInfo();
  }

  private createCardButton(card: CardDefinition, x: number, y: number): void {
    const texKey = getV2CardTextureKey(card.id);
    const hasImg = this.textures.exists(texKey);
    const rarityColor = RARITY_COLORS[card.rarity] || '#888';

    const container = this.add.container(x, y);

    // 小卡图
    if (hasImg) {
      const img = this.add.image(0, -5, texKey).setDisplaySize(40, 50);
      container.add(img);
    } else {
      const ph = this.add.graphics();
      ph.fillStyle(Phaser.Display.Color.HexStringToColor(rarityColor).color, 0.3);
      ph.fillRoundedRect(-20, -25, 40, 50, 4);
      container.add(ph);
    }

    // 名字
    const name = (card.name.cn || card.name.en).slice(0, 4);
    const nameText = this.add.text(0, 25, name, { fontSize: '8px', color: rarityColor }).setOrigin(0.5);
    container.add(nameText);

    // 选中边框
    const selBorder = this.add.graphics();
    selBorder.lineStyle(2, 0x66ff66, 1);
    selBorder.strokeRoundedRect(-22, -27, 44, 56, 4);
    selBorder.setAlpha(0);
    container.add(selBorder);

    // 交互
    const zone = this.add.zone(0, 0, 50, 60).setInteractive({ useHandCursor: true });
    container.add(zone);

    zone.on('pointerdown', () => {
      const idx = this.selectedIds.indexOf(card.id);
      if (idx >= 0) {
        this.selectedIds.splice(idx, 1);
        selBorder.setAlpha(0);
        this.clearSlot(this.selectedIds.length);
      } else if (this.selectedIds.length < 5) {
        this.selectedIds.push(card.id);
        selBorder.setAlpha(1);
        this.fillSlot(this.selectedIds.length - 1, card);
      }
      this.updateInfo();
    });
  }

  private fillSlot(slotIdx: number, card: CardDefinition): void {
    if (slotIdx >= POSITIONS.length) return;
    const p = POSITIONS[slotIdx];
    const texKey = getV2CardTextureKey(card.id);
    const hasImg = this.textures.exists(texKey);

    // 清除旧内容
    const oldImg = this.slotImages[slotIdx];
    if (oldImg && oldImg instanceof Phaser.GameObjects.Image) oldImg.destroy();

    if (hasImg) {
      const img = this.add.image(p.x, p.y, texKey).setDisplaySize(70, 90);
      this.slotImages[slotIdx] = img;
    }

    // 清除旧文字
    if (this.slotTexts[slotIdx]) this.slotTexts[slotIdx].destroy();
    const name = (card.name.cn || card.name.en).slice(0, 5);
    this.slotTexts[slotIdx] = this.add.text(p.x, p.y + 55, name, { fontSize: '9px', color: '#fff' }).setOrigin(0.5);
  }

  private clearSlot(slotIdx: number): void {
    const oldImg = this.slotImages[slotIdx];
    if (oldImg && oldImg instanceof Phaser.GameObjects.Image) {
      oldImg.destroy();
      this.slotImages[slotIdx] = this.add.graphics();
    }
    if (this.slotTexts[slotIdx]) {
      this.slotTexts[slotIdx].destroy();
      this.slotTexts[slotIdx] = this.add.text(0, 0, '');
    }
  }

  private updateInfo(): void {
    const info = this.children.getByName('info') as Phaser.GameObjects.Text;
    const btn = this.children.getByName('battleBtn') as Phaser.GameObjects.Text;
    if (!info || !btn) return;

    const selected = this.cards.filter(c => this.selectedIds.includes(c.id));
    const totalCost = selected.reduce((s, c) => s + c.cardCost, 0);
    const roles = selected.map(c => c.primaryRole);
    const elements = [...new Set(selected.map(c => c.element))];

    info.setText(`已选 ${this.selectedIds.length}/5 | Cost: ${totalCost} | ${elements.join(' ')} | ${roles.map(r => r.slice(0, 3)).join(' ')}`);
    btn.setColor(this.selectedIds.length > 0 ? '#66ff66' : '#666');
  }
}
