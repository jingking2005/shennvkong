import Phaser from 'phaser';
import type { BattleResult, SaveData, Stage } from '../data/schema/types';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
  }

  create(): void {
    const result = this.registry.get('battleResult') as BattleResult | undefined;
    const currentStage = this.registry.get('currentStage') as Stage | undefined;
    const { width, height } = this.scale;

    const won = result?.winner === 'player';
    const title = won ? '胜 利' : '败 北';
    const color = won ? '#ffd700' : '#ff4444';

    this.add.text(width / 2, height * 0.25, title, {
      fontSize: '56px', color, fontStyle: 'bold',
    }).setOrigin(0.5);

    if (currentStage) {
      this.add.text(width / 2, height * 0.38, `关卡: ${currentStage.name}`, {
        fontSize: '18px', color: '#aaaacc',
      }).setOrigin(0.5);
    }

    this.add.text(width / 2, height * 0.45, `回合数: ${result?.turns ?? 0}`, {
      fontSize: '20px', color: '#aaaacc',
    }).setOrigin(0.5);

    // 更新存档
    this.updateSave(won, currentStage);

    // 按钮区域
    let btnY = height * 0.62;

    // 胜利时显示“下一关”按钮
    if (won && currentStage) {
      const nextBtn = this.add.text(width / 2, btnY, '[ 返回选关 ]', {
        fontSize: '22px', color: '#66ff66', backgroundColor: '#2a4e2a',
        padding: { x: 20, y: 10 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      nextBtn.on('pointerdown', () => this.scene.start('StageSelectScene'));
      btnY += 60;
    }

    // 返回菜单
    const btn = this.add.text(width / 2, btnY, '[ 返回主菜单 ]', {
      fontSize: '22px', color: '#66ccff', backgroundColor: '#2a2a4e',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  private updateSave(won: boolean, stage?: Stage): void {
    let save: SaveData = this.registry.get('save') || {
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      playerName: 'Player',
      decks: [],
      clearedStages: [],
      cardCollection: (this.registry.get('playerDeck') as string[]) || [],
      stats: { battlesWon: 0, battlesLost: 0 },
    };

    if (won) {
      save.stats.battlesWon++;
      // 记录通关关卡
      if (stage && !save.clearedStages.includes(stage.id)) {
        save.clearedStages.push(stage.id);
      }
    } else {
      save.stats.battlesLost++;
    }
    save.updatedAt = new Date().toISOString();

    localStorage.setItem('valkyrie-crusade-save', JSON.stringify(save));
    this.registry.set('save', save);
  }
}
