/**
 * HealthBar — Phaser HP 条组件
 * 显示在卡牌下方，随 HP 变化更新宽度和颜色
 */

import Phaser from 'phaser';
import { getHpColor } from './BattleAnimator';

export class HealthBar {
  private bg: Phaser.GameObjects.Graphics;
  private fill: Phaser.GameObjects.Graphics;
  private width: number;
  private height: number;
  private x: number;
  private y: number;
  private ratio = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, width = 80, height = 8) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    this.bg = scene.add.graphics();
    this.fill = scene.add.graphics();

    this.drawBg();
    this.drawFill();
  }

  private drawBg(): void {
    this.bg.clear();
    this.bg.fillStyle(0x333333, 1);
    this.bg.fillRoundedRect(this.x - this.width / 2, this.y, this.width, this.height, 3);
  }

  private drawFill(): void {
    this.fill.clear();
    const fillWidth = Math.max(0, this.width * this.ratio);
    if (fillWidth <= 0) return;
    this.fill.fillStyle(getHpColor(this.ratio), 1);
    this.fill.fillRoundedRect(this.x - this.width / 2, this.y, fillWidth, this.height, 3);
  }

  /** 设置 HP（带 Tween 动画） */
  setHp(current: number, max: number, scene: Phaser.Scene): void {
    const targetRatio = Math.max(0, current / max);
    const startRatio = this.ratio;

    scene.tweens.addCounter({
      from: startRatio,
      to: targetRatio,
      duration: 300,
      ease: 'Power2',
      onUpdate: (tween) => {
        this.ratio = tween.getValue() ?? targetRatio;
        this.drawFill();
      },
    });
  }

  /** 立即设置（无动画） */
  setHpImmediate(current: number, max: number): void {
    this.ratio = Math.max(0, current / max);
    this.drawFill();
  }

  destroy(): void {
    this.bg.destroy();
    this.fill.destroy();
  }
}
