import Phaser from 'phaser';
import { BackgroundFX } from '../../ui/BackgroundFX';

export class V2ResultScene extends Phaser.Scene {
  constructor() { super({ key: 'V2ResultScene' }); }

  create(): void {
    new BackgroundFX(this, 'menu');
    this.cameras.main.fadeIn(400, 0, 0, 0);
    const { width, height } = this.scale;
    const result = this.registry.get('v2BattleResult') as { winner: string; turns: number } | undefined;
    const won = result?.winner === 'player';

    this.add.text(width / 2, height * 0.3, won ? '胜 利' : '败 北', {
      fontSize: '48px', color: won ? '#ffd700' : '#ff4444', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.45, `回合数: ${result?.turns ?? '?'}`, {
      fontSize: '18px', color: '#aaaacc',
    }).setOrigin(0.5);

    // 奖励提示
    if (won) {
      this.add.text(width / 2, height * 0.55, '获得: Gold +500 | EXP +200 | FP +10', {
        fontSize: '14px', color: '#66ff66',
      }).setOrigin(0.5);
    }

    const btn = this.add.text(width / 2, height * 0.72, '[ 返回主菜单 ]', {
      fontSize: '20px', color: '#66ccff', backgroundColor: '#2a2a4e', padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.scene.start('V2MenuScene'));
  }
}
