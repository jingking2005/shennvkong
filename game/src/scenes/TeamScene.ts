import Phaser from 'phaser';
import type { Card, Element } from '../data/schema/types';
import { generateCardTexture } from '../ui/CardTextureGenerator';
import { getRarityBorderColor } from '../ui/CardImageResolver';
import { BackgroundFX } from '../ui/BackgroundFX';

const ELEMENT_LABELS: Record<Element, string> = {
  Passion: '火', Cool: '冰', Light: '光', Dark: '暗', Special: '特',
};

const CARD_W = 100;
const CARD_H = 130;
const COLS = 6;
const GAP_X = 18;
const GAP_Y = 16;
const START_X = 80;
const START_Y = 80;

interface CardSlot {
  card: Card;
  container: Phaser.GameObjects.Container;
  selected: boolean;
  border: Phaser.GameObjects.Graphics;
}

export class TeamScene extends Phaser.Scene {
  private selectedIds: string[] = [];
  private slots: CardSlot[] = [];
  private battleBtn!: Phaser.GameObjects.Text;
  private selectionText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'TeamScene' });
  }

  create(): void {
    new BackgroundFX(this, 'team');
    this.cameras.main.fadeIn(400, 0, 0, 0);
    const cards = this.registry.get('cards') as Card[];
    this.selectedIds = [];
    this.slots = [];

    // 标题
    this.add.text(480, 28, '选择出战卡牌', {
      fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.selectionText = this.add.text(480, 54, '已选 0/5', {
      fontSize: '14px', color: '#aaaaaa',
    }).setOrigin(0.5);

    // 生成卡牌网格
    cards.forEach((card, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = START_X + col * (CARD_W + GAP_X);
      const y = START_Y + row * (CARD_H + GAP_Y);

      this.createCardSlot(card, x, y);
    });

    // 开始战斗按钮
    this.battleBtn = this.add.text(480, 608, '[ 开始战斗 ]', {
      fontSize: '22px', color: '#666666', backgroundColor: '#2a2a4e',
      padding: { x: 24, y: 10 },
    }).setOrigin(0.5);

    this.updateBattleBtn();
  }

  private createCardSlot(card: Card, x: number, y: number): void {
    // 确保纹理存在（优先真实卡图）
    const texKey = generateCardTexture(this, card);

    const container = this.add.container(x, y);

    // 选中边框（默认隐藏）
    const border = this.add.graphics();
    border.lineStyle(3, 0x66ff66, 1);
    border.strokeRoundedRect(-CARD_W / 2 - 3, -CARD_H / 2 - 3, CARD_W + 6, CARD_H + 6, 10);
    border.setAlpha(0);
    container.add(border);

    // 卡牌图像
    const img = this.add.image(0, 0, texKey).setDisplaySize(CARD_W, CARD_H);
    container.add(img);

    // 属性符号
    const elemLabel = this.add.text(0, -20, ELEMENT_LABELS[card.element], {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
    container.add(elemLabel);

    // 稀有度
    const rarityColor = '#' + getRarityBorderColor(card.rarity).toString(16).padStart(6, '0');
    const rarityLabel = this.add.text(0, 10, card.rarity, {
      fontSize: '13px', color: rarityColor, fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(rarityLabel);

    // 名称
    const name = card.names.cn || card.names.en;
    const shortName = name.length > 5 ? name.slice(0, 5) + '..' : name;
    const nameLabel = this.add.text(0, 35, shortName, {
      fontSize: '10px', color: '#eeeeee',
    }).setOrigin(0.5);
    container.add(nameLabel);

    // ATK
    const atkLabel = this.add.text(0, 50, `ATK ${card.baseStats.atk}`, {
      fontSize: '9px', color: '#bbbbbb',
    }).setOrigin(0.5);
    container.add(atkLabel);

    // 交互
    container.setSize(CARD_W, CARD_H);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => this.toggleCard(card.id, container, border));

    // Hover 效果
    container.on('pointerover', () => {
      if (!this.slots.find(s => s.card.id === card.id)?.selected) {
        container.setScale(1.05);
      }
    });
    container.on('pointerout', () => {
      container.setScale(1.0);
    });

    this.slots.push({ card, container, selected: false, border });
  }

  private toggleCard(id: string, container: Phaser.GameObjects.Container, border: Phaser.GameObjects.Graphics): void {
    const slot = this.slots.find(s => s.card.id === id);
    if (!slot) return;

    const idx = this.selectedIds.indexOf(id);
    if (idx >= 0) {
      // 取消选择
      this.selectedIds.splice(idx, 1);
      slot.selected = false;
      border.setAlpha(0);
      container.setScale(1.0);
    } else if (this.selectedIds.length < 5) {
      // 选中
      this.selectedIds.push(id);
      slot.selected = true;
      border.setAlpha(1);
      container.setScale(1.05);
    }

    this.selectionText.setText(`已选 ${this.selectedIds.length}/5`);
    this.updateBattleBtn();
  }

  private updateBattleBtn(): void {
    const ready = this.selectedIds.length > 0;
    this.battleBtn.setColor(ready ? '#66ff66' : '#666666');
    this.battleBtn.setText(`[ 开始战斗 (${this.selectedIds.length}/5) ]`);

    if (ready) {
      this.battleBtn.setInteractive({ useHandCursor: true });
      this.battleBtn.removeAllListeners('pointerdown');
      this.battleBtn.on('pointerdown', () => {
        this.registry.set('playerDeck', this.selectedIds);
        this.scene.start('BattleScene');
      });
    }
  }
}
