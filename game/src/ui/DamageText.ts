/**
 * DamageText — 伤害飘字组件
 * 在受击位置生成上浮渐隐的伤害数字
 */

import Phaser from 'phaser';

export interface DamageTextOptions {
  isCrit?: boolean;       // 克制攻击放大显示
  isSkill?: boolean;      // 技能伤害用不同颜色
}

/**
 * 创建一个飘字并自动播放上浮 + 渐隐动画
 * 动画结束后自动销毁
 */
export function spawnDamageText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  damage: number,
  options: DamageTextOptions = {},
): void {
  const { isCrit, isSkill } = options;

  const color = isSkill ? '#ff66ff' : isCrit ? '#ffdd00' : '#ffffff';
  const fontSize = isCrit ? '22px' : '16px';

  const text = scene.add.text(x, y, `-${damage}`, {
    fontSize,
    color,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5);

  // 随机水平偏移避免重叠
  const offsetX = Phaser.Math.Between(-15, 15);

  scene.tweens.add({
    targets: text,
    y: y - 40,
    x: x + offsetX,
    alpha: 0,
    duration: 800,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy(),
  });
}

/**
 * 技能横幅 — 屏幕中央显示技能名，渐入渐出
 */
export function spawnSkillBanner(
  scene: Phaser.Scene,
  skillName: string,
  actorName: string,
): Phaser.GameObjects.Text {
  const banner = scene.add.text(480, 280, `✦ ${actorName} — ${skillName} ✦`, {
    fontSize: '24px',
    color: '#ffd700',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5).setAlpha(0);

  scene.tweens.add({
    targets: banner,
    alpha: 1,
    duration: 200,
    ease: 'Power2',
    yoyo: true,
    hold: 400,
    onComplete: () => banner.destroy(),
  });

  return banner;
}
