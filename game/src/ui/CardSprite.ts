/**
 * CardSprite — 战斗中的卡牌视觉表示
 * 使用生成的纹理（属性底色+稀有度边框）+ 文字叠加
 * 后续 N2 真实卡图接入时，只需替换纹理即可
 */

import Phaser from 'phaser';
import type { BattleUnit, Element } from '../data/schema/types';
import { HealthBar } from './HealthBar';
import { generateCardTexture } from './CardTextureGenerator';

const CARD_W = 80;
const CARD_H = 100;

/** 属性符号 */
const ELEMENT_SYMBOLS: Record<Element, string> = {
  Passion: '火',
  Cool: '冰',
  Light: '光',
  Dark: '暗',
  Special: '特',
};

export class CardSprite {
  readonly uid: string;
  readonly side: 'player' | 'enemy';
  readonly unit: BattleUnit;

  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private cardImage: Phaser.GameObjects.Image;
  private nameText: Phaser.GameObjects.Text;
  private elementText: Phaser.GameObjects.Text;
  private rarityText: Phaser.GameObjects.Text;
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

    // 确保纹理已生成（优先真实卡图）
    const texKey = generateCardTexture(scene, unit.card);

    // 容器
    this.container = scene.add.container(x, y);

    // 卡牌图像（缩放到卡牌框尺寸）
    this.cardImage = scene.add.image(0, 0, texKey).setDisplaySize(CARD_W, CARD_H);
    this.container.add(this.cardImage);

    // 属性符号（中央）
    this.elementText = scene.add.text(0, -10, ELEMENT_SYMBOLS[unit.card.element], {
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.container.add(this.elementText);

    // 稀有度（中下）
    this.rarityText = scene.add.text(0, 20, unit.card.rarity, {
      fontSize: '12px',
      color: '#ffd700',
    }).setOrigin(0.5);
    this.container.add(this.rarityText);

    // 名称（上方）
    const displayName = unit.card.names.cn || unit.card.names.en;
    const shortName = displayName.length > 6 ? displayName.slice(0, 6) + '..' : displayName;
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

  /** 攻击前冲动画（纵向） */
  playAttack(offsetX: number, duration: number): Promise<void> {
    return new Promise(resolve => {
      this.scene.tweens.add({
        targets: this.container,
        y: this.baseY + offsetX, // offsetX 实际是纵向偏移量
        duration: duration / 2,
        ease: 'Power2',
        yoyo: true,
        onComplete: () => resolve(),
      });
    });
  }

  /** 受击抖动 + 闪白 */
  playHit(): Promise<void> {
    // 闪白效果
    this.cardImage.setTint(0xffffff);
    this.scene.time.delayedCall(100, () => this.cardImage.clearTint());

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
    this.cardImage.setTint(0x555555);
    this.elementText.setAlpha(0.3);
    this.rarityText.setAlpha(0.3);

    return new Promise(resolve => {
      this.scene.tweens.add({
        targets: [this.container],
        alpha: 0.25,
        duration: 500,
        ease: 'Power2',
        onComplete: () => resolve(),
      });
      this.hpBar.setHpImmediate(0, this.unit.maxHp);
    });
  }

  get alive(): boolean {
    return !this.isDead;
  }

  destroy(): void {
    this.container.destroy();
    this.hpBar.destroy();
  }
}
