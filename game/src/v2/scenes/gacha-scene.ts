/**
 * V2 抽卡场景 — 普通召唤 + 高级召唤 + 十连
 */

import Phaser from 'phaser';
import { BackgroundFX } from '../../ui/BackgroundFX';
import { GachaEngine, NORMAL_BANNER, PREMIUM_BANNER, type GachaResult } from '../systems/gacha';
import { loadSave, writeSave, spend, earn } from '../systems/save-economy';
import type { PlayerSave, Rarity } from '../data/types';
import cardsData from '../../../data/v2/fixtures/cards.json';

const RARITY_COLORS: Record<string, number> = {
  N: 0x9e9e9e, R: 0x42a5f5, SR: 0xffa726, UR: 0xef5350, LR: 0xab47bc,
};

const RARITY_GLOW: Record<string, string> = {
  N: '#666666', R: '#4488ff', SR: '#ffaa00', UR: '#ff4444', LR: '#cc44ff',
};

export class V2GachaScene extends Phaser.Scene {
  private save!: PlayerSave;
  private engine!: GachaEngine;
  private goldText!: Phaser.GameObjects.Text;
  private jewelsText!: Phaser.GameObjects.Text;
  private fpText!: Phaser.GameObjects.Text;
  private resultContainer!: Phaser.GameObjects.Container;

  constructor() { super({ key: 'V2GachaScene' }); }

  create(): void {
    new BackgroundFX(this, 'menu');
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.save = loadSave();
    this.engine = new GachaEngine(Date.now(), this.save.inventory.map(c => c.cardId));

    const { width } = this.scale;

    // 标题
    this.add.text(width / 2, 30, '召 唤', { fontSize: '28px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5);

    // 货币显示
    this.goldText = this.add.text(100, 70, '', { fontSize: '12px', color: '#ffdd44' });
    this.jewelsText = this.add.text(350, 70, '', { fontSize: '12px', color: '#ff88ff' });
    this.fpText = this.add.text(600, 70, '', { fontSize: '12px', color: '#88ff88' });
    this.updateCurrencyDisplay();

    // 结果展示区
    this.resultContainer = this.add.container(width / 2, 300);

    // 按钮
    const btnY = 520;
    this.createButton(width * 0.2, btnY, '普通召唤\n(FP 100)', '#88ff88', () => this.doPull('normal', 1));
    this.createButton(width * 0.5, btnY, '高级召唤\n(Jewels 300)', '#ff88ff', () => this.doPull('premium', 1));
    this.createButton(width * 0.8, btnY, '十连召唤\n(Jewels 2700)', '#ffaa44', () => this.doPull('premium', 10));

    // 返回按钮
    const backBtn = this.add.text(50, 610, '← 返回', { fontSize: '14px', color: '#aaa' })
      .setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.scene.start('V2HubScene'));

    // 保底进度
    this.add.text(width / 2, 580, '', { fontSize: '11px', color: '#888' }).setOrigin(0.5).setName('pity');
    this.updatePityDisplay();
  }

  private createButton(x: number, y: number, label: string, color: string, callback: () => void): void {
    const btn = this.add.text(x, y, label, {
      fontSize: '14px', color, backgroundColor: '#1a1a3a', padding: { x: 16, y: 10 },
      stroke: color, strokeThickness: 1, align: 'center',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setScale(1.05));
    btn.on('pointerout', () => btn.setScale(1));
    btn.on('pointerdown', callback);
  }

  private doPull(bannerType: 'normal' | 'premium', count: number): void {
    const banner = bannerType === 'normal' ? NORMAL_BANNER : PREMIUM_BANNER;
    const totalCost = count === 10 ? banner.cost * 9 : banner.cost; // 十连打折

    // 检查货币
    const currencyKey = banner.currency as keyof typeof this.save.currencies;
    if ((this.save.currencies[currencyKey] || 0) < totalCost) {
      this.showFloatingText('货币不足!', '#ff4444');
      return;
    }

    // 扣费
    this.save.currencies[currencyKey] -= totalCost;

    // 抽卡
    const allCards = (cardsData as any[]).map(c => ({ id: c.id, rarity: c.rarity as Rarity }));
    let results: GachaResult[];
    if (count === 10) {
      results = this.engine.tenPull(banner, allCards);
    } else {
      results = [this.engine.pull(banner, allCards)];
    }

    // 展示结果
    this.showResults(results);

    // 保存到存档
    writeSave(this.save);
    this.updateCurrencyDisplay();
    this.updatePityDisplay();
  }

  private showResults(results: GachaResult[]): void {
    // 清除旧结果
    this.resultContainer.removeAll(true);

    const count = results.length;
    const cardW = count > 1 ? 70 : 120;
    const gap = count > 1 ? 8 : 0;
    const totalW = count * cardW + (count - 1) * gap;
    const startX = -totalW / 2 + cardW / 2;

    results.forEach((r, i) => {
      const x = startX + i * (cardW + gap);
      const color = RARITY_COLORS[r.rarity] || 0xffffff;
      const glow = RARITY_GLOW[r.rarity] || '#ffffff';

      // 卡框
      const frame = this.add.graphics();
      frame.fillStyle(color, 0.3);
      frame.fillRoundedRect(x - cardW / 2, -50, cardW, 100, 6);
      frame.lineStyle(2, color, 1);
      frame.strokeRoundedRect(x - cardW / 2, -50, cardW, 100, 6);
      this.resultContainer.add(frame);

      // 稀有度文字
      const rarityText = this.add.text(x, -20, r.rarity, {
        fontSize: count > 1 ? '14px' : '20px', color: glow, fontStyle: 'bold',
      }).setOrigin(0.5);
      this.resultContainer.add(rarityText);

      // 卡名
      const cardDef = (cardsData as any[]).find(c => c.id === r.cardId);
      const name = cardDef?.name?.cn || cardDef?.name?.en || r.cardId;
      const shortName = name.length > 4 ? name.slice(0, 4) : name;
      const nameText = this.add.text(x, 10, shortName, {
        fontSize: count > 1 ? '9px' : '12px', color: '#ddd',
      }).setOrigin(0.5);
      this.resultContainer.add(nameText);

      // NEW 标记
      if (r.isNew) {
        const newText = this.add.text(x, 35, 'NEW', {
          fontSize: '10px', color: '#ff4444', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.resultContainer.add(newText);
      }

      // 保底标记
      if (r.isPity) {
        const pityText = this.add.text(x, -40, '★保底', {
          fontSize: '9px', color: '#ffd700',
        }).setOrigin(0.5);
        this.resultContainer.add(pityText);
      }
    });

    // 入场动画
    this.resultContainer.setAlpha(0);
    this.tweens.add({ targets: this.resultContainer, alpha: 1, duration: 400, ease: 'Power2' });

    // SR+ 闪光效果
    const hasSR = results.some(r => r.rarity === 'SR' || r.rarity === 'UR' || r.rarity === 'LR');
    if (hasSR) {
      const flash = this.add.rectangle(480, 300, 960, 640, 0xffffff, 0.3).setDepth(50);
      this.tweens.add({ targets: flash, alpha: 0, duration: 300, onComplete: () => flash.destroy() });
    }
  }

  private showFloatingText(text: string, color: string): void {
    const t = this.add.text(480, 250, text, { fontSize: '18px', color, fontStyle: 'bold' }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: t, y: 200, alpha: 0, duration: 1000, onComplete: () => t.destroy() });
  }

  private updateCurrencyDisplay(): void {
    this.goldText.setText(`Gold: ${this.save.currencies.gold || 0}`);
    this.jewelsText.setText(`Jewels: ${this.save.currencies.jewels || 0}`);
    this.fpText.setText(`FP: ${this.save.currencies.friendship_points || 0}`);
  }

  private updatePityDisplay(): void {
    const pityText = this.children.getByName('pity') as Phaser.GameObjects.Text;
    if (!pityText) return;
    const progress = this.engine.getPityProgress('premium');
    const sr = progress['SR'] || 0;
    const ur = progress['UR'] || 0;
    pityText.setText(`高级池保底进度 — SR: ${sr}/10 | UR: ${ur}/50`);
  }
}
