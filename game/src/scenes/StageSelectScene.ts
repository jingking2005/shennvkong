import Phaser from 'phaser';
import type { SaveData } from '../data/schema/types';
import { stages } from '../data/stages';
import { getUnlockedStages, getStageDifficultyLabel } from '../systems/StageManager';

export class StageSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StageSelectScene' });
  }

  create(): void {
    const { width } = this.scale;
    const save: SaveData | undefined = this.registry.get('save');
    const clearedIds = save?.clearedStages || [];
    const unlocked = getUnlockedStages(stages, clearedIds);
    const unlockedIds = unlocked.map(s => s.id);

    // 标题
    this.add.text(width / 2, 36, '选择关卡', {
      fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    // 关卡列表
    const startY = 100;
    const itemH = 95;

    stages.forEach((stage, i) => {
      const y = startY + i * itemH;
      const isUnlocked = unlockedIds.includes(stage.id);
      const isCleared = clearedIds.includes(stage.id);

      // 背景面板
      const bgColor = isUnlocked ? 0x2a2a4e : 0x1a1a2a;
      const panel = this.add.rectangle(width / 2, y + 30, 700, 80, bgColor, 0.8);
      panel.setStrokeStyle(1, isUnlocked ? 0x4a4a7e : 0x333344);

      if (isUnlocked) {
        panel.setInteractive({ useHandCursor: true });
        panel.on('pointerover', () => panel.setFillStyle(0x3a3a5e, 0.9));
        panel.on('pointerout', () => panel.setFillStyle(bgColor, 0.8));
        panel.on('pointerdown', () => {
          this.registry.set('currentStage', stage);
          this.scene.start('TeamScene');
        });
      }

      // 关卡名
      const nameColor = isUnlocked ? '#ffffff' : '#555555';
      this.add.text(160, y + 10, `${i + 1}. ${stage.name}`, {
        fontSize: '18px', color: nameColor, fontStyle: 'bold',
      });

      // 难度标签
      const diffLabel = getStageDifficultyLabel(stage.difficulty);
      const diffColor = stage.difficulty <= 2 ? '#66cc66' : stage.difficulty <= 4 ? '#ffaa00' : '#ff4444';
      this.add.text(160, y + 38, `难度: ${diffLabel}  |  敌人: ${stage.enemies.length}`, {
        fontSize: '13px', color: diffColor,
      });

      // 状态标记
      if (isCleared) {
        this.add.text(780, y + 22, '★ 已通关', {
          fontSize: '14px', color: '#ffd700',
        }).setOrigin(1, 0.5);
      } else if (!isUnlocked) {
        this.add.text(780, y + 22, '🔒 未解锁', {
          fontSize: '14px', color: '#666666',
        }).setOrigin(1, 0.5);
      } else {
        this.add.text(780, y + 22, '▶ 挑战', {
          fontSize: '14px', color: '#66ccff',
        }).setOrigin(1, 0.5);
      }
    });

    // 返回按钮
    const backBtn = this.add.text(width / 2, 608, '[ 返回主菜单 ]', {
      fontSize: '18px', color: '#aaaaaa', backgroundColor: '#2a2a3e',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}
