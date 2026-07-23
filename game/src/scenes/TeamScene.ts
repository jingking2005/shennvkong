import Phaser from 'phaser';
import type { Card, Element } from '../data/schema/types';

const ELEMENT_COLORS: Record<Element, string> = {
  Passion: '#ff4444',
  Cool: '#4488ff',
  Light: '#ffdd44',
  Dark: '#aa44ff',
  Special: '#888888',
};

const RARITY_COLORS: Record<string, string> = {
  N: '#aaaaaa', R: '#44aaff', SR: '#ffaa00', UR: '#ff4488', LR: '#ff00ff',
};

export class TeamScene extends Phaser.Scene {
  private selectedIds: string[] = [];
  private cardTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: 'TeamScene' });
  }

  create(): void {
    const cards = this.registry.get('cards') as Card[];
    this.selectedIds = [];
    this.cardTexts = [];

    this.add.text(480, 30, '选择出战卡牌（最多 5 张）', {
      fontSize: '22px', color: '#ffffff',
    }).setOrigin(0.5);

    // 渲染卡牌列表（简化：文字列表）
    const startY = 70;
    const colWidth = 320;

    cards.forEach((card, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 60 + col * colWidth;
      const y = startY + row * 52;

      const rarityColor = RARITY_COLORS[card.rarity] || '#ffffff';
      const elemColor = ELEMENT_COLORS[card.element] || '#888888';
      const label = `[${card.rarity}] ${card.names.cn || card.names.en}  ${card.element}  ATK:${card.baseStats.atk}`;

      const txt = this.add.text(x, y, label, {
        fontSize: '14px',
        color: rarityColor,
        backgroundColor: '#2a2a3e',
        padding: { x: 6, y: 4 },
      }).setInteractive({ useHandCursor: true });

      // 属性色条
      this.add.rectangle(x - 8, y + 12, 4, 20, Phaser.Display.Color.HexStringToColor(elemColor).color);

      txt.on('pointerdown', () => this.toggleCard(card.id, txt));
      this.cardTexts.push(txt);
    });

    // 开始战斗按钮
    this.battleBtn = this.add.text(480, 600, '[ 开始战斗 ]', {
      fontSize: '24px', color: '#666666', backgroundColor: '#2a2a4e',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5);

    this.updateBattleBtn();
  }

  private battleBtn!: Phaser.GameObjects.Text;

  private toggleCard(id: string, txt: Phaser.GameObjects.Text): void {
    const idx = this.selectedIds.indexOf(id);
    if (idx >= 0) {
      this.selectedIds.splice(idx, 1);
      txt.setBackgroundColor('#2a2a3e');
    } else if (this.selectedIds.length < 5) {
      this.selectedIds.push(id);
      txt.setBackgroundColor('#3a5a3e');
    }
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
