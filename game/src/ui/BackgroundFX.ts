/**
 * BackgroundFX — 共享氛围背景系统
 * 提供星空、浮动粒子、渐变光晕等游戏氛围效果
 */

import Phaser from 'phaser';

export interface BackgroundTheme {
  topColor: number;
  bottomColor: number;
  starCount?: number;
  particleColor?: number;
  glowColor?: number;
}

const THEMES: Record<string, BackgroundTheme> = {
  menu: {
    topColor: 0x0a0a1a,
    bottomColor: 0x1a1040,
    starCount: 80,
    particleColor: 0x8866ff,
    glowColor: 0x4422aa,
  },
  battle: {
    topColor: 0x0d0d20,
    bottomColor: 0x1a0a2e,
    starCount: 40,
    particleColor: 0xff6644,
    glowColor: 0x662244,
  },
  stage: {
    topColor: 0x0a1020,
    bottomColor: 0x102040,
    starCount: 60,
    particleColor: 0x44aaff,
    glowColor: 0x224488,
  },
  team: {
    topColor: 0x0a0a18,
    bottomColor: 0x141430,
    starCount: 50,
    particleColor: 0x66ffaa,
    glowColor: 0x225544,
  },
};

export class BackgroundFX {
  private scene: Phaser.Scene;
  private stars: Phaser.GameObjects.Graphics;
  private particles: Phaser.GameObjects.Graphics[] = [];
  private glowGraphics: Phaser.GameObjects.Graphics;
  private starData: { x: number; y: number; size: number; alpha: number; speed: number }[] = [];
  private particleData: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];
  private updateEvent: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, themeName: keyof typeof THEMES = 'menu') {
    this.scene = scene;
    const theme = THEMES[themeName] || THEMES.menu;
    const { width, height } = scene.scale;

    // 1. 渐变背景
    const bg = scene.add.graphics();
    this.drawGradient(bg, width, height, theme.topColor, theme.bottomColor);
    bg.setDepth(-100);

    // 2. 中央光晕
    this.glowGraphics = scene.add.graphics();
    this.glowGraphics.setDepth(-99);
    this.glowGraphics.setAlpha(0.3);
    const glowColor = theme.glowColor || 0x4422aa;
    this.glowGraphics.fillGradientStyle(glowColor, glowColor, 0x000000, 0x000000, 0.6);
    this.glowGraphics.fillCircle(width / 2, height * 0.35, 250);

    // 3. 星空
    this.stars = scene.add.graphics();
    this.stars.setDepth(-98);
    const starCount = theme.starCount || 60;
    for (let i = 0; i < starCount; i++) {
      this.starData.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.7 + 0.3,
        speed: Math.random() * 0.3 + 0.1,
      });
    }
    this.drawStars();

    // 4. 浮动粒子
    const pColor = theme.particleColor || 0x8866ff;
    for (let i = 0; i < 12; i++) {
      this.particleData.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.4 - 0.1,
        size: Math.random() * 3 + 1.5,
        alpha: Math.random() * 0.4 + 0.1,
      });
    }
    const pGfx = scene.add.graphics();
    pGfx.setDepth(-97);
    this.particles.push(pGfx);
    this.particleColor = pColor;

    // 5. 动画循环
    this.updateEvent = scene.time.addEvent({
      delay: 50,
      loop: true,
      callback: this.update,
      callbackScope: this,
    });
  }

  private particleColor: number = 0x8866ff;

  private drawGradient(g: Phaser.GameObjects.Graphics, w: number, h: number, top: number, bottom: number): void {
    // 用多段矩形模拟渐变
    const steps = 20;
    const stepH = h / steps;
    const topR = (top >> 16) & 0xff, topG = (top >> 8) & 0xff, topB = top & 0xff;
    const botR = (bottom >> 16) & 0xff, botG = (bottom >> 8) & 0xff, botB = bottom & 0xff;

    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const r = Math.round(topR + (botR - topR) * t);
      const gv = Math.round(topG + (botG - topG) * t);
      const b = Math.round(topB + (botB - topB) * t);
      const color = (r << 16) | (gv << 8) | b;
      g.fillStyle(color, 1);
      g.fillRect(0, i * stepH, w, stepH + 1);
    }
  }

  private drawStars(): void {
    this.stars.clear();
    for (const star of this.starData) {
      this.stars.fillStyle(0xffffff, star.alpha);
      this.stars.fillCircle(star.x, star.y, star.size);
    }
  }

  private update(): void {
    const { width, height } = this.scene.scale;

    // 星星闪烁
    for (const star of this.starData) {
      star.alpha += (Math.random() - 0.5) * 0.05;
      star.alpha = Phaser.Math.Clamp(star.alpha, 0.1, 0.9);
    }
    this.drawStars();

    // 粒子漂浮
    const gfx = this.particles[0];
    if (!gfx) return;
    gfx.clear();
    for (const p of this.particleData) {
      p.x += p.vx;
      p.y += p.vy;
      // 循环
      if (p.y < -10) { p.y = height + 10; p.x = Math.random() * width; }
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;

      gfx.fillStyle(this.particleColor, p.alpha);
      gfx.fillCircle(p.x, p.y, p.size);
    }

    // 光晕呼吸
    const breathe = 0.25 + Math.sin(Date.now() * 0.001) * 0.08;
    this.glowGraphics.setAlpha(breathe);
  }

  destroy(): void {
    this.updateEvent?.destroy();
    this.stars.destroy();
    this.glowGraphics.destroy();
    this.particles.forEach(p => p.destroy());
  }
}
