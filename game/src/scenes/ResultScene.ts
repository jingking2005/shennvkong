import Phaser from 'phaser';
import type { BattleResult, SaveData } from '../data/schema/types';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
  }

  create(): void {
    const result = this.registry.get('battleResult') as BattleResult | undefined;
    const { width, height } = this.scale;

    const won = result?.winner === 'player';
    const title = won ? '胜 利' : '败 北';
    const color = won ? '#ffd700' : '#ff4444';

    this.add.text(width / 2, height * 0.3, title, {
      fontSize: '56px', color, fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.45, `回合数: ${result?.turns ?? 0}`, {
      fontSize: '20px', color: '#aaaacc',
    }).setOrigin(0.5);

    // 更新存档
    this.updateSave(won);

    // 返回菜单
    const btn = this.add.text(width / 2, height * 0.65, '[ 返回主菜单 ]', {
      fontSize: '24px', color: '#66ccff', backgroundColor: '#2a2a4e',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  private updateSave(won: boolean): void {
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

    if (won) save.stats.battlesWon++;
    else save.stats.battlesLost++;
    save.updatedAt = new Date().toISOString();

    localStorage.setItem('valkyrie-crusade-save', JSON.stringify(save));
    this.registry.set('save', save);
  }
}
