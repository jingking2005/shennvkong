/**
 * BackgroundFX V2 — 多层氛围背景系统
 * 渐变天空 + 星空 + 云层 + 魔法粒子 + 光晕 + 远景剪影
 */

import Phaser from 'phaser';

export interface BackgroundTheme {
  skyTop: number;
  skyBottom: number;
  starCount: number;
  particleColor: number;
  particleCount: number;
  glowColor: number;
  glowAlpha: number;
  cloudAlpha: number;
  silhouetteColor: number;
}

const THEMES: Record<string, BackgroundTheme> = {
  menu: {
    skyTop: 0x050510, skyBottom: 0x1a0a30,
    starCount: 120, particleColor: 0x8866ff, particleCount: 20,
    glowColor: 0x6633cc, glowAlpha: 0.15, cloudAlpha: 0.08, silhouetteColor: 0x0a0520,
  },
  battle: {
    skyTop: 0x0a0510, skyBottom: 0x200a15,
    starCount: 60, particleColor: 0xff4422, particleCount: 15,
    glowColor: 0x882244, glowAlpha: 0.12, cloudAlpha: 0.05, silhouetteColor: 0x100510,
  },
  team: {
    skyTop: 0x050a10, skyBottom: 0x0a1520,
    starCount: 80, particleColor: 0x44aaff, particleCount: 12,
    glowColor: 0x224488, glowAlpha: 0.1, cloudAlpha: 0.06, silhouetteColor: 0x050a15,
  },
};

export class BackgroundFX {
  private scene: Phaser.Scene;
  private layers: Phaser.GameObjects.GameObject[] = [];
  private starData: { x: number; y: number; size: number; alpha: number; twinkleSpeed: number }[] = [];
  private particleData: { x: number; y: number; vx: number; vy: number; size: number; alpha: number; life: number }[] = [];
  private starGfx!: Phaser.GameObjects.Graphics;
  private particleGfx!: Phaser.GameObjects.Graphics;
  private cloudGfx!: Phaser.GameObjects.Graphics;
  private glowGfx!: Phaser.GameObjects.Graphics;
  private updateEvent: Phaser.Time.TimerEvent | null = null;
  private time = 0;

  constructor(scene: Phaser.Scene, themeName: string = 'menu') {
    this.scene = scene;
    const theme = THEMES[themeName] || THEMES.menu;
    const { width, height } = scene.scale;

    // Layer 0: 渐变天空
    const sky = scene.add.graphics();
    sky.setDepth(-100);
    this.drawGradientSky(sky, width, height, theme.skyTop, theme.skyBottom);
    this.layers.push(sky);

    // Layer 1: 远景山脉/建筑剪影
    const silhouette = scene.add.graphics();
    silhouette.setDepth(-99);
    this.drawSilhouette(silhouette, width, height, theme.silhouetteColor);
    this.layers.push(silhouette);

    // Layer 2: 云层
    this.cloudGfx = scene.add.graphics();
    this.cloudGfx.setDepth(-98);
    this.cloudGfx.setAlpha(theme.cloudAlpha);
    this.drawClouds(width, height);
    this.layers.push(this.cloudGfx);

    // Layer 3: 中央光晕（呼吸动画）
    this.glowGfx = scene.add.graphics();
    this.glowGfx.setDepth(-97);
    this.drawGlow(width, height, theme.glowColor, theme.glowAlpha);
    this.layers.push(this.glowGfx);

    // Layer 4: 星空
    this.starGfx = scene.add.graphics();
    this.starGfx.setDepth(-96);
    for (let i = 0; i < theme.starCount; i++) {
      this.starData.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.7,
        size: Math.random() * 1.8 + 0.3,
        alpha: Math.random() * 0.8 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
      });
    }
    this.drawStars();
    this.layers.push(this.starGfx);

    // Layer 5: 浮动魔法粒子
    this.particleGfx = scene.add.graphics();
    this.particleGfx.setDepth(-95);
    for (let i = 0; i < theme.particleCount; i++) {
      this.particleData.push(this.createParticle(width, height, theme.particleColor));
    }
    this.layers.push(this.particleGfx);

    // 动画循环
    this.updateEvent = scene.time.addEvent({
      delay: 33, // ~30fps
      loop: true,
      callback: this.update,
      callbackScope: this,
    });
  }

  private drawGradientSky(g: Phaser.GameObjects.Graphics, w: number, h: number, top: number, bottom: number): void {
    const steps = 30;
    const stepH = h / steps;
    const tR = (top >> 16) & 0xff, tG = (top >> 8) & 0xff, tB = top & 0xff;
    const bR = (bottom >> 16) & 0xff, bG = (bottom >> 8) & 0xff, bB = bottom & 0xff;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const r = Math.round(tR + (bR - tR) * t);
      const gv = Math.round(tG + (bG - tG) * t);
      const b = Math.round(tB + (bB - tB) * t);
      g.fillStyle((r << 16) | (gv << 8) | b, 1);
      g.fillRect(0, i * stepH, w, stepH + 1);
    }
  }

  private drawSilhouette(g: Phaser.GameObjects.Graphics, w: number, h: number, color: number): void {
    g.fillStyle(color, 0.6);
    // 远山
    g.beginPath();
    g.moveTo(0, h);
    const peaks = [0.7, 0.55, 0.65, 0.5, 0.6, 0.45, 0.58, 0.52, 0.62, 0.48, 0.55, 0.6];
    const segW = w / (peaks.length - 1);
    for (let i = 0; i < peaks.length; i++) {
      g.lineTo(i * segW, h * peaks[i]);
    }
    g.lineTo(w, h);
    g.closePath();
    g.fillPath();

    // 建筑剪影
    g.fillStyle(color, 0.8);
    const buildings = [
      { x: w * 0.1, bw: 30, bh: 80 },
      { x: w * 0.25, bw: 20, bh: 120 },
      { x: w * 0.4, bw: 40, bh: 60 },
      { x: w * 0.6, bw: 25, bh: 100 },
      { x: w * 0.75, bw: 35, bh: 70 },
      { x: w * 0.9, bw: 20, bh: 90 },
    ];
    for (const b of buildings) {
      g.fillRect(b.x - b.bw / 2, h - b.bh, b.bw, b.bh);
      // 尖顶
      g.fillTriangle(b.x - b.bw / 2, h - b.bh, b.x, h - b.bh - 20, b.x + b.bw / 2, h - b.bh);
    }
  }

  private drawClouds(w: number, h: number): void {
    this.cloudGfx.clear();
    this.cloudGfx.fillStyle(0xffffff, 0.3);
    // 几朵云
    const clouds = [
      { x: w * 0.2, y: h * 0.15, rx: 80, ry: 20 },
      { x: w * 0.6, y: h * 0.1, rx: 100, ry: 25 },
      { x: w * 0.8, y: h * 0.2, rx: 60, ry: 15 },
    ];
    for (const c of clouds) {
      this.cloudGfx.fillEllipse(c.x, c.y, c.rx * 2, c.ry * 2);
    }
  }

  private drawGlow(w: number, h: number, color: number, alpha: number): void {
    this.glowGfx.clear();
    this.glowGfx.setAlpha(alpha);
    // 多层光晕
    for (let i = 3; i >= 0; i--) {
      const radius = 150 + i * 50;
      this.glowGfx.fillStyle(color, 0.1 / (i + 1));
      this.glowGfx.fillCircle(w / 2, h * 0.35, radius);
    }
  }

  private drawStars(): void {
    this.starGfx.clear();
    for (const star of this.starData) {
      this.starGfx.fillStyle(0xffffff, star.alpha);
      this.starGfx.fillCircle(star.x, star.y, star.size);
      // 亮星加十字光芒
      if (star.size > 1.2) {
        this.starGfx.fillStyle(0xffffff, star.alpha * 0.3);
        this.starGfx.fillRect(star.x - star.size * 2, star.y - 0.3, star.size * 4, 0.6);
        this.starGfx.fillRect(star.x - 0.3, star.y - star.size * 2, 0.6, star.size * 4);
      }
    }
  }

  private createParticle(w: number, h: number, _color: number) {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -Math.random() * 0.5 - 0.1,
      size: Math.random() * 3 + 1,
      alpha: Math.random() * 0.5 + 0.1,
      life: Math.random() * 200 + 100,
    };
  }

  private update(): void {
    this.time++;
    const { width, height } = this.scene.scale;

    // 星星闪烁
    for (const star of this.starData) {
      star.alpha += Math.sin(this.time * star.twinkleSpeed) * 0.02;
      star.alpha = Phaser.Math.Clamp(star.alpha, 0.1, 0.95);
    }
    if (this.time % 3 === 0) this.drawStars(); // 每3帧重绘星星

    // 粒子移动
    this.particleGfx.clear();
    const theme = Object.values(THEMES)[0]; // 简化
    for (let i = 0; i < this.particleData.length; i++) {
      const p = this.particleData[i];
      p.x += p.vx + Math.sin(this.time * 0.01 + i) * 0.2;
      p.y += p.vy;
      p.life--;
      p.alpha = Math.min(p.alpha, p.life / 50);

      if (p.life <= 0 || p.y < -10) {
        this.particleData[i] = this.createParticle(width, height, theme.particleColor);
        this.particleData[i].y = height + 10;
      }

      this.particleGfx.fillStyle(theme.particleColor, p.alpha);
      this.particleGfx.fillCircle(p.x, p.y, p.size);
    }

    // 光晕呼吸
    const breathe = 0.12 + Math.sin(this.time * 0.015) * 0.05;
    this.glowGfx.setAlpha(breathe);

    // 云层缓慢移动
    this.cloudGfx.x = Math.sin(this.time * 0.003) * 10;
  }

  destroy(): void {
    this.updateEvent?.destroy();
    this.layers.forEach(l => l.destroy());
  }
}
