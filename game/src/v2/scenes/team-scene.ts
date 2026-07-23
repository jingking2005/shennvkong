import Phaser from 'phaser';
import { BackgroundFX } from '../../ui/BackgroundFX';
import type { CardDefinition, Position } from '../data/types';
import cardsData from '../../../data/v2/fixtures/cards.json';

const POSITIONS: { pos: Position; label: string; x: number; y: number }[] = [
  { pos: 'FRONT_LEFT', label: '前排左', x: 300, y: 420 },
  { pos: 'FRONT_RIGHT', label: '前排右', x: 660, y: 420 },
  { pos: 'MID_LEFT', label: '中排左', x: 220, y: 320 },
  { pos: 'MID_RIGHT', label: '中排右', x: 740, y: 320 },
  { pos: 'BACK_CENTER', label: '后排', x: 480, y: 220 },
];

const ROLE_COLORS: Record<string, string> = {
  MAIN_DPS: '#ff4444', SUB_DPS: '#ff8844', TANK: '#4488ff',
  HEALER: '#44ff88', BUFF_SUPPORT: '#ffff44', DEBUFF_SUPPORT: '#ff44ff',
  CONTROLLER: '#44ffff', HYBRID: '#aaaaaa',
};

export class V2TeamScene extends Phaser.Scene {
  private selectedIds: string[] = [];
  private cards: CardDefinition[];

  constructor() { super({ key: 'V2TeamScene' }); this.cards = cardsData as CardDefinition[]; }

  create(): void {
    new BackgroundFX(this, 'team');
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.selectedIds = [];

    this.add.text(480, 25, '编队 — 选择5张卡牌', { fontSize: '20px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

    // 位置预览
    for (const p of POSITIONS) {
      this.add.text(p.x, p.y, p.label, { fontSize: '10px', color: '#666' }).setOrigin(0.5);
      this.add.rectangle(p.x, p.y + 20, 60, 80, 0x222244, 0.5).setStrokeStyle(1, 0x444466);
    }

    // 卡牌列表
    const startY = 520;
    this.cards.forEach((card, i) => {
      const col = i % 8;
      const row = Math.floor(i / 8);
      const x = 70 + col * 110;
      const y = startY + row * 55;

      const roleColor = ROLE_COLORS[card.primaryRole] || '#888';
      const label = `[${card.rarity}] ${card.name.cn || card.name.en}`;
      const txt = this.add.text(x, y, label, {
        fontSize: '11px', color: roleColor, backgroundColor: '#1a1a3a', padding: { x: 4, y: 3 },
      }).setInteractive({ useHandCursor: true });

      txt.on('pointerdown', () => {
        const idx = this.selectedIds.indexOf(card.id);
        if (idx >= 0) {
          this.selectedIds.splice(idx, 1);
          txt.setBackgroundColor('#1a1a3a');
        } else if (this.selectedIds.length < 5) {
          this.selectedIds.push(card.id);
          txt.setBackgroundColor('#2a4a2a');
        }
        this.updateInfo();
      });
    });

    // 信息面板
    this.add.text(480, 490, '', { fontSize: '12px', color: '#aaa' }).setOrigin(0.5).setName('info');

    // 开始战斗按钮
    const btn = this.add.text(480, 620, '[ 开始战斗 ]', {
      fontSize: '20px', color: '#666', backgroundColor: '#2a2a4e', padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => {
      if (this.selectedIds.length > 0) {
        this.registry.set('v2PlayerDeck', this.selectedIds);
        this.scene.start('V2BattleScene');
      }
    });

    this.updateInfo();
  }

  private updateInfo(): void {
    const info = this.children.getByName('info') as Phaser.GameObjects.Text;
    if (!info) return;
    const selected = this.cards.filter(c => this.selectedIds.includes(c.id));
    const totalCost = selected.reduce((s, c) => s + c.cardCost, 0);
    const roles = selected.map(c => c.primaryRole);
    const elements = [...new Set(selected.map(c => c.element))];
    info.setText(`已选 ${this.selectedIds.length}/5 | Cost: ${totalCost} | 属性: ${elements.join(',')} | 职业: ${roles.join(',')}`);

    // 更新按钮颜色
    const btn = this.children.list.find(c => c instanceof Phaser.GameObjects.Text && (c as Phaser.GameObjects.Text).text.includes('开始战斗')) as Phaser.GameObjects.Text;
    if (btn) btn.setColor(this.selectedIds.length > 0 ? '#66ff66' : '#666');
  }
}
