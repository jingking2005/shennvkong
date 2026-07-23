/**
 * CardSprite — 战斗中的卡牌视觉表示
 * 用属性色块 + 名称 + HP 条组成（后续 N2 替换为真实卡图）
 */

import Phaser from 'phaser';
import type { BattleUnit, Element } from '../data/schema/types';
import { HealthBar } from './HealthBar';

// 属性 → 颜色映射
const ELEMENT_COLORS: Record<Element, number> = {
  Passion: 0xe74c3c, // 红
  Cool: 0x3498db,    // 蓝
  Light: 0x2ecc71,   // 绿
  Dark: 0x9b59b6,    // 紫
  Special: 0xf39c12, // 金
};

const CARD_W = 80;
const CARD_H = 100;

export class CardSprite {
  readonly uid: string;
  readonly side: 'player' | 'enemy';
  readonly unit: BattleUnit;

  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private hpBar: HealthBar;
  private baseX: number;
  private baseY: number;
  private isDead = false;

  constructor(scene: Phaser.Scene, unit: BattleUnit, x: number, y: number) {
    this.scene = scene;
    this.unit = unit;
    this.uid = unit.uid;
    this.side = unit.side;
    this.baseX = x;
    this.baseY = y;

    // 容器
    this.container = scene.add.container(x, y);

    // 卡牌色块
    this.body = scene.add.graphics();
    this.drawBody();
    this.container.add(this.body);

    // 名称
    const displayName = unit.card.names.cn || unit.card.names.en;
    const shortName = displayName.length > 5 ? displayName.slice(0, 5) + '..' : displayName;
    this.nameText = scene.add.text(0, -CARD_H / 2 - 14, shortName, {
      fontSize: '11px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.container.add(this.nameText);

    // HP 条
    this.hpBar = new HealthBar(scene, x, y + CARD_H / 2 + 6, CARD_W, 7);
  }

  private drawBody(): void {
    this.body.clear();
    const color = ELEMENT_COLORS[this.unit.card.element];

    // 卡牌底色
    this.body.fillStyle(color, 0.85);
    this.body.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 6);

    // 边框
    this.body.lineStyle(2, 0xffffff, 0.6);
    this.body.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 6);

    // 属性字母
    const elementChar = this.unit.card.element[0];
    // 使用 Text 代替 Graphics 文字
  }

  /** 获取世界坐标 */
  getPosition(): { x: number; y: number } {
    return { x: this.baseX, y: this.baseY };
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /** 更新 HP 条 */
  updateHp(current: number, max: number): void {
    this.hpBar.setHp(current, max, this.scene);
  }

  /** 攻击前冲动画，返回 Promise */
  playAttack(offsetX: number, duration: number): Promise<void> {
    return new Promise(resolve => {
      this.scene.tweens.add({
        targets: this.container,
        x: this.baseX + offsetX,
        duration: duration / 2,
        ease: 'Power2',
        yoyo: true,
        onComplete: () => resolve(),
      });
    });
  }

  /** 受击抖动 */
  playHit(): Promise<void> {
    return new Promise(resolve => {
      this.scene.tweens.add({
        targets: this.container,
        x: this.baseX + 5,
        duration: 50,
        yoyo: true,
        repeat: 3,
        ease: 'Linear',
        onComplete: () => {
          this.container.x = this.baseX;
          resolve();
        },
      });
    });
  }

  /** 死亡灰化 + 淡出 */
  playDeath(): Promise<void> {
    this.isDead = true;
    return new Promise(resolve => {
      // 灰化
      this.body.clear();
      this.body.fillStyle(0x555555, 0.5);
      this.body.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 6);

      this.scene.tweens.add({
        targets: [this.container],
        alpha: 0.2,
        duration: 500,
        ease: 'Power2',
        onComplete: () => resolve(),
      });

      // HP 条也淡出
      this.hpBar.setHpImmediate(0, this.unit.maxHp);
    });
  }

  get alive(): boolean {
    return !this.isDead;
  }

  destroy(): void {
    this.container.destroy();
    this.hpBar.destroy();
    this.nameText.destroy();
  }
}
